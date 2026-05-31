/* 진로연계 탐색 — 단일 SPA */
const app = document.getElementById("app");
const nav = document.getElementById("main-nav");
const menuBtn = document.getElementById("menu-btn");

let testState = null;
let exploreSchools = [];
let exploreRegion = "전체";
let exploreRecommended = [];
let exploreLocation = null;
let exploreSourceNote = "";

function getRoute() {
  const raw = (location.hash || "#/").slice(1);
  const [path, qs] = raw.split("?");
  const parts = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs || ""));
  return { parts, query };
}

function navigate(path) { location.hash = path; }

function setActiveNav() {
  const { parts } = getRoute();
  const mode = parts[0] || "home";
  nav.querySelectorAll("a").forEach(a => {
    a.classList.toggle("active", a.dataset.nav === mode || (mode === "home" && a.dataset.nav === "student" && parts.length === 0));
  });
}

menuBtn?.addEventListener("click", () => nav.classList.toggle("open"));
nav?.addEventListener("click", () => nav.classList.remove("open"));

/* ── UI helpers ── */
function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

function pageHeader(kicker, title, sub, kickerClass = "") {
  return `<div class="page-header">
    ${kicker ? `<p class="page-kicker ${kickerClass}">${esc(kicker)}</p>` : ""}
    <h1 class="page-title">${title}</h1>
    ${sub ? `<p class="page-sub">${esc(sub)}</p>` : ""}
  </div>`;
}

function menuTile(href, icon, iconClass, title, desc) {
  return `<a href="${href}" class="menu-tile">
    <div class="menu-tile-top">
      <span class="icon-box ${iconClass}">${icon}</span>
      <span class="menu-tile-title">${esc(title)}</span>
      <span class="menu-tile-arrow">→</span>
    </div>
    <p class="menu-tile-desc">${esc(desc)}</p>
  </a>`;
}

function renderTimeline(plan) {
  return `<div class="timeline">${pathStepsInOrder(plan).map(s => `
    <div class="timeline-item">
      <div class="timeline-period">${esc(s.period)}</div>
      <div class="timeline-label">${esc(s.label)}</div>
      <div class="timeline-detail">${esc(s.detail)}</div>
      <ul class="timeline-actions">${s.actions.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
    </div>`).join("")}</div>`;
}

function renderSchoolGuides() {
  return `<div class="guide-grid">${SCHOOL_TYPE_GUIDES.map(g => `<div class="card">
    <div class="card-head"><span class="icon-box indigo">🏫</span><div>
      <div class="card-title">${esc(g.shortTitle)}</div>
      <p class="card-sub">${esc(g.title)}</p>
    </div></div>
    <p style="font-size:13px;color:var(--slate-600);margin-bottom:10px">${esc(g.forCareer)}</p>
    <ul style="font-size:13px;padding-left:18px;color:var(--slate-600);line-height:1.6">${g.bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>
  </div>`).join("")}</div>`;
}

function renderSchoolSearchBlock(prefix, opts = {}) {
  const { tags = [], defaultRegion = "경기", showGeo = true } = opts;
  const regionOpts = REGIONS.filter(r => r !== "전체").map(r =>
    `<option value="${r}" ${r === defaultRegion ? "selected" : ""}>${r}</option>`).join("");
  const typeOpts = HIGH_SCHOOL_TYPES.map(t =>
    `<option value="${t.value}">${esc(t.label)}</option>`).join("");
  return `<div class="card" id="${prefix}-panel" style="margin-top:16px;border:2px solid #a7f3d0;background:linear-gradient(135deg,#ecfdf5,#fff)">
    <div class="card-head"><span class="icon-box emerald">🔍</span><div>
      <div class="card-title">고등학교 검색</div>
      <p class="card-sub">종류와 지역을 선택해 고교를 찾아보세요.${tags.length ? " 검사 관심 분야도 반영됩니다." : ""}</p>
    </div></div>
    <div class="form-row form-row-2">
      <div><label class="field-label">지역</label><select id="${prefix}-region">${regionOpts}</select></div>
      <div><label class="field-label">고교 종류</label><select id="${prefix}-type">${typeOpts}</select></div>
    </div>
    <div class="flex-wrap" style="margin-top:14px">
      <button type="button" class="btn btn-primary btn-sm" id="${prefix}-search">🔍 검색하기</button>
      ${showGeo ? `<button type="button" class="btn btn-secondary btn-sm" id="${prefix}-geo">📍 내 위치</button>` : ""}
      <a href="#/student/explore" class="btn btn-secondary btn-sm">🏫 탐색 페이지</a>
    </div>
    <p id="${prefix}-status" class="msg-info" style="margin-top:14px"></p>
    <div id="${prefix}-results"></div>
  </div>`;
}

function bindSchoolSearchBlock(prefix, opts = {}) {
  const prefs = opts.prefs || loadPrefs();
  const tags = opts.tags || [];
  let userLoc = null;

  const setStatus = (msg, isError) => {
    const el = document.getElementById(`${prefix}-status`);
    if (!el) return;
    el.className = isError ? "msg msg-error" : "msg-info";
    el.textContent = msg;
  };

  const renderResults = (schools, note) => {
    const el = document.getElementById(`${prefix}-results`);
    if (!el) return;
    if (!schools.length) {
      el.innerHTML = '<p class="msg-info">조건에 맞는 학교가 없습니다. 지역이나 종류를 바꿔 보세요.</p>';
      return;
    }
    const ranked = recommendSchools(schools, {
      tags,
      userRegion: document.getElementById(`${prefix}-region`)?.value,
      userLat: userLoc?.lat,
      userLng: userLoc?.lng,
    });
    const list = (ranked.length ? ranked : schools).slice(0, 15);
    el.innerHTML = `<p class="card-sub" style="margin-bottom:10px">${esc(note)} · ${list.length}곳</p>
      ${list.map(s => renderSchoolCard(s, { highlight: (s.score || 0) > 20, prefs })).join("")}`;
    bindWishButtons(prefs);
  };

  const runSearch = async () => {
    const region = document.getElementById(`${prefix}-region`)?.value || "경기";
    const sch1 = document.getElementById(`${prefix}-type`)?.value || "전체";
    setStatus("학교 정보를 불러오는 중…");
    try {
      const { schools, fromApi } = await fetchSchoolsByFilter(region, sch1);
      const note = fromApi ? "커리어넷 학교정보 API" : "참고용 샘플 데이터 (API 미연동 시)";
      setStatus(`${region} · ${HIGH_SCHOOL_TYPES.find(t => t.value === sch1)?.label || "전체"} 검색 완료`);
      renderResults(schools, note);
    } catch (e) {
      setStatus(e.message || "검색에 실패했습니다.", true);
    }
  };

  document.getElementById(`${prefix}-search`)?.addEventListener("click", runSearch);
  document.getElementById(`${prefix}-geo`)?.addEventListener("click", async () => {
    setStatus("위치 정보를 확인하는 중…");
    try {
      userLoc = await detectUserLocation();
      if (userLoc.region && userLoc.region !== "전체") {
        const sel = document.getElementById(`${prefix}-region`);
        if (sel) sel.value = userLoc.region;
      }
      setStatus(`📍 ${userLoc.label || userLoc.region} 기준으로 검색합니다.`);
      await runSearch();
    } catch (e) {
      setStatus(e.message || "위치를 가져올 수 없습니다.", true);
    }
  });

  if (opts.autoSearch) runSearch();
}

function renderUniGuides(tags) {
  return `<div class="guide-grid">${universityGuidesForTags(tags).map(g => `<div class="card card-sky">
    <div class="card-title">🎓 ${esc(g.label)}</div>
    <p style="font-size:11px;font-weight:800;color:var(--slate-400);margin-top:12px;text-transform:uppercase">관련 학과</p>
    <p style="font-size:14px;margin-top:4px;line-height:1.5">${esc(g.majors.join(" · "))}</p>
    <p style="font-size:11px;font-weight:800;color:var(--slate-400);margin-top:12px;text-transform:uppercase">고교에서 준비</p>
    <ul style="font-size:13px;padding-left:18px;margin-top:4px;color:var(--slate-600);line-height:1.55">${g.fromHighSchool.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
  </div>`).join("")}</div>`;
}

function renderCareerCards(tags) {
  const colors = ["indigo", "violet", "sky", "emerald", "amber"];
  return `<div class="guide-grid">${careerCardsForTags(tags).map((c, i) => `<div class="card">
    <div class="card-head"><span class="icon-box ${colors[i % colors.length]}">💼</span>
    <div class="card-title">${esc(c.label)}</div></div>
    <p style="font-size:14px;margin-top:4px;line-height:1.55"><b style="color:var(--indigo)">직업</b> · ${esc(c.jobs.join(", "))}</p>
    <p style="font-size:14px;margin-top:8px;line-height:1.55"><b style="color:var(--violet)">학과</b> · ${esc(c.majors.join(", "))}</p>
  </div>`).join("")}</div>`;
}

function renderDiscussion(sessionId, studentId, role, shareUrl) {
  const msgs = listFamilyMessages(sessionId, studentId);
  const labels = { teacher: "교사", parent: "학부모", student: "학생" };
  return `<div class="card" id="discussion-panel">
    <div class="card-head"><span class="icon-box emerald">💬</span><div>
      <div class="card-title">교사·학부모·학생 상담 나눔</div>
      <p class="card-sub">진로목표와 고교·대학 방향에 대해 함께 의견을 남기세요.</p>
    </div></div>
    ${shareUrl ? `<button type="button" class="btn btn-secondary btn-sm no-print" id="copy-family-link">학부모 공유 링크 복사</button>
    <p class="msg-info" style="word-break:break-all;margin-top:8px">${esc(shareUrl)}</p>` : ""}
    <div class="discussion-box">${msgs.length ? msgs.map(m => `
      <div class="discussion-msg ${m.authorRole}"><div class="discussion-meta">${esc(m.authorLabel)} · ${new Date(m.createdAt).toLocaleString("ko-KR")}</div>${esc(m.body)}</div>`).join("") : '<p class="msg-info">아직 나눈 이야기가 없습니다.</p>'}</div>
    <label class="field-label">이름</label><input type="text" id="disc-author" value="${labels[role]}" />
    <label class="field-label">메시지</label><textarea id="disc-body" placeholder="진로·고교·대학에 대한 생각"></textarea>
    <button type="button" class="btn btn-primary" id="disc-post" style="margin-top:12px">메시지 남기기</button>
  </div>`;
}

function bindDiscussion(sessionId, studentId, role, shareUrl) {
  document.getElementById("disc-post")?.addEventListener("click", () => {
    const body = document.getElementById("disc-body")?.value.trim();
    const authorLabel = document.getElementById("disc-author")?.value.trim() || role;
    if (!body) return;
    addFamilyMessage(sessionId, studentId, { authorRole: role, authorLabel, body });
    render();
  });
  document.getElementById("copy-family-link")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shareUrl); alert("링크를 복사했습니다."); } catch { alert("복사에 실패했습니다."); }
  });
}

function renderGoalForm(prefs, pathPlan, tags, testName) {
  const g = loadCareerGoal(prefs) || {};
  return `<div class="card" id="goal-form">
    <div class="card-head"><span class="icon-box violet">🎯</span><div>
      <div class="card-title">나의 진로목표 설정</div>
      <p class="card-sub">자유학기를 통해 나를 알아가고, 꿈 직업과 고교·대학 방향을 적어 두세요.</p>
    </div></div>
    <label class="field-label">꿈 직업·진로</label><input type="text" id="g-dream" value="${esc(g.dreamJob || "")}" placeholder="${esc(pathPlan.goalExample)}" />
    <label class="field-label">나를 알게 된 점</label><textarea id="g-why">${esc(g.why || "")}</textarea>
    <label class="field-label">자유학기·진로 탐색 계획</label><textarea id="g-free">${esc(g.freeSemesterPlan || pathPlan.freeSemester.actions.slice(0,2).join(" / "))}</textarea>
    <label class="field-label">고등학교 진학 방향</label><input type="text" id="g-hs" value="${esc(g.highSchoolDirection || "")}" />
    <label class="field-label">대학·그 이후 진로 방향</label><input type="text" id="g-uni" value="${esc(g.universityDirection || "")}" />
    <label class="field-label">지금 실천할 1가지</label><input type="text" id="g-action" value="${esc(g.thisYearAction || pathPlan.middlePrep.actions[0] || "")}" />
    <button type="button" class="btn btn-primary" id="g-save" style="margin-top:16px">진로목표 저장 · 교사·학부모와 공유</button>
    <p id="g-msg" class="hidden msg msg-success">저장되었습니다.</p>
  </div>`;
}

function bindGoalForm(prefs, tags, testName) {
  document.getElementById("g-save")?.addEventListener("click", () => {
    const goal = saveCareerGoal(prefs, {
      dreamJob: document.getElementById("g-dream").value.trim(),
      why: document.getElementById("g-why").value.trim(),
      freeSemesterPlan: document.getElementById("g-free").value.trim(),
      highSchoolDirection: document.getElementById("g-hs").value.trim(),
      universityDirection: document.getElementById("g-uni").value.trim(),
      thisYearAction: document.getElementById("g-action").value.trim(),
    });
    publishSnapshot(prefs, goal, { interestTags: tags, testDisplayName: testName });
    const msg = document.getElementById("g-msg");
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 2500);
  });
}

/* ── Pages ── */
function pageHome() {
  const steps = ["①", "②", "③"];
  app.innerHTML = `
    <div class="hero">
      <p class="hero-kicker">중학교 · 자유학기 · 진로연계</p>
      <h1>자유학기부터 나를 알아가고<br>고교·대학까지 이어지는 진로 여정</h1>
      <p>검사·체험으로 나를 탐색하고 진로목표를 세운 뒤, 고교·대학 진학 가이드를 함께 설계합니다.</p>
      <div class="hero-actions">
        <a href="#/student/path" class="btn btn-white">✨ 진로목표·경로 보기</a>
        <a href="#/student" class="btn btn-ghost">🎒 학생 홈</a>
        <a href="#/teacher" class="btn btn-ghost">📋 교사·상담</a>
        <a href="#/family" class="btn btn-ghost">👨‍👩‍👧 학부모·가족</a>
      </div>
    </div>
    <div class="step-grid">${MIDDLE_JOURNEY.map((j, i) => `
      <div class="step-card">
        <span class="step-num">${steps[i]}</span>
        <p class="step-label">${esc(j.grade)}</p>
        <p class="step-title">${esc(j.focus)}</p>
        <p class="step-desc">${esc(j.desc)}</p>
      </div>`).join("")}</div>
    <div class="feature-row mt-lg">
      <div class="feature-card">
        <span class="icon-box indigo">🧭</span>
        <div class="card-title">진로목표·경로</div>
        <p class="card-sub">자유학기 → 고교 → 대학까지 단계별로 안내합니다.</p>
      </div>
      <div class="feature-card">
        <span class="icon-box violet">📝</span>
        <div class="card-title">진로심리검사</div>
        <p class="card-sub">관심 분야를 찾고 맞춤 경로를 받습니다.</p>
      </div>
      <div class="feature-card">
        <span class="icon-box emerald">💬</span>
        <div class="card-title">가족·교사 상담</div>
        <p class="card-sub">목표와 고민을 함께 나눌 수 있습니다.</p>
      </div>
    </div>`;
}

function pageStudent() {
  const prefs = loadPrefs();
  const session = prefs.sessionId ? getSessionById(prefs.sessionId) : null;
  app.innerHTML = `${pageHeader("학생", "🎒 학생 홈", "반에 연결하고 검사·진로목표·고교 탐색을 진행해 보세요.")}
    ${session ? `<div class="card card-indigo">
      <div class="card-head"><span class="icon-box indigo">✅</span><div>
        <div class="card-title">${esc(session.title)} · 학번 ${esc(prefs.studentId || "—")}</div>
        <p class="card-sub">${esc(session.schoolName)} · ${esc(session.region)}</p>
      </div></div></div>` :
      `<div class="card join-card">
        <div class="card-head"><span class="icon-box amber">🔑</span><div>
          <div class="card-title">반에 입장하기</div>
          <p class="card-sub">반 코드와 학번을 입력하면 검사 결과가 교사와 공유됩니다.</p>
        </div></div>
        <label class="field-label">반 코드</label><input type="text" id="join-code" placeholder="예: A1B2C3D4" style="text-transform:uppercase;font-family:monospace;font-weight:600" />
        <label class="field-label">학번</label><input type="text" id="join-sid" placeholder="예: 30102" />
        <button type="button" class="btn btn-primary btn-block" id="join-btn" style="margin-top:16px">🚀 반 입장</button>
        <p id="join-err" class="hidden msg msg-error"></p></div>`}
    <div class="menu-grid">
      ${menuTile("#/student/tests", "📋", "violet", "진로심리검사", "관심 분야를 찾고 나에게 맞는 경로를 받아요.")}
      ${menuTile("#/student/path", "🎯", "indigo", "진로목표·경로", "자유학기 → 고교 → 대학 가이드와 상담.")}
      ${menuTile("#/student/result", "✨", "sky", "검사 결과", "관심 태그·경로·가이드를 한눈에.")}
      ${menuTile("#/student/explore", "🏫", "emerald", "고등학교 탐색", "지역별 고교 목록과 위시리스트.")}
    </div>`;
  document.getElementById("join-btn")?.addEventListener("click", () => {
    const code = document.getElementById("join-code").value.trim().toUpperCase();
    const sid = document.getElementById("join-sid").value.trim();
    const sess = getSessionByCode(code);
    const err = document.getElementById("join-err");
    if (!sess || !sid) { err.textContent = "올바른 반 코드와 학번을 입력하세요."; err.classList.remove("hidden"); return; }
    savePrefs({ sessionId: sess.id, studentId: sid, region: sess.region });
    render();
  });
}

async function pageTests() {
  app.innerHTML = `${pageHeader("검사", "📋 검사 선택", "마음에 드는 검사를 고르면 문항이 차례로 나와요.")}<div id="test-list"><p class="msg-info">목록 불러오는 중…</p></div>`;
  const listEl = document.getElementById("test-list");
  let html = V1_CATALOG.map(t => `<div class="card"><div class="card-head"><span class="icon-box violet">📝</span><div>
    <div class="card-title">${esc(t.title)}</div><p class="card-sub">${esc(t.summary)}</p></div></div>
    <a href="#/student/test?kind=v1&q=${encodeURIComponent(t.q)}&title=${encodeURIComponent(t.title)}" class="btn btn-primary btn-sm">시작하기 →</a></div>`).join("");
  const v2 = await fetchV2TestList();
  if (v2.ok) {
    const items = extractV2TestList(v2.data).slice(0, 12);
    html += items.map(t => `<div class="card"><div class="card-title">${esc(t.title)}</div>
      <a href="#/student/test?kind=v2&testNo=${encodeURIComponent(t.testNo)}&title=${encodeURIComponent(t.title)}" class="btn btn-primary btn-sm">시작하기 →</a></div>`).join("");
  }
  listEl.innerHTML = html || '<p class="msg-error">검사 목록을 불러올 수 없습니다. API 키를 확인하세요.</p>';
}

async function pageTest(query) {
  const { kind, q, testNo, title } = query;
  if (!testState || testState.key !== `${kind}-${q || testNo}`) {
    app.innerHTML = `${pageHeader("검사", esc(title || "검사"), "문항을 불러오고 있어요…")}<p class="msg-info">잠시만 기다려 주세요.</p>`;
    const res = kind === "v1" ? await fetchV1Questions(q) : await fetchV2Questions(testNo);
    if (!res.ok) { app.innerHTML = `<p class="msg-error">${esc(res.error)}</p><a href="#/student/tests" class="btn btn-secondary">돌아가기</a>`; return; }
    const questions = normalizeInspctQuestions(res.data);
    if (!questions?.length) { app.innerHTML = `<p class="msg-error">문항을 만들 수 없습니다.</p><a href="#/student/tests" class="btn btn-secondary">돌아가기</a>`; return; }
    testState = { key: `${kind}-${q || testNo}`, kind, title: title || "검사", questions, step: 0, answers: {} };
  }
  const { questions, step, answers } = testState;
  if (step >= questions.length) {
    const labels = questions.map(qq => (qq.options.find(o => o.id === answers[qq.id]) || {}).label || "").filter(Boolean);
    const tags = inferTagsFromLabels(labels);
    const prefs = loadPrefs();
    saveTestResult(prefs, { tags, testDisplayName: testState.title, testKind: kind, savedAt: new Date().toISOString() });
    if (prefs.sessionId) addSubmission(prefs.sessionId, { studentId: prefs.studentId || "미입력", interestTags: tags, testVersion: kind, testName: testState.title });
    testState = null;
    navigate("#/student/result");
    return;
  }
  const qn = questions[step];
  const pct = Math.round(((step) / questions.length) * 100);
  app.innerHTML = `<a href="#/student/tests" class="back-link">← 검사 목록</a>
    <h1 class="page-title" style="margin-top:8px">${esc(testState.title)}</h1>
    <p class="test-step-label">${step + 1} / ${questions.length} 문항</p>
    <div class="test-progress"><div class="test-progress-bar" style="width:${pct}%"></div></div>
    <div class="card"><p class="test-question">${esc(qn.prompt)}</p>
    ${qn.options.map(o => `<button type="button" class="test-option ${answers[qn.id] === o.id ? "selected" : ""}" data-qid="${esc(qn.id)}" data-oid="${esc(o.id)}">${esc(o.label)}</button>`).join("")}</div>
    <div class="flex-wrap" style="margin-top:16px">
      ${step > 0 ? `<button type="button" class="btn btn-secondary" id="test-prev">이전</button>` : ""}
      <button type="button" class="btn btn-primary" id="test-next" ${answers[qn.id] ? "" : "disabled"}>${step === questions.length - 1 ? "완료" : "다음"}</button>
    </div>`;
  app.querySelectorAll(".test-option").forEach(btn => btn.addEventListener("click", () => {
    testState.answers[btn.dataset.qid] = btn.dataset.oid;
    render();
  }));
  document.getElementById("test-prev")?.addEventListener("click", () => { testState.step--; render(); });
  document.getElementById("test-next")?.addEventListener("click", () => { if (testState.answers[qn.id]) testState.step++; render(); });
}

function pageResult() {
  const prefs = loadPrefs();
  const result = loadLatestResult(prefs);
  const goal = loadCareerGoal(prefs);
  if (!result) {
    app.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <h1 class="page-title">아직 결과가 없어요</h1>
      <p class="page-sub">검사를 먼저 하면 관심 분야와 맞춤 경로를 볼 수 있어요.</p>
      <div class="flex-wrap">
        <a href="#/student/tests" class="btn btn-primary">검사하러 가기</a>
        <a href="#/student/path" class="btn btn-secondary">진로목표·경로</a>
      </div></div>`;
    return;
  }
  const tags = result.tags?.length ? result.tags : ["default"];
  const path = pathForTags(tags);
  app.innerHTML = `${pageHeader("결과", "✨ 나의 진로 요약", result.testDisplayName ? `${esc(result.testDisplayName)} · ${new Date(result.savedAt).toLocaleDateString("ko-KR")}` : "")}
    <div class="flex-wrap no-print">
      <a href="#/student/path" class="btn btn-primary">🎯 진로목표·상세</a>
      <a href="#/student/print" class="btn btn-secondary">🖨️ 가정 공유용 인쇄</a>
      <a href="#/student/explore" class="btn btn-secondary">🏫 고등학교 탐색</a>
    </div>
    ${goal?.dreamJob ? `<div class="goal-highlight mt-lg">
      <p class="goal-highlight-label">나의 진로목표</p>
      <p class="goal-highlight-text">${esc(goal.dreamJob)}</p>
      ${goal.highSchoolDirection ? `<p style="font-size:14px;margin-top:8px;color:var(--slate-600)"><b>고교</b> ${esc(goal.highSchoolDirection)}</p>` : ""}
      ${goal.universityDirection ? `<p style="font-size:14px;margin-top:4px;color:var(--slate-600)"><b>대학·진로</b> ${esc(goal.universityDirection)}</p>` : ""}
    </div>` : ""}
    <div class="card mt-lg"><p style="font-size:11px;font-weight:800;color:var(--slate-400);text-transform:uppercase;letter-spacing:0.06em">관심 태그</p>
      <div style="margin-top:10px">${tags.map(t => `<span class="tag tag-indigo">#${esc(tagLabel(t))}</span>`).join("")}</div></div>
    <h2 class="section-title">나에게 맞는 직업·학과</h2>${renderCareerCards(tags)}
    <h2 class="section-title">자유학기 → 고교 → 대학 경로</h2><div class="card">${renderTimeline(path)}</div>
    <h2 class="section-title">고등학교 진학 가이드</h2>${renderSchoolGuides()}
    <h2 class="section-title">대학 진학 가이드</h2>${renderUniGuides(tags)}`;
}

function pagePath() {
  const prefs = loadPrefs();
  const session = prefs.sessionId ? getSessionById(prefs.sessionId) : null;
  const result = loadLatestResult(prefs);
  const tags = result?.tags?.length ? result.tags : ["default"];
  const path = pathForTags(tags);
  const shareUrl = session && prefs.studentId ? `${location.origin}${location.pathname}#/family/${session.code}/${encodeURIComponent(prefs.studentId.trim())}` : "";
  app.innerHTML = `${pageHeader("진로 탐색 · 상담", "🎯 나를 알아가는 진로 여정", "자유학기 → 진로목표 → 고교·대학 진학까지 함께 설계합니다.")}
    ${!result ? `<div class="card card-amber"><div class="card-head"><span class="icon-box amber">💡</span><div>
      <div class="card-title">검사를 먼저 해보세요</div>
      <p class="card-sub">검사를 하면 관심 분야에 맞는 맞춤 가이드가 채워져요.</p></div></div>
      <a href="#/student/tests" class="btn btn-primary" style="margin-top:12px">📋 검사하러 가기</a></div>` :
      `<div class="card">${tags.map(t => `<span class="tag tag-indigo">${esc(tagLabel(t))}</span>`).join("")}</div>`}
    ${renderGoalForm(prefs, path, tags, result?.testDisplayName)}
    ${session && prefs.studentId ? renderDiscussion(session.id, prefs.studentId.trim(), "student", shareUrl) :
      `<div class="card"><p style="font-size:14px">교사·학부모와 상담하려면 <a href="#/student">반에 연결</a>해 주세요.</p></div>`}
    <h2 class="section-title">${esc(FREE_SEMESTER.title)}</h2><div class="card"><p class="card-sub">${esc(FREE_SEMESTER.summary)}</p>
      <div class="grid-2" style="margin-top:16px">${FREE_SEMESTER.pillars.map(p => `<div style="padding:12px;background:var(--slate-50);border-radius:12px">
        <b style="font-size:14px;color:var(--indigo)">${esc(p.title)}</b>
        <p style="font-size:13px;color:var(--slate-600);margin-top:6px;line-height:1.55">${esc(p.body)}</p></div>`).join("")}</div></div>
    <h2 class="section-title">고등학교 진학 가이드</h2>${renderSchoolGuides()}${renderSchoolSearchBlock("path-hs", { tags, defaultRegion: session?.region || prefs.region || "경기" })}
    <h2 class="section-title">대학 진학 가이드</h2>${renderUniGuides(tags)}
    <h2 class="section-title">경로 타임라인</h2><div class="card">${renderTimeline(path)}</div>`;
  bindGoalForm(prefs, tags, result?.testDisplayName);
  bindSchoolSearchBlock("path-hs", { prefs, tags, autoSearch: true });
  if (session && prefs.studentId) bindDiscussion(session.id, prefs.studentId.trim(), "student", shareUrl);
}

function renderSchoolCard(s, opts = {}) {
  const prefs = opts.prefs || loadPrefs();
  const badges = (s.reasons || []).map(r => `<span class="tag tag-indigo">${esc(r)}</span>`).join("");
  const meta = [
    s.schoolType ? esc(s.schoolType) : "",
    s.distanceKm != null ? `약 ${s.distanceKm}km` : "",
    s.source === "reference" ? "참고 데이터" : "",
  ].filter(Boolean).join(" · ");
  return `<div class="card school-row ${opts.highlight ? "card-emerald" : ""}">
    <div style="flex:1">
      <b style="font-size:15px">${esc(s.name)}</b>
      ${meta ? `<br><span style="font-size:12px;color:var(--indigo);font-weight:600">${meta}</span>` : ""}
      ${s.address ? `<br><span style="font-size:13px;color:var(--slate-600)">${esc(s.address)}</span>` : ""}
      ${badges ? `<div style="margin-top:8px">${badges}</div>` : ""}
    </div>
    <button type="button" class="btn-heart wish-add" data-id="${esc(s.id)}" data-name="${esc(s.name)}" title="위시리스트">♡</button></div>`;
}

function bindWishButtons(prefs, onUpdate) {
  document.querySelectorAll(".wish-add").forEach(btn => btn.addEventListener("click", () => {
    toggleWishlist(prefs, { id: btn.dataset.id, name: btn.dataset.name });
    onUpdate?.();
  }));
}

async function loadExploreSchools(region, tags, location) {
  const poolRegion = region && region !== "전체" ? region : (location?.region || "전체");
  const { schools, fromApi } = await fetchSchoolsForExplore(poolRegion, tags);
  exploreSchools = schools;
  exploreSourceNote = fromApi
    ? "커리어넷 학교정보 API"
    : "API 응답이 없어 참고용 샘플 고교 목록을 표시합니다. (학교정보 API 키 권한 확인 필요)";
  const recOpts = {
    tags,
    userRegion: location?.region || poolRegion,
    userLat: location?.lat,
    userLng: location?.lng,
  };
  exploreRecommended = recommendSchools(schools, recOpts);
  if (!exploreRecommended.length && schools.length) exploreRecommended = schools.slice(0, 8).map(s => ({ ...s, reasons: ["지역 목록"] }));
}

async function pageExplore() {
  const prefs = loadPrefs();
  const session = prefs.sessionId ? getSessionById(prefs.sessionId) : null;
  const result = loadLatestResult(prefs);
  const tags = result?.tags?.length ? result.tags : [];
  if (exploreRegion === "전체" && (session?.region || prefs.region)) {
    exploreRegion = session?.region || prefs.region || "전체";
  }

  app.innerHTML = `${pageHeader("탐색", "🏫 고등학교 탐색·추천", "검사 결과와 내 위치를 바탕으로 고교 후보를 추천해요.")}
    <div id="explore-status" class="msg-info" style="margin-bottom:14px">학교 정보를 불러오는 중…</div>
    <div class="flex-wrap no-print" style="margin-bottom:16px">
      <button type="button" class="btn btn-primary" id="explore-geo">📍 내 위치 기준 추천</button>
      <button type="button" class="btn btn-secondary" id="explore-test" ${tags.length ? "" : "disabled"}>✨ 검사 결과 기준 추천</button>
    </div>
    ${tags.length ? `<div class="card card-indigo" style="padding:14px 18px;margin-bottom:14px">
      <span style="font-size:12px;font-weight:700;color:var(--indigo)">나의 관심 분야</span>
      <div style="margin-top:8px">${tags.map(t => `<span class="tag tag-indigo">${esc(tagLabel(t))}</span>`).join("")}</div>
    </div>` : `<div class="card card-amber" style="margin-bottom:14px"><p class="card-sub">검사를 하면 관심 분야에 맞는 고교 유형을 추천해 드려요. <a href="#/student/tests">검사하러 가기</a></p></div>`}
    <div id="explore-recommended-wrap"></div>
    <h2 class="section-title">지역별 목록</h2>
    <div class="card">
      <label class="field-label">시·도</label>
      <select id="explore-region">${REGIONS.map(r => `<option value="${r}" ${r === exploreRegion ? "selected" : ""}>${r}</option>`).join("")}</select>
      <button type="button" class="btn btn-primary" id="explore-load" style="margin-top:14px">🔍 목록 불러오기</button>
    </div>
    <div id="explore-list"></div>
    <h2 class="section-title">♥ 위시리스트</h2><div id="wishlist"></div>`;

  const renderWish = () => {
    const wl = loadWishlist(prefs);
    document.getElementById("wishlist").innerHTML = wl.length ?
      wl.map(s => `<div class="card school-row card-sky">
        <div><span style="font-size:18px;margin-right:8px">♥</span><b style="font-size:15px">${esc(s.name)}</b></div></div>`).join("") :
      '<p class="msg-info">아직 담은 학교가 없어요. 추천·목록에서 ♡ 버튼을 눌러 보세요.</p>';
  };

  const renderRecommended = () => {
    const el = document.getElementById("explore-recommended-wrap");
    if (!el) return;
    if (!exploreRecommended.length) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = `<h2 class="section-title">✨ 맞춤 추천</h2>
      <p class="card-sub" style="margin:-8px 0 12px">${esc(exploreSourceNote)}</p>
      ${exploreRecommended.map(s => renderSchoolCard(s, { highlight: true, prefs })).join("")}`;
    bindWishButtons(prefs, renderWish);
  };

  const renderList = () => {
    document.getElementById("explore-list").innerHTML = exploreSchools.length ?
      exploreSchools.map(s => renderSchoolCard(s, { prefs })).join("") :
      '<p class="msg-info">목록이 없습니다. 지역을 선택하고 불러오기를 누르세요.</p>';
    bindWishButtons(prefs, renderWish);
  };

  const setStatus = (msg, type = "info") => {
    const el = document.getElementById("explore-status");
    if (!el) return;
    el.className = type === "error" ? "msg msg-error" : "msg-info";
    el.textContent = msg;
  };

  const refresh = async ({ useGeo = false, useTest = false } = {}) => {
    setStatus("학교 정보를 분석하는 중…");
    try {
      if (useGeo) {
        exploreLocation = await detectUserLocation();
        if (exploreLocation.region && exploreLocation.region !== "전체") {
          exploreRegion = exploreLocation.region;
          const sel = document.getElementById("explore-region");
          if (sel) sel.value = exploreRegion;
        }
        setStatus(`📍 ${exploreLocation.label || exploreLocation.region} 기준으로 추천합니다.`);
      }
      const activeTags = useTest && tags.length ? tags : (tags.length ? tags : undefined);
      await loadExploreSchools(exploreRegion, activeTags, exploreLocation);
      renderRecommended();
      renderList();
      renderWish();
      if (!useGeo) setStatus(exploreSourceNote);
    } catch (e) {
      setStatus(e.message || "고교 정보를 불러오지 못했습니다.", "error");
      await loadExploreSchools(exploreRegion, tags.length ? tags : undefined, exploreLocation);
      renderRecommended();
      renderList();
    }
  };

  document.getElementById("explore-geo").addEventListener("click", () => refresh({ useGeo: true, useTest: tags.length > 0 }));
  document.getElementById("explore-test")?.addEventListener("click", () => refresh({ useTest: true }));
  document.getElementById("explore-load").addEventListener("click", () => {
    exploreRegion = document.getElementById("explore-region").value;
    refresh({ useTest: tags.length > 0 });
  });

  renderWish();
  await refresh({ useTest: tags.length > 0 });
}

function pagePrint() {
  const prefs = loadPrefs();
  const session = prefs.sessionId ? getSessionById(prefs.sessionId) : null;
  const result = loadLatestResult(prefs);
  const goal = loadCareerGoal(prefs);
  if (!result) { navigate("#/student/result"); return; }
  const summary = buildParentSummary({ testName: result.testDisplayName || "진로검사", savedAt: result.savedAt, tags: result.tags,
    schoolName: session?.schoolName, classTitle: session?.title, studentId: prefs.studentId, careerGoal: goal });
  app.innerHTML = `<div class="no-print flex-wrap"><a href="#/student/result" class="btn btn-secondary">← 결과로</a>
    <button type="button" class="btn btn-primary" onclick="window.print()">🖨️ 인쇄 / PDF 저장</button></div>
    <article class="card" style="margin-top:20px;border:2px solid #c7d2fe">
      <div class="card-head"><span class="icon-box indigo">📄</span><div>
        <h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em">${esc(summary.title)}</h1>
        <p class="card-sub">가정에서 함께 읽을 수 있는 진로 요약입니다.</p>
      </div></div>
    ${summary.sections.map(s => `<section style="margin-top:24px;padding-top:20px;border-top:1px solid var(--slate-200)">
      <h2 style="font-size:12px;font-weight:800;color:var(--indigo);text-transform:uppercase;letter-spacing:0.06em">${esc(s.heading)}</h2>
      <p style="font-size:14px;margin-top:10px;white-space:pre-line;line-height:1.65;color:var(--slate-600)">${esc(s.body)}</p></section>`).join("")}</article>`;
}

function pageTeacher() {
  const sessions = listSessions();
  app.innerHTML = `${pageHeader("교사", "📋 교사·상담", "반을 만들고 학생 검사·진로목표·상담을 한곳에서 관리해요.")}
    <a href="#/teacher/new" class="btn btn-primary btn-block" style="margin-bottom:24px">➕ 새 반 만들기</a>
    <h2 class="section-title">내 반 목록</h2>
    ${sessions.length ? sessions.map(s => `<div class="card">
      <div class="card-head"><span class="icon-box indigo">🏫</span><div style="flex:1">
        <a href="#/teacher/session/${s.id}" class="card-title" style="text-decoration:none;color:inherit;display:block">${esc(s.title)}</a>
        <p class="card-sub" style="margin-top:6px">입장 코드 <b style="font-family:monospace;letter-spacing:1px;color:var(--indigo)">${esc(s.code)}</b> · ${esc(s.schoolName)}</p>
        <p class="card-sub" style="margin-top:4px">검사 제출 <b>${s.submissions.length}</b>건</p>
      </div><span class="menu-tile-arrow">→</span></div></div>`).join("") :
      `<div class="empty-state" style="padding:32px 24px">
        <div class="empty-icon">📋</div>
        <p class="page-sub" style="margin:0 auto">아직 만든 반이 없어요. 위 버튼으로 첫 반을 만들어 보세요.</p></div>`}`;
}

function pageTeacherNew() {
  app.innerHTML = `<a href="#/teacher" class="back-link">← 목록</a>
    ${pageHeader("교사", "➕ 새 반 만들기", "반 정보를 입력하면 학생들에게 공유할 입장 코드가 만들어져요.")}
    <div class="card join-card">
      <label class="field-label">반 이름</label><input type="text" id="t-title" placeholder="예: 1학년 3반" />
      <label class="field-label">시·도</label><select id="t-region">${REGIONS.map(r => `<option value="${r}">${r}</option>`).join("")}</select>
      <label class="field-label">학교명</label><input type="text" id="t-school" placeholder="예: ○○중학교" />
      <label class="field-label">교사 PIN (선택)</label><input type="password" id="t-pin" placeholder="4자리 이상 — 상담 화면 잠금" />
      <button type="button" class="btn btn-primary btn-block" id="t-create" style="margin-top:16px">🚀 반 생성하기</button></div>`;
  document.getElementById("t-create").addEventListener("click", async () => {
    const pin = document.getElementById("t-pin").value;
    const hash = pin.trim() ? await hashPin(pin) : "";
    const s = createSession({ title: document.getElementById("t-title").value, region: document.getElementById("t-region").value,
      schoolName: document.getElementById("t-school").value, teacherPinHash: hash });
    navigate(`#/teacher/session/${s.id}`);
  });
}

function pageSession(id) {
  const session = getSessionById(id);
  if (!session) { navigate("#/teacher"); return; }
  if (session.teacherPinHash && !isTeacherUnlocked(id)) {
    app.innerHTML = `${pageHeader("교사", "🔒 PIN 입력", "이 반은 교사 PIN으로 보호되어 있어요.")}
      <div class="card join-card">
        <label class="field-label">교사 PIN</label>
        <input type="password" id="pin-in" placeholder="PIN 입력" />
        <button type="button" class="btn btn-primary btn-block" id="pin-btn" style="margin-top:16px">잠금 해제</button></div>`;
    document.getElementById("pin-btn").addEventListener("click", async () => {
      if (await verifyPin(document.getElementById("pin-in").value, session.teacherPinHash)) { setTeacherUnlocked(id, true); render(); }
      else alert("PIN이 올바르지 않습니다.");
    });
    return;
  }
  const byStudent = {};
  for (const sub of session.submissions) {
    if (!byStudent[sub.studentId]) byStudent[sub.studentId] = [];
    byStudent[sub.studentId].push(sub);
  }
  app.innerHTML = `<a href="#/teacher" class="back-link">← 목록</a>
    ${pageHeader("반 관리", esc(session.title), `${esc(session.schoolName)} · ${esc(session.region)}`)}
    <div class="card card-indigo">
      <div class="card-head"><span class="icon-box indigo">🔑</span><div>
        <p class="goal-highlight-label">학생 입장 코드</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:4px;font-family:monospace;margin-top:6px;color:var(--indigo)">${esc(session.code)}</p>
        <p class="card-sub" style="margin-top:10px">학생은 <b>🎒 학생</b> 메뉴에서 코드와 학번을 입력해 입장해요.</p>
      </div></div></div>
    <div class="flex-wrap no-print">
      <button type="button" class="btn btn-secondary" id="export-btn">💾 JSON 백업</button>
      <label class="btn btn-secondary" style="cursor:pointer">📂 JSON 복원<input type="file" id="import-file" accept=".json" hidden /></label>
    </div>
    <h2 class="section-title">학생별 상담</h2>
    ${Object.keys(byStudent).length ? Object.entries(byStudent).map(([sid]) => `<div class="card">
      <div class="card-head"><span class="icon-box violet">👤</span><div style="flex:1">
        <a href="#/teacher/session/${id}/student/${encodeURIComponent(sid)}" class="card-title" style="text-decoration:none;color:inherit">학번 ${esc(sid)}</a>
        <p class="card-sub">검사 제출 ${byStudent[sid].length}건</p>
      </div><span class="menu-tile-arrow">→</span></div></div>`).join("") :
      `<div class="empty-state" style="padding:32px 24px">
        <div class="empty-icon">👥</div>
        <p class="page-sub" style="margin:0 auto">아직 제출된 검사가 없어요. 학생들에게 입장 코드를 알려 주세요.</p></div>`}`;
  document.getElementById("export-btn")?.addEventListener("click", () => {
    const bundle = exportSessionBundle(id);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `career-${session.code}.json`; a.click();
  });
  document.getElementById("import-file")?.addEventListener("change", async e => {
    const file = e.target.files?.[0]; if (!file) return;
    const data = JSON.parse(await file.text());
    const r = importSessionBundle(data, id);
    alert(r.message); if (r.ok) render();
  });
}

function pageStudentCounsel(sessionId, studentId) {
  const session = getSessionById(sessionId);
  if (!session || !isTeacherUnlocked(sessionId)) { navigate(`#/teacher/session/${sessionId}`); return; }
  const subs = session.submissions.filter(s => s.studentId === studentId);
  const snap = loadSnapshot(sessionId, studentId);
  const goal = snap?.careerGoal || loadCareerGoalForSession(sessionId, studentId);
  const notes = listCounselingNotes(sessionId, studentId);
  const shareUrl = `${location.origin}${location.pathname}#/family/${session.code}/${encodeURIComponent(studentId)}`;
  app.innerHTML = `<a href="#/teacher/session/${sessionId}" class="back-link">← 대시보드</a>
    ${pageHeader("상담", `👤 학번 ${esc(studentId)}`, "진로목표·검사 결과·상담 메모를 확인하고 학부모와 나눠요.")}
    ${goal?.dreamJob ? `<div class="goal-highlight">
      <p class="goal-highlight-label">나의 진로목표</p>
      <p class="goal-highlight-text">${esc(goal.dreamJob)}</p>
      ${goal.highSchoolDirection ? `<p style="font-size:14px;margin-top:8px;color:var(--slate-600)"><b>고교</b> ${esc(goal.highSchoolDirection)}</p>` : ""}
      ${goal.universityDirection ? `<p style="font-size:14px;margin-top:4px;color:var(--slate-600)"><b>대학·진로</b> ${esc(goal.universityDirection)}</p>` : ""}
    </div>` : ""}
    <button type="button" class="btn btn-secondary btn-sm no-print" id="copy-link" style="margin-top:16px">🔗 학부모 링크 복사</button>
    ${renderDiscussion(sessionId, studentId, "teacher", shareUrl)}
    <h2 class="section-title">검사 제출 (${subs.length})</h2>
    ${subs.map(s => `<div class="card" style="padding:14px 18px">
      <span class="tag tag-indigo">${new Date(s.createdAt).toLocaleDateString("ko-KR")}</span>
      <b style="font-size:14px;margin-left:8px">${esc(s.testName || "검사")}</b>
      <p style="font-size:13px;color:var(--slate-600);margin-top:8px">${(s.interestTags||[]).map(tagLabel).join(" · ")}</p></div>`).join("") || '<p class="msg-info">아직 제출된 검사가 없어요.</p>'}
    <h2 class="section-title">상담 메모</h2><div class="card">
    <div class="form-row form-row-2"><div><label class="field-label">날짜</label><input type="date" id="n-date" value="${new Date().toISOString().slice(0,10)}" /></div></div>
    <label class="field-label">주제</label><input type="text" id="n-topic" placeholder="예: 고교 선택 상담" />
    <label class="field-label">메모</label><textarea id="n-memo" placeholder="상담 내용을 적어 두세요."></textarea>
    <button type="button" class="btn btn-primary" id="n-add" style="margin-top:12px">💾 메모 저장</button></div>
    ${notes.map(n => `<div class="card" style="padding:14px 18px">
      <b style="font-size:14px">${esc(n.date)} · ${esc(n.topic)}</b>
      <p style="font-size:13px;margin-top:6px;color:var(--slate-600);line-height:1.55">${esc(n.memo)}</p>
      <button type="button" class="btn btn-secondary btn-sm note-del" data-id="${n.id}" style="margin-top:10px">삭제</button></div>`).join("")}
    <button type="button" class="btn btn-secondary" id="gen-report" style="margin-top:16px">📄 보고서 초안 생성</button>
    <pre id="report-out" class="card hidden" style="font-size:12px;white-space:pre-wrap;overflow:auto;max-height:400px;margin-top:14px"></pre>`;
  bindDiscussion(sessionId, studentId, "teacher", shareUrl);
  document.getElementById("copy-link")?.addEventListener("click", () => navigator.clipboard.writeText(shareUrl).then(() => alert("복사됨")));
  document.getElementById("n-add")?.addEventListener("click", () => {
    addCounselingNote(sessionId, studentId, { date: document.getElementById("n-date").value, topic: document.getElementById("n-topic").value.trim(), memo: document.getElementById("n-memo").value.trim() });
    render();
  });
  document.querySelectorAll(".note-del").forEach(btn => btn.addEventListener("click", () => { deleteCounselingNote(sessionId, studentId, btn.dataset.id); render(); }));
  document.getElementById("gen-report")?.addEventListener("click", () => {
    const pre = document.getElementById("report-out");
    pre.textContent = buildSemesterReport({ session, studentId, submissions: subs, notes: listCounselingNotes(sessionId, studentId), careerGoal: goal });
    pre.classList.remove("hidden");
  });
}

function pageFamilyJoin() {
  app.innerHTML = `${pageHeader("가족", "👨‍👩‍👧 가족 상담 입장", "교사가 알려준 반 코드와 자녀 학번으로 입장해요.", "emerald")}
    <div class="card join-card" style="border-color:#6ee7b7">
      <div class="card-head"><span class="icon-box emerald">🔑</span><div>
        <div class="card-title">반에 입장하기</div>
        <p class="card-sub">학생의 진로목표와 상담 내용을 함께 볼 수 있어요.</p>
      </div></div>
      <label class="field-label">반 코드</label><input type="text" id="f-code" placeholder="예: A1B2C3D4" style="text-transform:uppercase;font-family:monospace;font-weight:600" />
      <label class="field-label">학번</label><input type="text" id="f-sid" placeholder="예: 30102" />
      <button type="button" class="btn btn-primary btn-block" id="f-go" style="margin-top:16px;background:linear-gradient(135deg,var(--emerald),#059669);box-shadow:0 4px 14px rgba(16,185,129,0.4)">🚀 입장하기</button></div>`;
  document.getElementById("f-go").addEventListener("click", () => {
    const c = document.getElementById("f-code").value.trim().toUpperCase();
    const sid = document.getElementById("f-sid").value.trim();
    if (!c || !sid) return alert("코드와 학번을 입력하세요.");
    navigate(`#/family/${c}/${encodeURIComponent(sid)}`);
  });
}

function pageFamily(code, studentId) {
  const session = getSessionByCode(code);
  if (!session) { app.innerHTML = `<p class="msg-error">링크가 올바르지 않습니다.</p>`; return; }
  const snap = loadSnapshot(session.id, studentId);
  const goal = snap?.careerGoal || loadCareerGoalForSession(session.id, studentId);
  const tags = snap?.interestTags?.length ? snap.interestTags : ["default"];
  const path = pathForTags(tags);
  const shareUrl = `${location.origin}${location.pathname}#/family/${code}/${encodeURIComponent(studentId)}`;
  app.innerHTML = `${pageHeader("가족 상담", `${esc(session.title)} · 학번 ${esc(studentId)}`, "자녀의 진로목표와 고교·대학 가이드를 함께 살펴보세요.", "emerald")}
    ${goal?.dreamJob ? `<div class="goal-highlight" style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-color:#a7f3d0">
      <p class="goal-highlight-label" style="color:#059669">자녀의 진로목표</p>
      <p class="goal-highlight-text">${esc(goal.dreamJob)}</p>
      ${goal.why ? `<p style="font-size:14px;margin-top:10px;color:var(--slate-600);line-height:1.55">${esc(goal.why)}</p>` : ""}
      ${goal.highSchoolDirection ? `<p style="font-size:14px;margin-top:8px;color:var(--slate-600)"><b>고교</b> ${esc(goal.highSchoolDirection)}</p>` : ""}
      ${goal.universityDirection ? `<p style="font-size:14px;margin-top:4px;color:var(--slate-600)"><b>대학·진로</b> ${esc(goal.universityDirection)}</p>` : ""}
    </div>` :
      `<div class="card card-amber"><div class="card-head"><span class="icon-box amber">💡</span><div>
        <div class="card-title">아직 진로목표가 없어요</div>
        <p class="card-sub">학생이 진로목표를 저장하면 여기에 표시돼요.</p>
      </div></div></div>`}
    ${renderDiscussion(session.id, studentId, "parent", shareUrl)}
    <h2 class="section-title">고등학교 진학 가이드</h2>${renderSchoolGuides()}
    <h2 class="section-title">대학 진학 가이드</h2>${renderUniGuides(tags)}
    <h2 class="section-title">진로 경로</h2><div class="card">${renderTimeline(path)}</div>`;
  bindDiscussion(session.id, studentId, "parent", shareUrl);
}

/* ── Router ── */
function render() {
  setActiveNav();
  const { parts, query } = getRoute();
  const p0 = parts[0] || "";
  try {
    if (!p0 || p0 === "home") pageHome();
    else if (p0 === "student" && !parts[1]) pageStudent();
    else if (p0 === "student" && parts[1] === "tests") pageTests();
    else if (p0 === "student" && parts[1] === "test") pageTest(query);
    else if (p0 === "student" && parts[1] === "result") pageResult();
    else if (p0 === "student" && parts[1] === "path") pagePath();
    else if (p0 === "student" && parts[1] === "explore") pageExplore();
    else if (p0 === "student" && parts[1] === "print") pagePrint();
    else if (p0 === "teacher" && !parts[1]) pageTeacher();
    else if (p0 === "teacher" && parts[1] === "new") pageTeacherNew();
    else if (p0 === "teacher" && parts[1] === "session" && parts[2] && parts[3] === "student" && parts[4]) pageStudentCounsel(parts[2], decodeURIComponent(parts[4]));
    else if (p0 === "teacher" && parts[1] === "session" && parts[2]) pageSession(parts[2]);
    else if (p0 === "family" && !parts[1]) pageFamilyJoin();
    else if (p0 === "family" && parts[1] && parts[2]) pageFamily(parts[1], decodeURIComponent(parts[2]));
    else { app.innerHTML = `<p class="msg-error">페이지를 찾을 수 없습니다.</p><a href="#/">홈으로</a>`; }
  } catch (e) {
    console.error(e);
    app.innerHTML = `<p class="msg-error">오류가 발생했습니다.</p>`;
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", render);
if (!location.hash) location.hash = "#/";
render();
