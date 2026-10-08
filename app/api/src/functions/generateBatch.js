const { app } = require("@azure/functions");
const { EXAM_PATTERNS, SUBJECT_CHAPTERS, pickWeightedChapterTopic, normalizeChapterFilter } = require("../jeePattern");
const { generateVerifiedQuestion } = require("../questionPipeline");
const { pickFormat } = require("./generate");

const VALID_SUBJECTS = new Set(Object.keys(SUBJECT_CHAPTERS));
const VALID_EXAM_TYPES = new Set(Object.keys(EXAM_PATTERNS));
const VALID_DIFFICULTIES = new Set(["Easy", "Medium", "Hard", "Very Hard"]);
const MAX_PER_SUBJECT = 15;

app.http("generateBatch", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "generate-batch",
  handler: async (request, context) => {
    try {
      const body = (await request.json()) || {};
      const counts = body.counts || {};
      const examType = VALID_EXAM_TYPES.has(body.examType) ? body.examType : "JEE Main";
      const difficulty = VALID_DIFFICULTIES.has(body.difficulty) ? body.difficulty : undefined;
      const format = EXAM_PATTERNS[examType].formats.includes(body.format) ? body.format : undefined;
      const avoidQuestionTexts = Array.isArray(body.avoidQuestionTexts) ? body.avoidQuestionTexts.slice(0, 8) : [];

      const jobs = [];
      for (const subject of Object.keys(counts)) {
        if (!VALID_SUBJECTS.has(subject)) {
          return { status: 400, jsonBody: { error: `Unknown subject: ${subject}` } };
        }
        const count = Math.min(Number(counts[subject]) || 0, MAX_PER_SUBJECT);

        const chapterFilter = normalizeChapterFilter(subject, body.chapters || body.chapter);

        // pre-pick distinct (chapter, topic) pairs up front so parallel
        // generation calls don't collide on the same subtopic; seed with
        // any pairs the client already has queued/shown to avoid repeats
        const usedPairs = Array.isArray(body.avoidPairs) ? body.avoidPairs.slice(0, 20) : [];
        for (let i = 0; i < count; i++) {
          const pair = pickWeightedChapterTopic(subject, usedPairs, chapterFilter);
          usedPairs.push(pair);
          jobs.push(
            generateVerifiedQuestion({
              subject,
              examType,
              format: format || pickFormat(examType),
              difficulty: difficulty || ["Easy", "Medium", "Hard"][Math.floor(Math.random() * 3)],
              chapter: pair.chapter,
              topic: pair.topic,
              avoidQuestionTexts,
            })
          );
        }
      }

      if (jobs.length === 0) {
        return { status: 400, jsonBody: { error: "No questions requested. Provide counts: { Physics: n, ... }" } };
      }

      const results = await Promise.allSettled(jobs);
      const questions = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      const failures = results.filter((r) => r.status === "rejected");
      failures.forEach((f) => context.error(f.reason));

      return { jsonBody: { questions, requested: jobs.length, failures: failures.length } };
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
