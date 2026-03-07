import type { AnalyzeResponse, GenerateResponse, QaAnswer } from "./types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

async function request<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const data = (await resp.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `요청 실패 (${resp.status})`);
  }
  return resp.json() as Promise<T>;
}

export async function analyze(userInput: string): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>("/api/v1/analyze", { user_input: userInput });
}

export async function generate(
  userInput: string,
  qaAnswers: QaAnswer[],
  revisionRequest?: string,
  previousYaml?: string,
): Promise<GenerateResponse> {
  return request<GenerateResponse>("/api/v1/generate", {
    user_input: userInput,
    qa_answers: qaAnswers,
    revision_request: revisionRequest ?? null,
    previous_yaml: previousYaml ?? null,
  });
}

export async function finalize(yamlContent: string): Promise<Blob> {
  const resp = await fetch(`${API_URL}/api/v1/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml_content: yamlContent }),
  });
  if (!resp.ok) {
    const data = (await resp.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `요청 실패 (${resp.status})`);
  }
  return resp.blob();
}
