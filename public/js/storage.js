const SESSIONS_KEY = "careernet_pathfinder_sessions";
const PREFS_KEY = "careernet_pathfinder_student";
const LEGACY_RESULT_KEY = "careernet_last_result";

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function scopeKey(prefs) {
  if (prefs.sessionId && prefs.studentId?.trim()) return `${prefs.sessionId}_${prefs.studentId.trim()}`;
  return "personal";
}

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") || {}; } catch { return {}; }
}
function savePrefs(p) {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...p }));
}

function allSessions() {
  try {
    const list = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
function saveSessions(list) { localStorage.setItem(SESSIONS_KEY, JSON.stringify(list)); }

function createSession({ title, region, schoolName, teacherPinHash }) {
  const id = uid();
  const code = id.replace(/-/g, "").slice(0, 8).toUpperCase();
  const session = { id, code, title: title.trim() || "새 반", region: region.trim() || "전체",
    schoolName: (schoolName || "").trim(), teacherPinHash: teacherPinHash || "",
    createdAt: new Date().toISOString(), submissions: [] };
  saveSessions([...allSessions(), session]);
  return session;
}
function getSessionById(id) { return allSessions().find(s => s.id === id); }
function getSessionByCode(code) { return allSessions().find(s => s.code === code.trim().toUpperCase()); }
function listSessions() { return allSessions().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); }

function addSubmission(sessionId, sub) {
  const list = allSessions();
  const idx = list.findIndex(s => s.id === sessionId);
  if (idx < 0) return null;
  const row = { ...sub, studentId: (sub.studentId || "").trim() || "미입력", id: uid(), createdAt: new Date().toISOString() };
  list[idx] = { ...list[idx], submissions: [...list[idx].submissions, row] };
  saveSessions(list);
  return list[idx];
}

function isTeacherUnlocked(sessionId) { return sessionStorage.getItem(`careernet_teacher_unlock_${sessionId}`) === "1"; }
function setTeacherUnlocked(sessionId, v) {
  const k = `careernet_teacher_unlock_${sessionId}`;
  if (v) sessionStorage.setItem(k, "1"); else sessionStorage.removeItem(k);
}

function resultKey(prefs) {
  const sid = prefs.studentId?.trim();
  return prefs.sessionId && sid ? `careernet_result_${prefs.sessionId}_${sid}` : LEGACY_RESULT_KEY;
}
function historyKey(prefs) { return `careernet_result_history_${scopeKey(prefs)}`; }

function loadLatestResult(prefs) {
  try {
    let raw = sessionStorage.getItem(resultKey(prefs));
    if (!raw && resultKey(prefs) !== LEGACY_RESULT_KEY) raw = sessionStorage.getItem(LEGACY_RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function loadResultHistory(prefs) {
  try {
    const raw = sessionStorage.getItem(historyKey(prefs));
    if (!raw) { const l = loadLatestResult(prefs); return l ? [l] : []; }
    return JSON.parse(raw) || [];
  } catch { return []; }
}
function saveTestResult(prefs, payload) {
  const record = { id: payload.id || uid(), tags: payload.tags || [], savedAt: payload.savedAt || new Date().toISOString(),
    testDisplayName: payload.testDisplayName, testKind: payload.testKind };
  sessionStorage.setItem(resultKey(prefs), JSON.stringify(record));
  const prev = loadResultHistory(prefs).filter(h => h.id !== record.id);
  sessionStorage.setItem(historyKey(prefs), JSON.stringify([record, ...prev].slice(0, 50)));
  return record;
}

function goalKey(prefs) { return `careernet_career_goal_${scopeKey(prefs)}`; }
function loadCareerGoal(prefs) {
  try { return JSON.parse(localStorage.getItem(goalKey(prefs)) || "null"); } catch { return null; }
}
function loadCareerGoalForSession(sessionId, studentId) { return loadCareerGoal({ sessionId, studentId }); }
function saveCareerGoal(prefs, goal) {
  const record = { ...goal, updatedAt: new Date().toISOString() };
  localStorage.setItem(goalKey(prefs), JSON.stringify(record));
  publishSnapshot(prefs, record);
  return record;
}

function snapshotKey(sessionId, studentId) { return `careernet_published_${sessionId}_${studentId}`; }
function publishSnapshot(prefs, careerGoal, extra = {}) {
  if (!prefs.sessionId || !prefs.studentId?.trim()) return;
  localStorage.setItem(snapshotKey(prefs.sessionId, prefs.studentId.trim()), JSON.stringify({
    updatedAt: new Date().toISOString(), careerGoal, interestTags: extra.interestTags || [], testDisplayName: extra.testDisplayName,
  }));
}
function loadSnapshot(sessionId, studentId) {
  try { return JSON.parse(localStorage.getItem(snapshotKey(sessionId, studentId)) || "null"); } catch { return null; }
}

function discussionKey(sessionId, studentId) { return `careernet_family_discussion_${sessionId}_${studentId}`; }
function listFamilyMessages(sessionId, studentId) {
  try { return JSON.parse(localStorage.getItem(discussionKey(sessionId, studentId)) || "[]") || []; } catch { return []; }
}
function addFamilyMessage(sessionId, studentId, msg) {
  const list = [...listFamilyMessages(sessionId, studentId), { ...msg, id: uid(), createdAt: new Date().toISOString() }];
  localStorage.setItem(discussionKey(sessionId, studentId), JSON.stringify(list));
  return list;
}

function counselKey(sessionId, studentId) { return `careernet_counseling_${sessionId}_${studentId}`; }
function listCounselingNotes(sessionId, studentId) {
  try { return JSON.parse(localStorage.getItem(counselKey(sessionId, studentId)) || "[]") || []; } catch { return []; }
}
function addCounselingNote(sessionId, studentId, note) {
  const list = [...listCounselingNotes(sessionId, studentId), { ...note, id: uid() }];
  localStorage.setItem(counselKey(sessionId, studentId), JSON.stringify(list));
  return list;
}
function deleteCounselingNote(sessionId, studentId, noteId) {
  const list = listCounselingNotes(sessionId, studentId).filter(n => n.id !== noteId);
  localStorage.setItem(counselKey(sessionId, studentId), JSON.stringify(list));
  return list;
}

function wishlistKey(prefs) { return `careernet_wishlist_${scopeKey(prefs)}`; }
function loadWishlist(prefs) {
  try { return JSON.parse(localStorage.getItem(wishlistKey(prefs)) || "[]") || []; } catch { return []; }
}
function toggleWishlist(prefs, school) {
  const list = loadWishlist(prefs);
  const idx = list.findIndex(s => s.id === school.id);
  if (idx >= 0) list.splice(idx, 1); else list.push(school);
  localStorage.setItem(wishlistKey(prefs), JSON.stringify(list));
  return list;
}

const PIN_SALT = "|career-class-pin-v1|";
async function hashPin(pin) {
  const data = new TextEncoder().encode(pin.trim() + PIN_SALT);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function verifyPin(pin, hash) { return !hash || (await hashPin(pin)) === hash; }

function exportSessionBundle(sessionId) {
  const session = getSessionById(sessionId);
  if (!session) return null;
  const counseling = {}, snapshots = {}, familyDiscussions = {}, wishlists = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const sid = k.includes(`_${sessionId}_`) ? k.split(`_${sessionId}_`)[1] : null;
    if (!sid) continue;
    if (k.startsWith("careernet_counseling_")) counseling[sid] = JSON.parse(localStorage.getItem(k));
    if (k.startsWith("careernet_published_")) snapshots[sid] = JSON.parse(localStorage.getItem(k));
    if (k.startsWith("careernet_family_discussion_")) familyDiscussions[sid] = JSON.parse(localStorage.getItem(k));
    if (k.startsWith("careernet_wishlist_")) wishlists[sid] = JSON.parse(localStorage.getItem(k));
  }
  return { version: 2, exportedAt: new Date().toISOString(), sessionId, session, counseling, snapshots, familyDiscussions, wishlists };
}
function importSessionBundle(data, targetSessionId) {
  if (!data.session || (data.version !== 1 && data.version !== 2)) return { ok: false, message: "지원하지 않는 형식" };
  const list = allSessions();
  const idx = list.findIndex(s => s.id === targetSessionId);
  if (idx < 0) return { ok: false, message: "반이 없습니다." };
  list[idx] = { ...list[idx], ...data.session, id: targetSessionId };
  saveSessions(list);
  for (const [sid, notes] of Object.entries(data.counseling || {})) localStorage.setItem(counselKey(targetSessionId, sid), JSON.stringify(notes));
  for (const [sid, snap] of Object.entries(data.snapshots || {})) localStorage.setItem(snapshotKey(targetSessionId, sid), JSON.stringify(snap));
  for (const [sid, msgs] of Object.entries(data.familyDiscussions || {})) localStorage.setItem(discussionKey(targetSessionId, sid), JSON.stringify(msgs));
  return { ok: true, message: "가져오기 완료" };
}
