const { buildDraftMessages, buildVerifierMessages } = require("./promptBuilder");
const { chatJSON, verifierDeploymentName } = require("./openaiClient");

const MAX_ATTEMPTS = 4;

function numbersMatch(a, b, tolerance = 0.01) {
  if (typeof a !== "number" || typeof b !== "number" || Number.isNaN(a) || Number.isNaN(b)) return false;
  const tol = Math.max(tolerance, 0.01, Math.abs(a) * 0.01);
  return Math.abs(a - b) <= tol;
}

function sameLabelSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function sameMapping(a, b) {
  if (!a || !b) return false;
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length || keysA.some((k, i) => k !== keysB[i])) return false;
  return keysA.every((k) => a[k] === b[k]);
}

/** Returns { match: boolean, verified: object } — verified carries the
 * verifier's own solution content to use as the authoritative explanation
 * when match is true. */
function compare(format, draft, verifierResult) {
  switch (format) {
    case "SingleCorrectMCQ":
      return {
        match: draft.correctOptionLabel === verifierResult.solvedOptionLabel,
        solutionSteps: verifierResult.solutionSteps,
        finalAnswerStatement: verifierResult.finalAnswerStatement,
      };
    case "Numerical":
      return {
        match: numbersMatch(draft.correctNumericalValue, verifierResult.solvedNumericalValue, draft.numericalTolerance),
        solutionSteps: verifierResult.solutionSteps,
        finalAnswerStatement: verifierResult.finalAnswerStatement,
      };
    case "MultipleCorrectMCQ":
      return {
        match: sameLabelSet(draft.correctOptionLabels, verifierResult.solvedOptionLabels),
        solutionSteps: verifierResult.solutionSteps,
        finalAnswerStatement: verifierResult.finalAnswerStatement,
      };
    case "MatrixMatch":
      return {
        match: sameMapping(draft.correctMapping, verifierResult.solvedMapping),
        solutionSteps: verifierResult.solutionSteps,
        finalAnswerStatement: verifierResult.finalAnswerStatement,
      };
    case "Comprehension": {
      const solved = verifierResult.solvedSubAnswers || [];
      if (solved.length !== draft.subQuestions.length) return { match: false };
      const allMatch = draft.subQuestions.every((sq, i) => sq.correctOptionLabel === solved[i]?.solvedOptionLabel);
      return { match: allMatch, subSolutions: solved };
    }
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

function mergeVerifiedSolution(format, draft, compareResult) {
  const merged = { ...draft };
  if (format === "Comprehension") {
    merged.subQuestions = draft.subQuestions.map((sq, i) => ({
      ...sq,
      solutionSteps: compareResult.subSolutions[i].solutionSteps,
      finalAnswerStatement: compareResult.subSolutions[i].finalAnswerStatement,
    }));
  } else {
    merged.solutionSteps = compareResult.solutionSteps;
    merged.finalAnswerStatement = compareResult.finalAnswerStatement;
  }
  return merged;
}

/** Runs the draft -> independently verify -> retry-on-disagreement loop for
 * one fixed (chapter, topic). Chapter/topic selection is the caller's
 * responsibility (see pickForAttempt in functions/generate.js and
 * functions/generateBatch.js) so that a caller can retry with a *different*
 * topic if this one proves persistently hard to verify. */
async function generateVerifiedQuestion({
  subject,
  examType,
  format,
  difficulty,
  chapter,
  topic,
  avoidQuestionTexts = [],
}) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const draftMessages = buildDraftMessages({
        subject,
        chapter,
        topic,
        examType,
        format,
        difficulty,
        avoidList: avoidQuestionTexts,
        retryHint: attempt > 1,
      });
      // "low" is enough for the draft — it doesn't need to be perfect, just
      // a reasonable attempt, since the verifier is the actual accuracy
      // guarantee below. This cuts draft latency substantially (measured
      // ~2.6x) versus this deployment's much heavier default reasoning.
      const draft = await chatJSON(draftMessages, { reasoningEffort: "low" });

      const verifierMessages = buildVerifierMessages({ subject, examType, format, draft });
      // "high" here is deliberate, not a knob to casually lower: measured
      // testing showed the verifier deployment silently runs with ~0
      // reasoning tokens when this is omitted, and gets non-trivial
      // arithmetic wrong (right method, wrong final number) a meaningful
      // fraction of the time. This is the actual correctness guarantee for
      // the whole pipeline, so it keeps full reasoning effort even though
      // the draft doesn't.
      const verifierResult = await chatJSON(verifierMessages, {
        deployment: verifierDeploymentName(),
        reasoningEffort: "high",
      });

      const result = compare(format, draft, verifierResult);
      if (result.match) {
        const finalQuestion = mergeVerifiedSolution(format, draft, result);
        finalQuestion.subject = subject;
        finalQuestion.chapter = chapter;
        finalQuestion.topic = topic;
        finalQuestion.examType = examType;
        finalQuestion.difficulty = difficulty;
        finalQuestion.verification = { verified: true, attempts: attempt };
        finalQuestion.id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        return finalQuestion;
      }
      lastError = new Error(`Verifier disagreed with drafted answer on attempt ${attempt}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw Object.assign(
    new Error(`Could not produce a verified question on "${topic}" after ${MAX_ATTEMPTS} attempts: ${lastError?.message}`),
    { status: 502, chapter, topic }
  );
}

module.exports = { generateVerifiedQuestion };
