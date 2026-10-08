// Calls the standalone Azure Function App directly (not the SWA-managed /api
// proxy) because question generation + independent verification can take up
// to a few minutes on harder questions, well past the SWA managed-Functions
// gateway's fixed ~40s timeout. CORS on the Function App allows this origin.
const API = "https://func-jee-mocktest-am1.azurewebsites.net/api";
const STORAGE_KEY = "jee-mocktest-progress-v2";
const RECENT_KEY = "jee-mocktest-recent-v2";

let EXAM_PATTERNS = {};
let CHAPTERS = {};

const FORMAT_LABELS = {
  SingleCorrectMCQ: "Single Correct MCQ",
  Numerical: "Numerical Value",
  MultipleCorrectMCQ: "Multiple Correct MCQ",
  MatrixMatch: "Matrix Match",
  Comprehension: "Comprehension (Paragraph)",
};

const MARKING_HINTS = {
  "JEE Main": "Marking: +4 correct, -1 incorrect, 0 unattempted for every question.",
  "JEE Advanced":
    "Marking varies by format — Single-Correct: +3/-1. Numerical: +4/0 (no negative). Multiple-Correct: up to +4 with partial credit (+1 per correct pick, only if none wrong; -2 if any wrong pick). Matrix-Match: +3 per fully correct row. Comprehension: +3/-1 per sub-question.",
};

// ---------- storage: progress ----------
function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}
function saveProgress(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}
function recordResult(subject, marks, maxMarks) {
  const p = loadProgress();
  p[subject] = p[subject] || { attempted: 0, marks: 0, maxMarks: 0 };
  p[subject].attempted += 1;
  p[subject].marks += marks;
  p[subject].maxMarks += maxMarks;
  saveProgress(p);
  if (marks > 0) addXp(marks);
  refreshStatsBar();
}

// ---------- storage: gamification (streak, XP) ----------
const GAMIFICATION_KEY = "jee-mocktest-gamification-v1";

function loadGamification() {
  try {
    return { xp: 0, streakDays: 0, lastVisitDate: null, ...JSON.parse(localStorage.getItem(GAMIFICATION_KEY)) };
  } catch {
    return { xp: 0, streakDays: 0, lastVisitDate: null };
  }
}
function saveGamification(g) {
  localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(g));
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
/** Call once on load: bumps the daily streak if the last visit was
 * yesterday, resets it if a day was missed, leaves it alone if already
 * visited today. */
function touchDailyStreak() {
  const g = loadGamification();
  const today = todayStr();
  if (g.lastVisitDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    g.streakDays = g.lastVisitDate === yesterday ? g.streakDays + 1 : 1;
    g.lastVisitDate = today;
    saveGamification(g);
  }
  return g;
}
function addXp(amount) {
  const g = loadGamification();
  g.xp = Math.max(0, g.xp + amount);
  saveGamification(g);
  return g;
}
function levelFromXp(xp) {
  return Math.floor(xp / 100) + 1;
}
function refreshStatsBar() {
  const g = loadGamification();
  const streakEl = document.getElementById("stat-streak");
  streakEl.textContent = `🔥 ${g.streakDays}`;
  streakEl.classList.toggle("hot", g.streakDays >= 3);
  document.getElementById("stat-level").textContent = `Lv ${levelFromXp(g.xp)}`;
  document.getElementById("stat-xp").textContent = `⭐ ${g.xp} XP`;

  const p = loadProgress();
  let marks = 0, maxMarks = 0;
  Object.values(p).forEach((d) => {
    marks += d.marks;
    maxMarks += d.maxMarks;
  });
  const pct = maxMarks ? Math.round((marks / maxMarks) * 100) : null;
  document.getElementById("stat-accuracy").textContent = `🎯 ${pct === null ? "–" : pct + "%"}`;
}
function showXpPop(amount, anchorEl) {
  if (amount <= 0 || !anchorEl) return;
  const rect = anchorEl.getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "xp-pop";
  pop.textContent = `+${amount} XP`;
  pop.style.left = `${rect.left + rect.width / 2}px`;
  pop.style.top = `${rect.top}px`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1200);
}

// ---------- storage: recent chapter/topic + question text (for variety) ----------
function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || {};
  } catch {
    return {};
  }
}
function saveRecent(r) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(r));
}
function recordRecent(subject, examType, pair, questionTexts) {
  const r = loadRecent();
  const key = `${subject}::${examType}`;
  r[key] = r[key] || { pairs: [], texts: [] };
  if (pair) {
    r[key].pairs.unshift(pair);
    r[key].pairs = r[key].pairs.slice(0, 6);
  }
  questionTexts.forEach((t) => {
    if (t) r[key].texts.unshift(t.slice(0, 160));
  });
  r[key].texts = r[key].texts.slice(0, 6);
  saveRecent(r);
}
/** Extracts a readable error message from a failed fetch response, whether
 * the backend returned JSON ({error: "..."}) or a plain-text/HTML error
 * page (e.g. a gateway timeout page, which is never valid JSON). */
async function readErrorMessage(res) {
  const text = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.error) return parsed.error;
  } catch {
    // not JSON — fall through to raw text
  }
  return text?.trim() || res.statusText || `HTTP ${res.status}`;
}

function getAvoid(subject, examType) {
  const r = loadRecent();
  const key = `${subject}::${examType}`;
  return r[key] || { pairs: [], texts: [] };
}

// ---------- tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "progress") renderProgress();
  });
});

// ---------- init ----------
async function init() {
  touchDailyStreak();
  refreshStatsBar();
  try {
    const res = await fetch(`${API}/subjects`);
    const data = await res.json();
    EXAM_PATTERNS = data.examPatterns;
    CHAPTERS = data.chapters;
    populateChapterPicker("Physics");
    populateFormatDropdown("JEE Main");
    document.getElementById("m-marking-hint").textContent = MARKING_HINTS["JEE Main"];
  } catch (err) {
    document.getElementById("p-status").textContent = "Could not load subject list from the API. Is the backend configured?";
  }
}

// ---------- Practice: multi-select chapter picker ----------
function populateChapterPicker(subject) {
  const list = document.getElementById("p-chapter-list");
  list.innerHTML = "";
  (CHAPTERS[subject] || []).forEach((c) => {
    const item = document.createElement("label");
    item.className = "chapter-picker-item";
    item.innerHTML = `<input type="checkbox" value="${escapeHtml(c.name)}" /><span title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>`;
    item.querySelector("input").addEventListener("change", updateChapterButtonLabel);
    list.appendChild(item);
  });
  updateChapterButtonLabel();
}
function getSelectedChapters() {
  return [...document.querySelectorAll("#p-chapter-list input:checked")].map((i) => i.value);
}
function updateChapterButtonLabel() {
  const selected = getSelectedChapters();
  const btn = document.getElementById("p-chapter-btn");
  if (selected.length === 0) btn.textContent = "Random (all)";
  else if (selected.length === 1) btn.textContent = selected[0];
  else btn.textContent = `${selected.length} chapters selected`;
}
document.getElementById("p-chapter-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("p-chapter-panel").classList.toggle("hidden");
});
document.getElementById("p-chapter-clear").addEventListener("click", () => {
  document.querySelectorAll("#p-chapter-list input:checked").forEach((i) => (i.checked = false));
  updateChapterButtonLabel();
});
document.addEventListener("click", (e) => {
  const picker = document.getElementById("p-chapter-picker");
  if (!picker.contains(e.target)) document.getElementById("p-chapter-panel").classList.add("hidden");
});

function populateFormatDropdown(examType) {
  const sel = document.getElementById("p-format");
  sel.innerHTML = '<option value="">Mixed (random for this exam)</option>';
  (EXAM_PATTERNS[examType]?.formats || []).forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = FORMAT_LABELS[f] || f;
    sel.appendChild(opt);
  });
}

document.getElementById("p-subject").addEventListener("change", (e) => populateChapterPicker(e.target.value));
document.getElementById("p-examtype").addEventListener("change", (e) => populateFormatDropdown(e.target.value));
document.getElementById("m-examtype").addEventListener("change", (e) => {
  document.getElementById("m-marking-hint").textContent = MARKING_HINTS[e.target.value] || "";
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// =====================================================================
// Shared: build interactive answer inputs for a question, given its format
// =====================================================================

/** Returns { el, getAnswer } for a single-correct-style MCQ block (used
 * directly for SingleCorrectMCQ, and per sub-question inside Comprehension). */
function buildSingleChoiceInputs(options, uid) {
  const wrap = document.createElement("div");
  wrap.className = "options";
  let selected = null;
  const rows = [];
  options.forEach((opt) => {
    const row = document.createElement("div");
    row.className = "option-row";
    row.dataset.label = opt.label;
    row.textContent = `${opt.label}. ${opt.text}`;
    row.addEventListener("click", () => {
      selected = opt.label;
      rows.forEach((r) => (r.style.outline = ""));
      row.style.outline = "2px solid var(--accent)";
    });
    rows.push(row);
    wrap.appendChild(row);
  });
  return { el: wrap, getAnswer: () => selected };
}

function buildMultiChoiceInputs(options, uid) {
  const wrap = document.createElement("div");
  wrap.className = "options";
  const checked = new Set();
  options.forEach((opt) => {
    const row = document.createElement("label");
    row.className = "option-row";
    row.innerHTML = `<input type="checkbox" name="mc-${uid}" value="${opt.label}" /> ${opt.label}. ${escapeHtml(opt.text)}`;
    const input = row.querySelector("input");
    input.addEventListener("change", () => {
      if (input.checked) checked.add(opt.label);
      else checked.delete(opt.label);
    });
    wrap.appendChild(row);
  });
  return { el: wrap, getAnswer: () => [...checked] };
}

function buildNumericInput(uid) {
  const wrap = document.createElement("div");
  wrap.className = "numeric-answer";
  wrap.innerHTML = `<label>Your answer <input type="number" step="any" id="num-${uid}" /></label>`;
  return { el: wrap, getAnswer: () => {
    const v = document.getElementById(`num-${uid}`).value;
    return v === "" ? null : Number(v);
  }};
}

function buildMatrixMatchInputs(q, uid) {
  const wrap = document.createElement("div");
  wrap.className = "matrix-match";
  const mapping = {};
  q.listI.forEach((rowItem) => {
    const rowEl = document.createElement("div");
    rowEl.className = "matrix-row";
    const label = document.createElement("div");
    label.className = "matrix-row-label";
    label.textContent = `${rowItem.label}. ${rowItem.text}`;
    rowEl.appendChild(label);
    const choices = document.createElement("div");
    choices.className = "matrix-row-choices";
    q.listII.forEach((colItem) => {
      const choiceLabel = document.createElement("label");
      choiceLabel.className = "matrix-choice";
      choiceLabel.innerHTML = `<input type="radio" name="matrix-${uid}-${rowItem.label}" value="${colItem.label}" /> ${colItem.label}`;
      choiceLabel.title = colItem.text;
      choiceLabel.querySelector("input").addEventListener("change", () => {
        mapping[rowItem.label] = colItem.label;
      });
      choices.appendChild(choiceLabel);
    });
    rowEl.appendChild(choices);
    wrap.appendChild(rowEl);
  });
  const legend = document.createElement("div");
  legend.className = "matrix-legend";
  legend.innerHTML = "List-II: " + q.listII.map((c) => `<strong>${c.label}</strong>. ${escapeHtml(c.text)}`).join(" &nbsp;|&nbsp; ");
  wrap.appendChild(legend);
  return { el: wrap, getAnswer: () => ({ ...mapping }) };
}

/** Builds the full interactive body for a question (any format) into `container`.
 * Returns { getAnswer } — a function returning the format-appropriate answer shape. */
function buildQuestionInputs(container, q, uid) {
  if (q.format === "SingleCorrectMCQ") {
    const { el, getAnswer } = buildSingleChoiceInputs(q.options, uid);
    container.appendChild(el);
    return { getAnswer };
  }
  if (q.format === "Numerical") {
    const { el, getAnswer } = buildNumericInput(uid);
    container.appendChild(el);
    return { getAnswer };
  }
  if (q.format === "MultipleCorrectMCQ") {
    const { el, getAnswer } = buildMultiChoiceInputs(q.options, uid);
    container.appendChild(el);
    return { getAnswer };
  }
  if (q.format === "MatrixMatch") {
    const { el, getAnswer } = buildMatrixMatchInputs(q, uid);
    container.appendChild(el);
    return { getAnswer };
  }
  if (q.format === "Comprehension") {
    const para = document.createElement("div");
    para.className = "comprehension-paragraph";
    para.textContent = q.paragraph;
    container.appendChild(para);
    const getters = q.subQuestions.map((sq, i) => {
      const sqWrap = document.createElement("div");
      sqWrap.className = "comprehension-subq";
      const sqText = document.createElement("div");
      sqText.className = "q-text";
      sqText.textContent = `${i + 1}. ${sq.questionText}`;
      sqWrap.appendChild(sqText);
      const { el, getAnswer } = buildSingleChoiceInputs(sq.options, `${uid}-${i}`);
      sqWrap.appendChild(el);
      container.appendChild(sqWrap);
      return getAnswer;
    });
    return { getAnswer: () => getters.map((g) => g()) };
  }
  throw new Error(`Unknown format: ${q.format}`);
}

// =====================================================================
// Shared: scoring
// =====================================================================

function numbersMatch(a, b, tolerance = 0.01) {
  if (typeof a !== "number" || typeof b !== "number" || Number.isNaN(a) || Number.isNaN(b)) return false;
  const tol = Math.max(tolerance, 0.01, Math.abs(a) * 0.01);
  return Math.abs(a - b) <= tol;
}

function maxMarksFor(examType, q) {
  const m = EXAM_PATTERNS[examType].marking[q.format];
  if (q.format === "MatrixMatch") return 4 * m.fullPerRow;
  if (q.format === "Comprehension") return 2 * m.full;
  return m.full;
}

/** Returns { marks, maxMarks, label } where label is a short human string. */
function scoreQuestion(examType, q, userAnswer) {
  const m = EXAM_PATTERNS[examType].marking[q.format];
  const maxMarks = maxMarksFor(examType, q);

  switch (q.format) {
    case "SingleCorrectMCQ": {
      if (!userAnswer) return { marks: 0, maxMarks, label: "Unattempted" };
      const correct = userAnswer === q.correctOptionLabel;
      return { marks: correct ? m.full : m.wrong, maxMarks, label: correct ? "Correct" : "Incorrect" };
    }
    case "Numerical": {
      if (userAnswer === null || userAnswer === undefined || Number.isNaN(userAnswer)) return { marks: 0, maxMarks, label: "Unattempted" };
      const correct = numbersMatch(userAnswer, q.correctNumericalValue, q.numericalTolerance);
      return { marks: correct ? m.full : m.wrong, maxMarks, label: correct ? "Correct" : "Incorrect" };
    }
    case "MultipleCorrectMCQ": {
      const picked = userAnswer || [];
      if (picked.length === 0) return { marks: 0, maxMarks, label: "Unattempted" };
      const correctSet = q.correctOptionLabels;
      const anyWrong = picked.some((l) => !correctSet.includes(l));
      if (anyWrong) return { marks: m.anyWrongChosen, maxMarks, label: "Incorrect (wrong option picked)" };
      if (picked.length === correctSet.length) return { marks: m.full, maxMarks, label: "Fully correct" };
      return { marks: m.perCorrectPartial * picked.length, maxMarks, label: "Partially correct" };
    }
    case "MatrixMatch": {
      const mapping = userAnswer || {};
      let marks = 0;
      let correctRows = 0;
      q.listI.forEach((row) => {
        if (mapping[row.label] && mapping[row.label] === q.correctMapping[row.label]) {
          marks += m.fullPerRow;
          correctRows++;
        }
      });
      return { marks, maxMarks, label: `${correctRows}/${q.listI.length} rows correct` };
    }
    case "Comprehension": {
      const answers = userAnswer || [null, null];
      let marks = 0;
      let correctCount = 0;
      q.subQuestions.forEach((sq, i) => {
        if (!answers[i]) return;
        if (answers[i] === sq.correctOptionLabel) {
          marks += m.full;
          correctCount++;
        } else {
          marks += m.wrong;
        }
      });
      return { marks, maxMarks, label: `${correctCount}/${q.subQuestions.length} sub-questions correct` };
    }
    default:
      return { marks: 0, maxMarks: 0, label: "" };
  }
}

/** Applies green/red styling to the rendered inputs based on the user's answer. */
function applyCorrectnessStyling(container, q, userAnswer) {
  if (q.format === "SingleCorrectMCQ") {
    container.querySelectorAll(".option-row").forEach((row) => {
      const label = row.dataset.label;
      if (label === q.correctOptionLabel) row.classList.add("correct");
      else if (label === userAnswer) row.classList.add("incorrect");
    });
  } else if (q.format === "MultipleCorrectMCQ") {
    const picked = userAnswer || [];
    container.querySelectorAll(".option-row").forEach((row) => {
      const input = row.querySelector("input");
      const label = input.value;
      if (q.correctOptionLabels.includes(label)) row.classList.add("correct");
      else if (picked.includes(label)) row.classList.add("incorrect");
    });
  } else if (q.format === "MatrixMatch") {
    const mapping = userAnswer || {};
    container.querySelectorAll(".matrix-row").forEach((rowEl, i) => {
      const rowLabel = q.listI[i].label;
      const correctCol = q.correctMapping[rowLabel];
      rowEl.querySelectorAll(".matrix-choice").forEach((choiceLabel) => {
        const input = choiceLabel.querySelector("input");
        if (input.value === correctCol) choiceLabel.classList.add("correct");
        else if (mapping[rowLabel] === input.value) choiceLabel.classList.add("incorrect");
      });
    });
  } else if (q.format === "Comprehension") {
    const answers = userAnswer || [];
    container.querySelectorAll(".comprehension-subq").forEach((sqWrap, i) => {
      const sq = q.subQuestions[i];
      sqWrap.querySelectorAll(".option-row").forEach((row) => {
        const label = row.dataset.label;
        if (label === sq.correctOptionLabel) row.classList.add("correct");
        else if (label === answers[i]) row.classList.add("incorrect");
      });
    });
  }
}

function buildSolutionElement(q) {
  const el = document.createElement("div");
  el.className = "solution hidden";

  if (q.format === "MatrixMatch") {
    const mappingText = q.listI.map((row) => `${row.label} → ${q.correctMapping[row.label]}`).join(", ");
    el.innerHTML = `
      <strong>Step-by-step solution</strong>
      <ol>${(q.solutionSteps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
      <div class="final-answer">Correct matching: ${escapeHtml(mappingText)}</div>`;
  } else if (q.format === "Comprehension") {
    el.innerHTML = q.subQuestions
      .map(
        (sq, i) => `
      <strong>Sub-question ${i + 1} solution</strong>
      <ol>${(sq.solutionSteps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
      <div class="final-answer">${escapeHtml(sq.finalAnswerStatement || "")}</div>`
      )
      .join("<hr/>");
  } else {
    el.innerHTML = `
      <strong>Step-by-step solution</strong>
      <ol>${(q.solutionSteps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
      <div class="final-answer">${escapeHtml(q.finalAnswerStatement || "")}</div>`;
  }
  return el;
}

function buildMeta(q) {
  const meta = document.createElement("div");
  meta.className = "meta";
  const verified = q.verification?.verified;
  meta.innerHTML = `
    <span class="badge">${q.examType}</span>
    <span class="badge">${q.subject}</span>
    <span class="badge">${q.chapter}</span>
    <span class="badge">${q.difficulty}</span>
    <span class="badge">${FORMAT_LABELS[q.format] || q.format}</span>
    ${verified ? `<span class="badge verified">✓ Independently verified</span>` : ""}`;
  return meta;
}

function questionTextsOf(q) {
  if (q.format === "Comprehension") return [q.paragraph, ...q.subQuestions.map((sq) => sq.questionText)];
  return [q.questionText];
}

// ---------- diagram rendering (sanitized inline SVG) ----------
const SVG_ALLOWED_TAGS = new Set(["svg", "line", "circle", "ellipse", "rect", "path", "polygon", "polyline", "text", "g", "tspan"]);
const SVG_ALLOWED_ATTRS = new Set([
  "viewBox", "xmlns", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "d", "points", "stroke", "fill", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin",
  "font-size", "font-family", "text-anchor", "dominant-baseline", "transform", "opacity",
]);

/** Parses and allowlist-filters an LLM-generated SVG string before it's
 * inserted into the DOM — strips any tag/attribute not on the allowlist
 * (in particular <script>, event-handler attributes, and external refs),
 * since this content originates from a model response, not our own code. */
function sanitizeSvg(svgString) {
  if (typeof svgString !== "string" || !svgString.includes("<svg")) return null;
  try {
    const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
    if (doc.querySelector("parsererror")) return null;
    const svgEl = doc.querySelector("svg");
    if (!svgEl) return null;
    const clean = (node) => {
      [...node.children].forEach((child) => {
        if (!SVG_ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
          child.remove();
          return;
        }
        [...child.attributes].forEach((attr) => {
          if (!SVG_ALLOWED_ATTRS.has(attr.name)) child.removeAttribute(attr.name);
        });
        clean(child);
      });
    };
    clean(svgEl);
    [...svgEl.attributes].forEach((attr) => {
      if (!SVG_ALLOWED_ATTRS.has(attr.name)) svgEl.removeAttribute(attr.name);
    });
    return svgEl.outerHTML;
  } catch {
    return null;
  }
}

function renderDiagram(container, q) {
  if (!q.hasDiagram || !q.diagramSvg) return;
  const clean = sanitizeSvg(q.diagramSvg);
  if (!clean) return;
  const wrap = document.createElement("div");
  wrap.className = "diagram-wrap";
  wrap.innerHTML = clean;
  container.appendChild(wrap);
}

// =====================================================================
// Practice mode — on-demand generation
//
// One always-enabled "Next Question" button. Each click generates exactly
// one fresh, independently-verified question via /api/generate — no
// upfront batching or hidden queue. Simpler and more predictable than the
// prefetch-queue approach this replaced.
// =====================================================================
const pStatus = document.getElementById("p-status");
const pQuestionEl = document.getElementById("p-question");
const pNextBtn = document.getElementById("p-next");
const pSessionStreakEl = document.getElementById("p-session-streak");

let sessionCorrectStreak = 0;
function updateSessionStreak(wasFullyCorrect) {
  sessionCorrectStreak = wasFullyCorrect ? sessionCorrectStreak + 1 : 0;
  if (sessionCorrectStreak >= 3) {
    pSessionStreakEl.textContent = `🔥 ${sessionCorrectStreak} correct in a row!`;
    pSessionStreakEl.classList.remove("hidden");
  } else {
    pSessionStreakEl.classList.add("hidden");
  }
}

function currentPracticeFilters() {
  return {
    examType: document.getElementById("p-examtype").value,
    subject: document.getElementById("p-subject").value,
    chapters: getSelectedChapters(),
    difficulty: document.getElementById("p-difficulty").value,
    format: document.getElementById("p-format").value,
  };
}

async function fetchSingleQuestion({ subject, examType, chapters, difficulty, format }) {
  const avoid = getAvoid(subject, examType);
  const res = await fetch(`${API}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject,
      examType,
      chapters: chapters && chapters.length ? chapters : undefined,
      difficulty,
      format: format || undefined,
      avoidPairs: avoid.pairs,
      avoidQuestionTexts: avoid.texts,
    }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const q = await res.json();
  recordRecent(subject, examType, { chapter: q.chapter, topic: q.topic }, questionTextsOf(q));
  return q;
}

// generate-batch is still used by Mock Test mode (see below), just not here.
async function fetchQuestionBatch({ subject, examType, chapters, difficulty, format, count }) {
  const avoid = getAvoid(subject, examType);
  const res = await fetch(`${API}/generate-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      counts: { [subject]: count },
      examType,
      chapters: chapters && chapters.length ? chapters : undefined,
      difficulty: difficulty || undefined,
      format: format || undefined,
      avoidPairs: avoid.pairs,
      avoidQuestionTexts: avoid.texts,
    }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = await res.json();
  data.questions.forEach((q) => recordRecent(subject, examType, { chapter: q.chapter, topic: q.topic }, questionTextsOf(q)));
  return data;
}

pNextBtn.addEventListener("click", async () => {
  const filters = currentPracticeFilters();
  pNextBtn.disabled = true;
  pStatus.textContent = "Generating your next question — usually 15-90s (independently verified before it's shown).";
  pQuestionEl.classList.add("hidden");
  try {
    const q = await fetchSingleQuestion(filters);
    pStatus.textContent = "";
    renderPracticeQuestion(q, filters.examType);
  } catch (err) {
    if (/Couldn.t produce an independently-verified question/i.test(err.message)) {
      pStatus.textContent = "This one couldn't be independently verified even after trying a couple of topics — that's the safety check working as intended (better to skip than show a wrong answer key). Click Next Question to try a fresh one.";
    } else {
      pStatus.textContent = `Error: ${err.message}`;
    }
  } finally {
    pNextBtn.disabled = false; // always re-enabled, per request — never left stuck
  }
});

function renderPracticeQuestion(q, examType) {
  pQuestionEl.classList.remove("hidden");
  pQuestionEl.innerHTML = "";
  pQuestionEl.appendChild(buildMeta(q));
  renderDiagram(pQuestionEl, q);

  const bodyWrap = document.createElement("div");
  if (q.format !== "Comprehension") {
    const qText = document.createElement("div");
    qText.className = "q-text";
    qText.textContent = q.questionText;
    bodyWrap.appendChild(qText);
  }
  pQuestionEl.appendChild(bodyWrap);

  const { getAnswer } = buildQuestionInputs(bodyWrap, q, q.id);

  const actions = document.createElement("div");
  actions.className = "actions-row";
  const submitBtn = document.createElement("button");
  submitBtn.className = "primary";
  submitBtn.textContent = "Submit Answer";
  const solutionBtn = document.createElement("button");
  solutionBtn.textContent = "Show Detailed Solution";
  actions.appendChild(submitBtn);
  actions.appendChild(solutionBtn);
  pQuestionEl.appendChild(actions);

  const feedback = document.createElement("div");
  feedback.className = "feedback";
  pQuestionEl.appendChild(feedback);

  const solutionEl = buildSolutionElement(q);
  pQuestionEl.appendChild(solutionEl);

  let answered = false;
  submitBtn.addEventListener("click", () => {
    if (answered) return;
    const userAnswer = getAnswer();
    const { marks, maxMarks, label } = scoreQuestion(examType, q, userAnswer);
    applyCorrectnessStyling(bodyWrap, q, userAnswer);
    feedback.textContent = `${label} (${marks >= 0 ? "+" : ""}${marks} / ${maxMarks})`;
    feedback.className = `feedback ${marks >= maxMarks ? "good" : marks > 0 ? "" : "bad"}`;
    answered = true;
    recordResult(q.subject, marks, maxMarks);
    if (marks > 0) showXpPop(marks, submitBtn);
    updateSessionStreak(marks >= maxMarks && maxMarks > 0);
  });

  solutionBtn.addEventListener("click", () => {
    solutionEl.classList.toggle("hidden");
    solutionBtn.textContent = solutionEl.classList.contains("hidden") ? "Show Detailed Solution" : "Hide Solution";
  });
}

// =====================================================================
// Mock test mode
// =====================================================================
const mStatus = document.getElementById("m-status");
const mQuestionsForm = document.getElementById("m-questions");
const mActions = document.getElementById("m-actions");
const mResult = document.getElementById("m-result");
let mockQuestions = [];
let mockGetters = [];
let mockExamType = "JEE Main";

document.getElementById("m-start").addEventListener("click", async () => {
  const examType = document.getElementById("m-examtype").value;
  mockExamType = examType;
  const counts = {
    Physics: Number(document.getElementById("m-physics").value) || 0,
    Chemistry: Number(document.getElementById("m-chemistry").value) || 0,
    Mathematics: Number(document.getElementById("m-math").value) || 0,
  };
  const difficulty = document.getElementById("m-difficulty").value;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    mStatus.textContent = "Choose at least one question in some subject.";
    return;
  }

  mStatus.textContent = `Generating and verifying ${total} original questions... this can take a few minutes for larger sets.`;
  mQuestionsForm.innerHTML = "";
  mActions.classList.add("hidden");
  mResult.classList.add("hidden");
  document.getElementById("m-start").disabled = true;

  try {
    const res = await fetch(`${API}/generate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counts, difficulty: difficulty || undefined, examType }),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    const data = await res.json();
    mockQuestions = data.questions;
    if (data.failures) mStatus.textContent = `Generated ${mockQuestions.length}/${data.requested} (${data.failures} failed verification and were skipped — you can Start again to top up).`;
    else mStatus.textContent = `${mockQuestions.length} questions ready, all independently verified. Answer all, then Submit Test.`;
    renderMockTest(examType);
    mActions.classList.remove("hidden");
  } catch (err) {
    mStatus.textContent = `Error: ${err.message}`;
  } finally {
    document.getElementById("m-start").disabled = false;
  }
});

function renderMockTest(examType) {
  mQuestionsForm.innerHTML = "";
  mockGetters = [];
  mockQuestions.forEach((q, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "mock-q card";

    const meta = document.createElement("div");
    meta.className = "meta";
    const verified = q.verification?.verified;
    meta.innerHTML = `<span class="badge">Q${idx + 1}</span><span class="badge">${q.subject}</span><span class="badge">${q.chapter}</span><span class="badge">${q.difficulty}</span><span class="badge">${FORMAT_LABELS[q.format] || q.format}</span>${verified ? '<span class="badge verified">✓ verified</span>' : ""}`;
    wrap.appendChild(meta);
    renderDiagram(wrap, q);

    const bodyWrap = document.createElement("div");
    if (q.format !== "Comprehension") {
      const qText = document.createElement("div");
      qText.className = "q-text";
      qText.textContent = q.questionText;
      bodyWrap.appendChild(qText);
    }
    wrap.appendChild(bodyWrap);

    const { getAnswer } = buildQuestionInputs(bodyWrap, q, `m${idx}-${q.id}`);
    mockGetters.push(getAnswer);

    const solBtn = document.createElement("button");
    solBtn.textContent = "Show Detailed Solution";
    wrap.appendChild(solBtn);

    const solutionEl = buildSolutionElement(q);
    wrap.appendChild(solutionEl);
    solBtn.addEventListener("click", () => {
      solutionEl.classList.toggle("hidden");
      solBtn.textContent = solutionEl.classList.contains("hidden") ? "Show Detailed Solution" : "Hide Solution";
    });

    wrap.dataset.bodyIndex = idx;
    mQuestionsForm.appendChild(wrap);
  });
}

document.getElementById("m-submit").addEventListener("click", () => {
  let totalMarks = 0;
  let totalMax = 0;
  const perSubject = {};

  mockQuestions.forEach((q, idx) => {
    const userAnswer = mockGetters[idx]();
    const { marks, maxMarks } = scoreQuestion(mockExamType, q, userAnswer);
    const wrap = mQuestionsForm.querySelector(`.mock-q[data-body-index="${idx}"]`);
    applyCorrectnessStyling(wrap, q, userAnswer);

    totalMarks += marks;
    totalMax += maxMarks;
    perSubject[q.subject] = perSubject[q.subject] || { marks: 0, maxMarks: 0 };
    perSubject[q.subject].marks += marks;
    perSubject[q.subject].maxMarks += maxMarks;

    recordResult(q.subject, marks, maxMarks);
  });

  mResult.classList.remove("hidden");
  mResult.innerHTML = `
    <h3>Result</h3>
    <p><strong>Score: ${totalMarks} / ${totalMax}</strong></p>
    <p>Per-subject: ${Object.entries(perSubject).map(([s, v]) => `${s} ${v.marks}/${v.maxMarks}`).join(" | ")}</p>
    <p class="hint">Solutions for each question are available via "Show Detailed Solution" above.</p>`;
  mResult.scrollIntoView({ behavior: "smooth" });
});

// =====================================================================
// Progress tab
// =====================================================================
function renderProgress() {
  const p = loadProgress();
  const el = document.getElementById("progress-summary");
  const subjects = ["Physics", "Chemistry", "Mathematics"];
  let totalMarks = 0, totalMax = 0, totalAttempted = 0;
  const rows = subjects.map((s) => {
    const d = p[s] || { attempted: 0, marks: 0, maxMarks: 0 };
    totalMarks += d.marks;
    totalMax += d.maxMarks;
    totalAttempted += d.attempted;
    const pct = d.maxMarks ? ((d.marks / d.maxMarks) * 100).toFixed(1) : "-";
    return `<div class="progress-row"><span>${s}</span><span>${d.marks}/${d.maxMarks} marks (${pct}%), ${d.attempted} attempted</span></div>`;
  }).join("");
  const overallPct = totalMax ? ((totalMarks / totalMax) * 100).toFixed(1) : "-";
  el.innerHTML = `<h3>Progress</h3>${rows}<div class="progress-row"><strong>Overall</strong><strong>${totalMarks}/${totalMax} (${overallPct}%), ${totalAttempted} attempted</strong></div>`;
}
document.getElementById("progress-reset").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(RECENT_KEY);
  renderProgress();
});

init();
