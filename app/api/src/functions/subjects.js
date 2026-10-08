const { app } = require("@azure/functions");
const { EXAM_PATTERNS, SUBJECT_CHAPTERS } = require("../jeePattern");

app.http("subjects", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "subjects",
  handler: async () => {
    return {
      jsonBody: {
        examPatterns: EXAM_PATTERNS,
        chapters: SUBJECT_CHAPTERS,
      },
    };
  },
});
