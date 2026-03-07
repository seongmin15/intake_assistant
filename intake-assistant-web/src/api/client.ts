import type { AnalyzeResponse, GenerateResponse, QaAnswer, StreamEvent } from "./types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

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

export async function generateStream(
  userInput: string,
  qaAnswers: QaAnswer[],
  onEvent: (event: StreamEvent) => void,
  revisionRequest?: string,
  previousYaml?: string,
): Promise<void> {
  const resp = await fetch(`${API_URL}/api/v1/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_input: userInput,
      qa_answers: qaAnswers,
      revision_request: revisionRequest ?? null,
      previous_yaml: previousYaml ?? null,
    }),
  });
  if (!resp.ok) {
    const data = (await resp.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `요청 실패 (${resp.status})`);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error("스트림을 읽을 수 없습니다.");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      let eventType = "";
      let dataStr = "";

      for (const line of trimmed.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7);
        else if (line.startsWith("data: ")) dataStr = line.slice(6);
      }

      if (eventType && dataStr) {
        onEvent({
          event: eventType,
          data: JSON.parse(dataStr),
        } as StreamEvent);
      }
    }
  }
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
