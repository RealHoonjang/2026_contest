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

async function fetchSchoolList(region) {
  const q = new URLSearchParams({ svcType: "api", svcCode: "SCHOOL", contentType: "json", gubun: "고등학교", region: region || "전체", sch1: "전체" });
  return apiGet(`/cnet/openapi/getOpenApi?${q}`);
}

function pickStr(row, keys) {
  for (const k of keys) { const v = row[k]; if (typeof v === "string" && v.trim()) return v.trim(); }
  return "";
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

function parseSchools(data) {
  const rows = findFirstArrayOfObjects(data) || [];
  return rows.map((row, i) => {
    const name = pickStr(row, ["SCHUL_NM","SCHOOL_NM","schoolName","SCH_NM","학교명","name"]);
    if (!name) return null;
    const addr = pickStr(row, ["ADRES","ADDR","주소","address"]);
    return { id: `${i}_${name}`, name, address: addr };
  }).filter(Boolean).slice(0, 50);
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
