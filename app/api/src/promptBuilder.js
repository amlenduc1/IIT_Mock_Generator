const PERSONA_BY_SUBJECT = {
  Physics:
    "You are a veteran IIT professor and JEE paper-setter with 20+ years of experience setting Physics questions for both JEE Main and JEE Advanced. You are known for numerically clean, concept-testing problems that mirror the real difficulty and style of the exam you are asked to write for.",
  Chemistry:
    "You are a veteran IIT professor and JEE paper-setter with 20+ years of experience setting Chemistry questions across Physical, Organic and Inorganic Chemistry for both JEE Main and JEE Advanced. You write factually precise, NCERT-aligned questions in the exact style and difficulty of the exam you are asked to write for.",
  Mathematics:
    "You are a veteran IIT professor and JEE paper-setter with 20+ years of experience setting Mathematics questions for both JEE Main and JEE Advanced. You write questions that are computationally clean (calculator-free) and test core technique, matching real exam difficulty.",
};

const COMMON_RULES = `
Rules:
- The question must be ENTIRELY ORIGINAL. Do not reproduce or closely paraphrase any specific question from any published book, coaching material, or past paper you may have seen; only use the general topic/style/difficulty level implied.
- Numbers/data in the question must be freshly chosen so the question is new each time, even for the same chapter/subtopic/difficulty.
- Keep the question solvable without a calculator, in the time budget typical for that exam.
- Double-check your own arithmetic/algebra/chemistry facts carefully before finalizing — an incorrect answer key is unacceptable.
- Where the format requires you to write out multiple-choice / list-II option VALUES yourself (not just pick among given ones), make sure exactly one of the values you write is your own precisely-derived answer — recompute it from your final solution step and copy that exact number/expression, not a rounded-in-your-head approximation.
- solutionSteps must be pedagogically clear, as if explaining to a student, showing the key formula/concept at each step.
- Respond with STRICT JSON only (no markdown fences, no commentary, no LaTeX like \\pi or $...$).
- Use actual Unicode math symbols, exactly like a printed textbook would — NEVER spell a symbol's name out as an English word. In particular: π (not "pi"), √ (not "sqrt"), Δ (not "Delta"), Σ (not "sigma"/"sum"), ∫ (not "integral"), ∞ (not "infinity"), ° (not "degrees"), × (not "x" or "times" as a multiplication sign), ÷, ≤, ≥, ≠, ≈, →, ·, ±, ∂, ∇, θ, φ, α, β, γ, λ, μ, ω, ρ, ε, and Å where relevant. Use ^ only for exponents on variables/numbers (x^2, 10^-3) since true superscripts don't render for arbitrary expressions — but degree symbols, pi, and Greek letters must always be the real Unicode character, never a word or a caret escape.
- Subscripts in chemical formulas may be plain digits (H2O, CO2, Ka1) — that is standard and fine.
`;

const DIAGRAM_FIELDS = `  "hasDiagram": boolean,
  "diagramDescription": string | null,
  "diagramSvg": string | null,
`;

const DIAGRAM_RULES = `
Diagram rules:
- Real JEE papers routinely show a figure instead of describing a setup in prose: circuit diagrams, free-body/pulley/inclined-plane diagrams, ray diagrams (mirrors/lenses), geometric figures (triangles, circles, coordinate-geometry constructions), function/graph-reading problems, and organic reaction schemes. When your question is naturally one of these, set "hasDiagram": true and DRAW it — this is the preferred, more authentic style. For questions that are naturally symbolic/algebraic/fact-recall (pure algebra manipulation, stoichiometry, periodic trends, etc.) a diagram would be artificial — set "hasDiagram": false and leave diagramDescription/diagramSvg null.
- When hasDiagram is true, questionText should be CONCISE and refer to "the figure shown" for the setup (like a real exam paper), instead of re-describing every geometric/circuit detail in prose — but it must still clearly state what is being asked.
- "diagramDescription" must be a complete, precise, plain-text restatement of EVERYTHING shown in the figure (every label, numeric value, connection, geometric relationship) — this is the authoritative ground truth used to solve the problem, so it alone (combined with questionText) must be fully sufficient to solve it correctly even by someone who cannot see the image.
- "diagramSvg" must be a small self-contained inline SVG string rendered on a plain white card, so use dark strokes/fills (e.g. stroke="#222", fill="#222" for text/lines, fill="none" for unfilled shapes). Start with <svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg"> using a viewBox around 400x300 (adjust as needed), and only use <line>, <circle>, <ellipse>, <rect>, <path>, <polygon>, <polyline>, <text>, <g> elements with plain presentation attributes (stroke, fill, stroke-width, x1/y1/x2/y2, cx/cy/r, d, points, x/y, font-size, text-anchor). NEVER include <script>, event-handler attributes (onclick etc.), external references (<image>, href/xlink:href to URLs), or <style>/CSS classes — only inline attributes.
- Every label/value that appears in diagramSvg's <text> elements must exactly match a value stated in diagramDescription/questionText, and vice versa — the figure and the text must be 100% consistent with each other, since they describe the same setup.
`;

const FORMAT_SCHEMAS = {
  SingleCorrectMCQ: `{
  "format": "SingleCorrectMCQ",
  "questionText": string,
${DIAGRAM_FIELDS}  "options": [{"label":"A","text":string},{"label":"B","text":string},{"label":"C","text":string},{"label":"D","text":string}],
  "correctOptionLabel": "A"|"B"|"C"|"D",
  "solutionSteps": string[],
  "finalAnswerStatement": string
}
Exactly one option is correct.`,

  Numerical: `{
  "format": "Numerical",
  "questionText": string,
${DIAGRAM_FIELDS}  "correctNumericalValue": number,
  "numericalTolerance": number,
  "solutionSteps": string[],
  "finalAnswerStatement": string
}
The answer should round to a clean integer or up to 2 decimal places. numericalTolerance is the acceptable +/- rounding tolerance (e.g. 0.01).`,

  MultipleCorrectMCQ: `{
  "format": "MultipleCorrectMCQ",
  "questionText": string,
${DIAGRAM_FIELDS}  "options": [{"label":"A","text":string},{"label":"B","text":string},{"label":"C","text":string},{"label":"D","text":string}],
  "correctOptionLabels": string[],
  "solutionSteps": string[],
  "finalAnswerStatement": string
}
1 to 4 options may be correct (JEE Advanced style multi-correct). correctOptionLabels lists ALL correct labels, e.g. ["B","D"]. Prefer questions with 2 or 3 correct options for good discrimination; avoid trivially having only 1 or all 4 correct most of the time.`,

  MatrixMatch: `{
  "format": "MatrixMatch",
  "questionText": string,
${DIAGRAM_FIELDS}  "listI": [{"label":"P","text":string},{"label":"Q","text":string},{"label":"R","text":string},{"label":"S","text":string}],
  "listII": [{"label":"1","text":string},{"label":"2","text":string},{"label":"3","text":string},{"label":"4","text":string}],
  "correctMapping": {"P":"1","Q":"2","R":"3","S":"4"},
  "solutionSteps": string[],
  "finalAnswerStatement": string
}
JEE Advanced matrix-match style: each of the 4 items in List-I maps to EXACTLY ONE item in List-II (one-to-one matching, all 4 of List-II used exactly once). questionText should state what List-I and List-II represent (e.g. "Match the physical quantity in List-I with its SI unit in List-II"). A shared diagram (e.g. one circuit or geometric figure that List-I items refer to) is often appropriate here.`,

  Comprehension: `{
  "format": "Comprehension",
  "paragraph": string,
${DIAGRAM_FIELDS}  "subQuestions": [
    {"questionText": string, "options":[{"label":"A","text":string},{"label":"B","text":string},{"label":"C","text":string},{"label":"D","text":string}], "correctOptionLabel":"A"|"B"|"C"|"D", "solutionSteps": string[], "finalAnswerStatement": string},
    {"questionText": string, "options":[{"label":"A","text":string},{"label":"B","text":string},{"label":"C","text":string},{"label":"D","text":string}], "correctOptionLabel":"A"|"B"|"C"|"D", "solutionSteps": string[], "finalAnswerStatement": string}
  ]
}
A short paragraph (3-6 sentences) sets up a shared scenario/system, followed by exactly 2 single-correct MCQ sub-questions that both depend on understanding that paragraph. hasDiagram/diagramDescription/diagramSvg (if used) describe a figure supporting the shared paragraph, not either sub-question individually.`,
};

const DIFFICULTY_GUIDANCE = {
  Easy: "Easy: a direct single-concept application, 1-2 reasoning steps, minimal computation.",
  Medium: "Medium: combines 2 concepts or requires a moderate multi-step derivation, typical of a solid JEE Main question.",
  Hard: "Hard: multi-concept, requires careful setup and 4+ non-trivial steps, typical of a tough JEE Main / average JEE Advanced question.",
  "Very Hard": "Very Hard: genuinely JEE-Advanced-difficulty — subtle conceptual trap, non-obvious approach, or heavy multi-step derivation that would challenge a strong student.",
};

function buildDraftMessages({ subject, chapter, topic, examType, format, difficulty, avoidList = [], retryHint }) {
  const persona = PERSONA_BY_SUBJECT[subject];
  if (!persona) throw new Error(`Unknown subject: ${subject}`);
  const schema = FORMAT_SCHEMAS[format];
  if (!schema) throw new Error(`Unknown format: ${format}`);

  const system = `${persona}

You are writing one brand-new practice question for a mock-test web app, for the ${examType} exam, in the "${format}" question format. The app hides the answer/solution from the student until they explicitly click "Show Solution", so getting the answer key exactly right matters.

Respond with STRICT JSON only, matching exactly this shape:
${schema}
${COMMON_RULES}
${DIAGRAM_RULES}`;

  let user = `Generate one ${DIFFICULTY_GUIDANCE[difficulty] || difficulty} question for subject "${subject}", chapter "${chapter}", focused specifically on the subtopic "${topic}".`;

  if (avoidList.length) {
    user += `\n\nAvoid repeating the style/scenario of these recently generated questions on this chapter (make this one meaningfully different in scenario and numbers):\n${avoidList.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;
  }
  if (retryHint) {
    user += `\n\nNote: a previous attempt at this question failed an independent re-solve check (the stated answer didn't match). Be extra careful with your arithmetic/derivation this time and double check the final answer before responding.`;
  }

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function buildVerifierMessages({ subject, examType, format, draft }) {
  const persona = PERSONA_BY_SUBJECT[subject];

  let questionPayload;
  let responseShape;

  let matchingRule;

  // The verifier is deliberately never shown diagramSvg (raw SVG markup
  // isn't reliably interpretable by a text model) — only the equally
  // authoritative plain-text diagramDescription, which the draft prompt
  // requires to be fully sufficient to solve the question on its own.
  const diagram = draft.hasDiagram && draft.diagramDescription ? { diagramDescription: draft.diagramDescription } : {};

  switch (format) {
    case "SingleCorrectMCQ":
      questionPayload = { questionText: draft.questionText, ...diagram, options: draft.options };
      responseShape = `{"solvedOptionLabel": "A"|"B"|"C"|"D"|null, "solutionSteps": string[], "finalAnswerStatement": string}`;
      matchingRule = `Set solvedOptionLabel to your own independently-derived answer's matching option ONLY IF it agrees closely (normal rounding) with one of the 4 given options. If your derived value doesn't closely match any of them, set solvedOptionLabel to null — do NOT force-pick the nearest-looking option.`;
      break;
    case "Numerical":
      questionPayload = { questionText: draft.questionText, ...diagram };
      responseShape = `{"solvedNumericalValue": number, "solutionSteps": string[], "finalAnswerStatement": string}`;
      matchingRule = `Report your own independently-derived numeric value exactly as computed — do not adjust it toward any answer you might guess is "expected".`;
      break;
    case "MultipleCorrectMCQ":
      questionPayload = { questionText: draft.questionText, ...diagram, options: draft.options };
      responseShape = `{"solvedOptionLabels": string[], "solutionSteps": string[], "finalAnswerStatement": string}`;
      matchingRule = `List every option label you independently determine to be correct. If, after careful analysis, you are not confident about which options are correct, return an empty array rather than guessing.`;
      break;
    case "MatrixMatch":
      questionPayload = { questionText: draft.questionText, ...diagram, listI: draft.listI, listII: draft.listII };
      responseShape = `{"solvedMapping": {"P":"1","Q":"2","R":"3","S":"4"}, "solutionSteps": string[], "finalAnswerStatement": string}`;
      matchingRule = `For each List-I item, independently compute the answer, then ONLY include that item's key in solvedMapping if your computed value closely (normal rounding) matches one specific List-II entry. If your computed value does not closely match any List-II entry — even if one is "closest" — OMIT that key entirely rather than force-matching it. A partial solvedMapping (fewer than 4 keys) is expected and fine when some values don't cleanly match.`;
      break;
    case "Comprehension":
      questionPayload = {
        paragraph: draft.paragraph,
        ...diagram,
        subQuestions: draft.subQuestions.map((sq) => ({ questionText: sq.questionText, options: sq.options })),
      };
      responseShape = `{"solvedSubAnswers": [{"solvedOptionLabel":"A"|"B"|"C"|"D"|null,"solutionSteps": string[], "finalAnswerStatement": string}, {"solvedOptionLabel":"A"|"B"|"C"|"D"|null,"solutionSteps": string[], "finalAnswerStatement": string}]}`;
      matchingRule = `For each sub-question, set solvedOptionLabel to null if your independently-derived answer doesn't closely match any of its 4 options, instead of force-picking the nearest one.`;
      break;
    default:
      throw new Error(`Unknown format: ${format}`);
  }

  const system = `${persona}

You are acting as an independent, extremely careful checker for a ${examType} exam question. You will be shown ONLY the question (never the drafted answer key), and must solve it completely from scratch, showing your own reasoning, then report your own final answer.

Respond with STRICT JSON only, matching exactly this shape:
${responseShape}

${matchingRule}

Be rigorous: re-derive everything from first principles, check units/signs/edge cases, and do not assume the question-setter got it right. A mismatch you correctly flag is far more valuable than a confident-looking guess — this question will be shown to a real student preparing for JEE, so precision matters more than always producing a clean-looking result.

Formatting: write solutionSteps/finalAnswerStatement using real Unicode math symbols exactly like a printed textbook — π, √, Δ, Σ, ∫, ∞, °, ×, ≤, ≥, ≠, θ, α, β, λ, etc. — never spelled out as English words (no "pi", "sqrt", "Delta"). Use ^ only for exponents (x^2).`;

  const user = `Independently solve this question:\n${JSON.stringify(questionPayload, null, 2)}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

module.exports = { buildDraftMessages, buildVerifierMessages, PERSONA_BY_SUBJECT, FORMAT_SCHEMAS };
