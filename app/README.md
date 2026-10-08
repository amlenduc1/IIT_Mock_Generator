# JEE Mock Test Generator

Live app: https://green-ground-08d46ea0f.7.azurestaticapps.net

Generates original JEE Main & JEE Advanced-style Physics/Chemistry/Mathematics
practice questions on demand, styled as an expert IIT professor's paper-setting
persona. Answers/solutions are hidden in the UI until "Show Detailed Solution"
is clicked. Practice mode (one question at a time) and Mock Test mode
(batch-generated set with the real marking scheme for the chosen exam) are
both supported.

Chapter lists, subtopics and weightages in `api/src/jeePattern.js` are
compiled from publicly known JEE syllabus/trend facts, not extracted from any
copyrighted book — every question is freshly generated, original content.

## Question formats

- **JEE Main**: Single-Correct MCQ, Numerical Value (+4/-1 marking).
- **JEE Advanced** (adds): Multiple-Correct MCQ (partial credit), Matrix-Match
  (one-to-one List-I ↔ List-II), Comprehension (paragraph + 2 linked MCQs) —
  each with JEE Advanced's actual marking rules.

## Practice mode UX

- **Chapter picker** (`frontend/app.js`, `populateChapterPicker`): a compact
  multi-select checkbox dropdown — pick 0 (random across the whole subject),
  1, or several chapters to draw from. Backend support is
  `normalizeChapterFilter`/`pickWeightedChapterTopic`'s `chapterFilter` param
  in `api/src/jeePattern.js`, which accepts a chapter name or array.
- **Prefetch queue**: clicking "Generate Question" fetches a batch of 5 via
  `/api/generate-batch` instead of one via `/api/generate` — the first shows
  as soon as it's ready, the rest are queued instantly, and the queue is
  quietly topped back up in the background after each one is served. Queues
  are keyed per filter combination (exam/subject/chapters/difficulty/format).
- **Diagrams**: when a question is naturally diagram-based in real JEE papers
  (circuits, ray optics, geometry, graphs, etc.), the drafter also emits a
  small inline SVG (`hasDiagram`/`diagramSvg`) plus a plain-text
  `diagramDescription`. The verifier is only ever shown `diagramDescription`
  (raw SVG isn't reliably interpretable by a text model) — this keeps the
  verification pipeline's rigor unchanged while still giving the student a
  visual. SVGs are allowlist-sanitized client-side (`sanitizeSvg` in app.js)
  before insertion since they're model-generated content.
- **Gamification**: a persistent header stats bar (daily streak, level, XP,
  overall accuracy — `localStorage` key `jee-mocktest-gamification-v1`) plus
  an in-session "N correct in a row" banner and a floating "+N XP" pop on
  correct answers. XP = marks earned on correct answers; level = XP/100.

## Authenticity: two-model verification pipeline

Because this is used by a real student, every question goes through
`api/src/questionPipeline.js` before being shown:

1. A **drafting model** (`gpt-5-mini`) writes the question + claimed answer key.
2. A **verifier model** (`gpt-5.4`, stronger/independent) is shown *only the
   question* (never the drafted answer) and solves it from scratch.
3. The two answers are compared. If they disagree, the draft is regenerated
   (up to 3 attempts total) with a hint to be more careful. A question is
   never shown to the student unless independently confirmed — the API
   returns an error rather than serving an unverified question.
4. The verifier is explicitly instructed not to force-match its computed
   value to the "nearest-looking" option — an honest non-match triggers a
   retry instead of silently rubber-stamping a slightly-wrong draft.

This roughly doubles generation cost/latency (questions typically take
15–90s) but was chosen deliberately: accuracy over speed. Each verified
question carries a "✓ Independently verified" badge in the UI.

Repetition is reduced two ways: chapters carry 3-5 named subtopics that are
sampled explicitly (so "Electrostatics" doesn't always mean the same angle),
and the client sends its last few generated (chapter, topic) pairs and
question texts as an avoid-list on each request.

## Architecture

The frontend (static HTML/JS on Azure Static Web Apps) calls a **standalone**
Azure Function App directly (absolute URL, CORS-enabled) rather than using
Static Web Apps' built-in "managed Functions" `/api/*` proxy. This is
deliberate: SWA's managed-Functions gateway enforces a fixed ~40 second
timeout that the verification pipeline's 15–180s generation time regularly
exceeds (surfaced to users as `Backend call failure`, not valid JSON). The
standalone Function App has no such cap — `host.json` sets
`functionTimeout: "00:09:00"`.

## Azure resources (subscription: Visual Studio Premium with MSDN)

| Resource | Name | Resource Group |
|---|---|---|
| Resource Group | `rg-jee-mocktest` | eastus2 |
| Azure OpenAI | `aoai-jee-mocktest-am1` | rg-jee-mocktest |
| Draft model deployment | `gpt-5-mini` (capacity 50) | on aoai-jee-mocktest-am1 |
| Verifier model deployment | `gpt-5-4-verifier` (gpt-5.4, capacity 50) | on aoai-jee-mocktest-am1 |
| Static Web App (frontend only) | `swa-jee-mocktest-am1` | rg-jee-mocktest |
| Function App (API, standalone) | `func-jee-mocktest-am1` (Linux, Consumption, Node 22) | rg-jee-mocktest |
| Storage Account (required by Function App) | `stjeemocktestam1` | rg-jee-mocktest |

## Redeploying after code changes

```bash
# Frontend (Static Web App):
npx @azure/static-web-apps-cli deploy \
  --app-location ./frontend \
  --deployment-token "$(az staticwebapp secrets list -n swa-jee-mocktest-am1 -g rg-jee-mocktest --query properties.apiKey -o tsv)" \
  --env production

# API (standalone Function App) — from the api/ folder:
func azure functionapp publish func-jee-mocktest-am1
```

If the Function App URL ever changes (e.g. redeployed under a new name),
update the `API` constant at the top of `frontend/app.js` and re-run the
Static Web App deploy, and update CORS: `az functionapp cors add -n
func-jee-mocktest-am1 -g rg-jee-mocktest --allowed-origins <swa-url>`.

## Local development

```bash
cd api && npm install && func start   # requires Node 20+ on PATH
# in another terminal, serve ./frontend with any static server (the API
# constant in app.js points at the deployed Function App by default; point
# it at http://localhost:7071/api for fully local testing)
```

Fill in `api/local.settings.json` with your Azure OpenAI endpoint/key and both
`AZURE_OPENAI_DEPLOYMENT` (drafter) / `AZURE_OPENAI_VERIFIER_DEPLOYMENT`
(verifier) deployment names (this file is gitignored — never commit real keys).

## Cost notes

- Static Web App: Free tier (100 GB bandwidth/month, no charge).
- Function App: Consumption plan — pay per execution/GB-s, negligible at
  personal-use volume; small Storage Account cost (pennies/month).
- Azure OpenAI: pay-per-token across two deployments (draft + verify), only
  charged when a question is generated. No idle cost. Verification roughly
  doubles per-question token spend versus a single-pass design.
- To tear everything down: `az group delete -n rg-jee-mocktest`.

## Known limitations (single-user personal tool scope)

- No authentication — anyone with the URL can generate questions and consume
  your Azure OpenAI quota. Fine for personal use; add Azure Static Web Apps
  built-in auth (`/.auth/login/aad`) before sharing the link widely.
- Progress/score tracking is stored in the browser's `localStorage` only — it
  is per-device and is lost if browser data is cleared.
- Verification checks whether the drafted final answer is independently
  reproducible — it substantially reduces wrong-answer-key risk but is not an
  absolute correctness guarantee (both models could occasionally share a
  blind spot). Students should still show their own working.
- MatrixMatch uses the classic one-to-one List-I↔List-II format rather than
  the newer one-to-many variant some recent JEE Advanced papers use.
