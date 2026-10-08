const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";

function config() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const draftDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const verifierDeployment = process.env.AZURE_OPENAI_VERIFIER_DEPLOYMENT || draftDeployment;
  if (!endpoint || !apiKey || !draftDeployment) {
    throw new Error(
      "Missing Azure OpenAI configuration. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT."
    );
  }
  return { endpoint: endpoint.replace(/\/+$/, ""), apiKey, draftDeployment, verifierDeployment };
}

async function chatJSON(messages, { deployment, maxCompletionTokens = 12000, reasoningEffort } = {}) {
  const { endpoint, apiKey, draftDeployment } = config();
  const useDeployment = deployment || draftDeployment;
  const url = `${endpoint}/openai/deployments/${useDeployment}/chat/completions?api-version=${API_VERSION}`;

  const body = {
    messages,
    max_completion_tokens: maxCompletionTokens,
    response_format: { type: "json_object" },
  };
  // IMPORTANT: this deployment's default (reasoning_effort omitted) was
  // measured to silently run with ~0 reasoning tokens, which caused real
  // arithmetic mistakes despite a correct derivation (see questionPipeline
  // callers, which always pass this explicitly for exactly that reason).
  // Never let reasoningEffort be silently omitted for the verifier call.
  if (reasoningEffort) body.reasoning_effort = reasoningEffort;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Azure OpenAI request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    if (choice?.finish_reason === "length") {
      throw new Error("Model ran out of tokens before producing output (finish_reason=length). Increase maxCompletionTokens.");
    }
    throw new Error(`Azure OpenAI response had no content. finish_reason=${choice?.finish_reason}`);
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse model JSON output: ${err.message}`);
  }
}

function verifierDeploymentName() {
  return config().verifierDeployment;
}

module.exports = { chatJSON, verifierDeploymentName };
