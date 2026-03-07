import type { Page } from "@playwright/test";

export const MOCK_ANALYZE_RESPONSE = {
  questions: [
    {
      id: "q1",
      title: "서비스 구성",
      description: "서비스 구성을 선택해 주세요.",
      type: "single" as const,
      choices: [
        { id: "q1_a", label: "모놀리식" },
        { id: "q1_b", label: "마이크로서비스" },
      ],
    },
    {
      id: "q2",
      title: "데이터 저장",
      description: "데이터 저장 방식을 선택해 주세요.",
      type: "single" as const,
      choices: [
        { id: "q2_a", label: "PostgreSQL" },
        { id: "q2_b", label: "MongoDB" },
      ],
    },
    {
      id: "q3",
      title: "추가 기능",
      description: "필요한 기능을 모두 선택해 주세요.",
      type: "multi" as const,
      choices: [
        { id: "q3_a", label: "인증" },
        { id: "q3_b", label: "파일 업로드" },
        { id: "q3_c", label: "알림" },
      ],
    },
  ],
  analysis: {
    detected_keywords: ["할 일 관리", "공유"],
    inferred_hints: { domain: "project management" },
  },
};

export const MOCK_GENERATE_RESPONSE = {
  yaml_content: "project_name: test-project\nservices:\n  - name: api\n",
  architecture_card: {
    service_composition: "React + FastAPI 모놀리식",
    data_storage: "PostgreSQL",
    authentication: "JWT 토큰",
    external_services: "없음",
    screen_count: "5개",
  },
  feature_checklist: [
    { name: "사용자 인증", summary: "JWT 기반 로그인/회원가입" },
    { name: "할 일 CRUD", summary: "할 일 생성, 조회, 수정, 삭제" },
    { name: "대시보드", summary: "진행 현황 요약 화면" },
  ],
};

const MOCK_ZIP_BYTES = new Uint8Array([
  0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00,
]);

function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function buildAnalyzeSseBody(): string {
  return (
    formatSseEvent("status", { phase: "analyzing" }) +
    formatSseEvent("chunk", { text: '{"partial":' }) +
    formatSseEvent("result", MOCK_ANALYZE_RESPONSE)
  );
}

export function buildGenerateSseBody(): string {
  return (
    formatSseEvent("status", { phase: "generating", attempt: 1, max_attempts: 3 }) +
    formatSseEvent("chunk", { text: "```yaml\nproject:" }) +
    formatSseEvent("status", { phase: "validating", attempt: 1 }) +
    formatSseEvent("result", MOCK_GENERATE_RESPONSE)
  );
}

export function buildSseErrorBody(message: string): string {
  return (
    formatSseEvent("status", { phase: "generating" }) +
    formatSseEvent("error", { message })
  );
}

export async function setupApiMocks(page: Page) {
  // Streaming endpoints (used by frontend)
  await page.route("**/api/v1/analyze/stream", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "Cache-Control": "no-cache" },
      body: buildAnalyzeSseBody(),
    }),
  );

  await page.route("**/api/v1/generate/stream", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "Cache-Control": "no-cache" },
      body: buildGenerateSseBody(),
    }),
  );

  await page.route("**/api/v1/finalize", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/zip",
      body: Buffer.from(MOCK_ZIP_BYTES),
    }),
  );
}
