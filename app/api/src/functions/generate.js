const { app } = require("@azure/functions");
const { EXAM_PATTERNS, SUBJECT_CHAPTERS, pickWeightedChapterTopic, normalizeChapterFilter } = require("../jeePattern");
const { generateVerifiedQuestion } = require("../questionPipeline");

const VALID_SUBJECTS = new Set(Object.keys(SUBJECT_CHAPTERS));
const VALID_EXAM_TYPES = new Set(Object.keys(EXAM_PATTERNS));
const VALID_DIFFICULTIES = new Set(["Easy", "Medium", "Hard", "Very Hard"]);
const MAX_OUTER_RETRIES = 2; // total attempts at picking a (possibly different) topic

// weighted default format mix per exam, used when the caller doesn't pin a format
const DEFAULT_FORMAT_WEIGHTS = {
  "JEE Main": { SingleCorrectMCQ: 70, Numerical: 30 },
  "JEE Advanced": {
    SingleCorrectMCQ: 25,
    Numerical: 25,
    MultipleCorrectMCQ: 25,
    MatrixMatch: 12,
    Comprehension: 13,
  },
};

function pickFormat(examType) {
  const weights = DEFAULT_FORMAT_WEIGHTS[examType];
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [format, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return format;
  }
  return Object.keys(weights)[0];
}

async function generateOne(body) {
  const subject = body.subject;
  if (!VALID_SUBJECTS.has(subject)) {
    throw Object.assign(new Error(`subject must be one of ${[...VALID_SUBJECTS].join(", ")}`), { status: 400 });
  }
  const examType = VALID_EXAM_TYPES.has(body.examType) ? body.examType : "JEE Main";
  const difficulty = VALID_DIFFICULTIES.has(body.difficulty) ? body.difficulty : "Medium";

  const allowedFormats = EXAM_PATTERNS[examType].formats;
  const format = allowedFormats.includes(body.format) ? body.format : pickFormat(examType);

  const chapterFilter = normalizeChapterFilter(subject, body.chapters || body.chapter);

  const avoidPairs = Array.isArray(body.avoidPairs) ? body.avoidPairs.slice(0, 20) : [];
  const avoidQuestionTexts = Array.isArray(body.avoidQuestionTexts) ? body.avoidQuestionTexts.slice(0, 8) : [];

  // Each outer attempt picks a (chapter, topic) pair — the chapter stays
  // pinned if the student selected one, but the topic (and chapter, if not
  // pinned) can change between outer attempts so a persistently
  // hard-to-verify topic doesn't dead-end the whole request.
  const triedPairs = [...avoidPairs];
  let lastError;

  for (let outer = 1; outer <= MAX_OUTER_RETRIES; outer++) {
    const { chapter, topic } = pickWeightedChapterTopic(subject, triedPairs, chapterFilter);
    try {
      return await generateVerifiedQuestion({
        subject,
        examType,
        format,
        difficulty,
        chapter,
        topic,
        avoidQuestionTexts,
      });
    } catch (err) {
      lastError = err;
      triedPairs.push({ chapter, topic });
    }
  }

  throw Object.assign(
    new Error(
      `Couldn't produce an independently-verified question after trying ${MAX_OUTER_RETRIES} different topics. Last error: ${lastError?.message}`
    ),
    { status: 502 }
  );
}

app.http("generate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "generate",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const question = await generateOne(body || {});
      return { jsonBody: question };
    } catch (err) {
      context.error(err);
      return { status: err.status || 500, jsonBody: { error: err.message } };
    }
  },
});

module.exports = { generateOne, pickFormat };
