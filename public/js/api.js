function getApiBase() {
  const origin = (window.APP_CONFIG?.apiOrigin || "").replace(/\/$/, "");
  if (origin) return `${origin}/api/backend`;
  return "/api/backend";
}

async function backendFetch(path) {
  const url = `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url);
}

async function readJson(res) {
  const text = await res.text();
  try { return { ok: true, data: JSON.parse(text) }; } catch { return { ok: false, error: "응답을 불러오지 못했습니다." }; }
}

async function apiGet(path) {
  const onPages = location.hostname.endsWith(".github.io");
  const noApi = onPages && !(window.APP_CONFIG?.apiOrigin || "").trim();
  if (noApi) {
    return {
      ok: false,
      error: "API 서버 주소가 설정되지 않았습니다. Vercel/Render에 서버를 배포한 뒤 public/js/config.js 의 apiOrigin을 설정해 주세요.",
    };
  }
  let res;
  try {
    res = await backendFetch(path);
  } catch {
    return { ok: false, error: "API 서버에 연결하지 못했습니다. 배포 URL과 config.js 를 확인해 주세요." };
  }
  if (res.status === 503) {
    const j = await res.json().catch(() => ({}));
    return { ok: false, error: j.error || "서비스 준비 중입니다." };
  }
  if (!res.ok) return { ok: false, error: `요청 실패 (${res.status})` };
  return readJson(res);
}

async function fetchV2TestList() { return apiGet("/inspct/openapi/v2/tests"); }
async function fetchV2Questions(testNo) { return apiGet(`/inspct/openapi/v2/test?q=${encodeURIComponent(testNo)}`); }
async function fetchV1Questions(q) { return apiGet(`/inspct/openapi/test/questions?q=${encodeURIComponent(q)}`); }

async function fetchSchoolList(region, opts = {}) {
  const code = REGION_TO_CODE[region] || region || "전체";
  const q = new URLSearchParams({
    svcType: "api", svcCode: "SCHOOL", contentType: "json", gubun: "고등학교",
    region: code,
    sch1: opts.sch1 || "전체",
    thisPage: String(opts.page || 1),
    perPage: String(opts.perPage || 50),
  });
  if (opts.search) q.set("searchSchulNm", opts.search);
  return apiGet(`/cnet/openapi/getOpenApi?${q}`);
}

function sch1CodesForTags(tags) {
  const codes = new Set();
  for (const t of (tags?.length ? tags : ["default"])) {
    const h = TAG_SCHOOL_HINTS[t] || TAG_SCHOOL_HINTS.default;
    (h.sch1 || []).forEach(c => codes.add(c));
  }
  return codes.size ? [...codes] : ["전체"];
}

function pickStr(row, keys) {
  for (const k of keys) { const v = row[k]; if (typeof v === "string" && v.trim()) return v.trim(); }
  return "";
}

function parseSchoolRow(row, i) {
  const name = pickStr(row, ["schoolName", "SCHUL_NM", "SCHOOL_NM", "SCH_NM", "학교명", "name"]);
  if (!name) return null;
  const regionRaw = pickStr(row, ["region", "REGION"]);
  return {
    id: pickStr(row, ["seq", "SEQ"]) || `api_${i}_${name}`,
    name,
    address: pickStr(row, ["adres", "ADRES", "ADDR", "주소", "address"]),
    region: regionFromLabel(regionRaw) !== "전체" ? regionFromLabel(regionRaw) : regionRaw,
    regionLabel: regionRaw,
    schoolType: pickStr(row, ["schoolType", "schoolGubun", "SCHOOL_TYPE", "SCHOOL_GUBUN"]),
    link: pickStr(row, ["link", "LINK"]),
    source: "api",
  };
}

function parseSchools(data) {
  const content = data?.dataSearch?.content;
  const rows = Array.isArray(content) && content.length ? content : (findFirstArrayOfObjects(data) || []);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const s = parseSchoolRow(rows[i], i);
    if (!s || seen.has(s.name)) continue;
    seen.add(s.name);
    out.push(s);
  }
  return out;
}

function fallbackSchoolsForRegion(region) {
  const r = region && region !== "전체" ? region : null;
  const list = r ? FALLBACK_HIGH_SCHOOLS.filter(s => s.region === r) : FALLBACK_HIGH_SCHOOLS;
  return list.map(s => ({ ...s, source: "reference" }));
}

function dedupeSchools(list) {
  const seen = new Set();
  return list.filter(s => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
}

async function fetchSchoolsForExplore(region, tags) {
  const sch1List = tags?.length ? sch1CodesForTags(tags) : ["전체"];
  const batches = [];
  for (const sch1 of sch1List) {
    for (let page = 1; page <= 2; page++) {
      const res = await fetchSchoolList(region, { sch1, page, perPage: 50 });
      if (!res.ok) break;
      const rows = parseSchools(res.data);
      if (!rows.length) break;
      batches.push(...rows);
      if (rows.length < 50) break;
    }
  }
  const apiSchools = dedupeSchools(batches);
  if (apiSchools.length) return { schools: apiSchools, fromApi: true };
  return { schools: fallbackSchoolsForRegion(region), fromApi: false };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreSchool(school, { tags, userRegion, userLat, userLng }) {
  let score = 0;
  const reasons = [];
  const tagList = tags?.length ? tags : ["default"];

  for (const tag of tagList) {
    if (school.tags?.includes(tag)) { score += 20; reasons.push(`${tagLabel(tag)} 맞춤`); }
    const hints = TAG_SCHOOL_HINTS[tag] || TAG_SCHOOL_HINTS.default;
    const hay = `${school.name} ${school.schoolType || ""} ${school.address || ""}`;
    for (const kw of hints.keywords) {
      if (hay.includes(kw)) { score += 12; reasons.push(`${kw} 관련`); break; }
    }
  }

  if (userRegion && userRegion !== "전체") {
    const inRegion = school.region === userRegion ||
      (school.address && (school.address.includes(userRegion) || school.address.includes(REGION_FULL[userRegion] || "")));
    if (inRegion) { score += 25; reasons.push(`${userRegion} 지역`); }
  }

  let distanceKm;
  if (userLat != null && userLng != null && school.lat != null && school.lng != null) {
    const km = haversineKm(userLat, userLng, school.lat, school.lng);
    distanceKm = Math.round(km * 10) / 10;
    if (km <= 8) { score += 35; reasons.push(`약 ${distanceKm}km`); }
    else if (km <= 20) { score += 18; reasons.push(`인근 ${distanceKm}km`); }
    else if (km <= 40) { score += 8; }
  }

  return { ...school, score, reasons: [...new Set(reasons)].slice(0, 3), ...(distanceKm != null ? { distanceKm } : {}) };
}

function recommendSchools(schools, opts) {
  return schools
    .map(s => scoreSchool(s, opts))
    .filter(s => s.score > 0 || !opts.tags?.length)
    .sort((a, b) => b.score - a.score || (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, 12);
}

async function fetchSchoolsByFilter(region, sch1) {
  const code = sch1 && sch1 !== "전체" ? sch1 : "전체";
  const batches = [];
  for (let page = 1; page <= 2; page++) {
    const res = await fetchSchoolList(region, { sch1: code, page, perPage: 50 });
    if (!res.ok) break;
    const rows = parseSchools(res.data);
    if (!rows.length) break;
    batches.push(...rows);
    if (rows.length < 50) break;
  }
  let schools = dedupeSchools(batches);
  if (schools.length) {
    if (code !== "전체") schools = schools.filter(s => matchesSch1(s, code));
    return { schools, fromApi: true };
  }
  schools = fallbackSchoolsForRegion(region);
  if (code !== "전체") schools = schools.filter(s => matchesSch1(s, code));
  if (!schools.length && region !== "전체") schools = fallbackSchoolsForRegion("전체").filter(s => matchesSch1(s, code));
  return { schools, fromApi: false };
}

function matchesSch1(school, sch1) {
  if (!sch1 || sch1 === "전체") return true;
  const t = `${school.name} ${school.schoolType || ""} ${school.address || ""}`;
  const rules = {
    "100362": /일반|종합/,
    "100363": /특성|공업|상업|마이스터|전문|직업/,
    "100364": /특수|특목|과학|예술|외국어|영재|국제|과고/,
    "100365": /자율/,
  };
  return rules[sch1] ? rules[sch1].test(t) : true;
}

async function detectUserLocation() {
  if (!navigator.geolocation) throw new Error("이 브라우저는 위치 정보를 지원하지 않습니다.");
  const pos = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  });
  const { latitude, longitude } = pos.coords;
  let region = "전체";
  let label = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ko`,
      { headers: { Accept: "application/json" } },
    );
    if (r.ok) {
      const d = await r.json();
      label = d.display_name || label;
      const addr = d.address || {};
      region = regionFromLabel(addr.state || addr.city || addr.province || label);
    }
  } catch { /* 좌표만 사용 */ }
  return { lat: latitude, lng: longitude, region, label };
}

function findFirstArrayOfObjects(value, depth = 0) {
  if (depth > 8) return null;
  if (Array.isArray(value) && value.length && typeof value[0] === "object") return value;
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) { const f = findFirstArrayOfObjects(v, depth + 1); if (f) return f; }
  }
  return null;
}

function extractV2TestList(data) {
  if (data && typeof data === "object") {
    const top = data.result || data.RESULT;
    if (Array.isArray(top) && top.length && top[0] && ("qno" in top[0] || "QNO" in top[0])) {
      const seen = new Set(), out = [];
      for (const row of top) {
        const qn = row.qno ?? row.QNO;
        const testNo = typeof qn === "number" ? String(qn) : String(qn || "").trim();
        if (!testNo || seen.has(testNo)) continue;
        seen.add(testNo);
        out.push({ testNo, title: pickStr(row, ["name","NAME","title","TITLE"]) || `검사 ${testNo}` });
      }
      if (out.length) return out;
    }
  }
  const arr = findFirstArrayOfObjects(data);
  if (!arr) return [];
  const seen = new Set(), out = [];
  for (const row of arr) {
    const no = row.test_no ?? row.TEST_NO ?? row.testNo;
    const testNo = typeof no === "number" ? String(no) : String(no || "");
    if (!testNo || seen.has(testNo)) continue;
    seen.add(testNo);
    out.push({ testNo, title: pickStr(row, ["test_nm","TEST_NM","name","title"]) || `검사 ${testNo}` });
  }
  return out;
}

/** 커리어넷 v1 진로흥미탐색 7점 척도 (API에서 6점이 "보통"으로 오는 오류 보정) */
const V1_LIKERT_BY_SCORE = {
  1: "매우낮음", 2: "낮음", 3: "약간낮음", 4: "보통",
  5: "약간높음", 6: "높음", 7: "매우높음",
};

function v1OptionLabel(score, rawLabel) {
  const s = Number(score);
  if (s >= 1 && s <= 7 && V1_LIKERT_BY_SCORE[s]) return V1_LIKERT_BY_SCORE[s];
  return String(rawLabel || "").trim();
}

function normalizeV1Shape(payload) {
  const arr = payload?.RESULT || payload?.result;
  if (!Array.isArray(arr) || !arr.length || typeof arr[0]?.question !== "string") return null;
  const out = [];
  for (const item of arr) {
    const prompt = String(item.question || "").trim();
    if (prompt.length < 2) continue;
    const options = [];
    for (let i = 1; i <= 10; i++) {
      const label = item[`answer${String(i).padStart(2,"0")}`];
      if (typeof label !== "string" || !label.trim()) continue;
      const score = item[`answerScore${String(i).padStart(2,"0")}`];
      options.push({ id: String(score || options.length + 1), label: v1OptionLabel(score, label) });
    }
    if (options.length >= 2) out.push({ id: String(item.qitemNo || out.length + 1), prompt, options });
  }
  return out.length ? out : null;
}

function normalizeInspctQuestions(payload) {
  const v1 = normalizeV1Shape(payload);
  if (v1?.length) return v1;
  const arr = findFirstArrayOfObjects(payload);
  if (!arr) return null;
  const out = [];
  for (const obj of arr) {
    const prompt = pickStr(obj, ["question","QUESTION","SURQ_CN","QSTN_CN","ITEM_CN","TITLE","CONTENT"]) ||
      Object.values(obj).filter(v => typeof v === "string" && v.length >= 8).sort((a,b) => b.length - a.length)[0] || "";
    if (prompt.length < 5) continue;
    const opts = [];
    for (const v of Object.values(obj)) {
      if (!Array.isArray(v) || v.length < 2) continue;
      for (let i = 0; i < v.length; i++) {
        const el = v[i];
        const label = typeof el === "string" ? el.trim() : pickStr(el || {}, ["ITEM_CN","LABEL","NM","TEXT","name"]);
        if (label) opts.push({ id: String(i + 1), label });
      }
      if (opts.length >= 2) break;
    }
    if (opts.length >= 2) out.push({ id: String(obj.qitemNo || out.length + 1), prompt, options: opts });
  }
  const byPrompt = new Map();
  for (const q of out) if (!byPrompt.has(q.prompt)) byPrompt.set(q.prompt, q);
  return [...byPrompt.values()].length ? [...byPrompt.values()] : null;
}

function buildSemesterReport({ session, studentId, submissions, notes, careerGoal }) {
  const sorted = [...submissions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const lines = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "  진로 상담 요약 보고서 (초안)", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "",
    `반: ${session.title}`, `학교: ${session.schoolName || "—"} · ${session.region}`, `학번: ${studentId}`,
    `작성일: ${new Date().toLocaleDateString("ko-KR")}`, "", "■ 학생 진로목표",
  ];
  if (careerGoal?.dreamJob) {
    lines.push(`  꿈 직업: ${careerGoal.dreamJob}`);
    if (careerGoal.highSchoolDirection) lines.push(`  고교: ${careerGoal.highSchoolDirection}`);
    if (careerGoal.universityDirection) lines.push(`  대학·진로: ${careerGoal.universityDirection}`);
  } else lines.push("  (저장된 목표 없음)");
  lines.push("", "■ 검사 제출");
  for (const s of sorted) lines.push(`  · ${new Date(s.createdAt).toLocaleDateString("ko-KR")} — ${s.testName || "검사"} → ${(s.interestTags||[]).map(tagLabel).join(", ")}`);
  lines.push("", "■ 상담 기록");
  for (const n of notes) lines.push(`  · ${n.date} [${n.topic}] ${n.memo || ""}`);
  lines.push("", "※ 자동 생성 초안입니다. 공유 전 내용을 확인·보완해 주세요.");
  return lines.join("\n");
}

function buildParentSummary({ testName, savedAt, tags, schoolName, classTitle, studentId, careerGoal }) {
  const sections = [{ heading: "기본 정보", body: [classTitle && `반: ${classTitle}`, schoolName && `학교: ${schoolName}`, studentId && `학번: ${studentId}`, `검사: ${testName}`, `일시: ${new Date(savedAt).toLocaleString("ko-KR")}`].filter(Boolean).join("\n") }];
  if (careerGoal?.dreamJob) {
    sections.push({ heading: "진로목표", body: [`꿈 직업: ${careerGoal.dreamJob}`, careerGoal.highSchoolDirection && `고교: ${careerGoal.highSchoolDirection}`, careerGoal.universityDirection && `대학·진로: ${careerGoal.universityDirection}`].filter(Boolean).join("\n") });
  }
  sections.push({ heading: "관심 영역", body: (tags || []).map(tagLabel).join(", ") || "탐색 중" });
  sections.push({ heading: "가정에서 나눌 질문", body: "• 자유학기·진로 탐색에서 무엇을 배웠나요?\n• 고교·대학 방향에 대해 어떻게 생각하나요?" });
  return { title: "가정 공유용 진로 요약", sections };
}

function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }
