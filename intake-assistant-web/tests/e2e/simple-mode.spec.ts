import { expect, test } from "@playwright/test";

import {
  buildAnalyzeSseBody,
  buildGenerateSseBody,
  MOCK_ANALYZE_RESPONSE,
  MOCK_GENERATE_RESPONSE,
  setupApiMocks,
} from "./fixtures";

test.describe("Simple 모드 전체 흐름", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("텍스트 입력 → 질문 표시 → 아키텍처 카드 → 완료", async ({ page }) => {
    // 1. ModeSelectorPage에서 Simple 모드 선택
    await page.goto("/");
    await page.getByRole("button", { name: "Simple 모드" }).click();
    await expect(page).toHaveURL("/intake");

    // 2. 텍스트 입력 + 분석하기
    const textarea = page.locator("#user-input");
    await textarea.fill("할 일 관리 서비스를 만들고 싶어요");
    await page.getByRole("button", { name: "분석하기" }).click();

    // 3. 질문 표시 확인
    for (const q of MOCK_ANALYZE_RESPONSE.questions) {
      await expect(page.getByRole("heading", { name: q.title })).toBeVisible();
    }

    // 4. 질문 응답 (각 질문의 첫 번째 선택지 클릭)
    for (const q of MOCK_ANALYZE_RESPONSE.questions) {
      await page.getByText(q.choices[0].label).click();
    }

    // 5. 생성하기 클릭
    await page.getByRole("button", { name: "생성하기" }).click();

    // 6. 아키텍처 카드 표시 확인
    await expect(page.getByText("아키텍처 카드")).toBeVisible();
    const card = MOCK_GENERATE_RESPONSE.architecture_card;
    await expect(page.getByText(card.service_composition)).toBeVisible();
    await expect(page.getByText(card.data_storage)).toBeVisible();

    // 7. 기능 체크리스트 확인
    await expect(page.getByText("기능 체크리스트")).toBeVisible();
    for (const feature of MOCK_GENERATE_RESPONSE.feature_checklist) {
      await expect(page.getByText(feature.name)).toBeVisible();
    }

    // 8. '이대로 진행' → 완료
    await page.getByRole("button", { name: "이대로 진행" }).click();
    await expect(page.getByText("프로젝트 생성 완료!")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "새 프로젝트 시작" }),
    ).toBeVisible();
  });

  test("스트리밍 중 진행 상태 텍스트 표시", async ({ page }) => {
    // Delay analyze/stream response to observe status text
    await page.route("**/api/v1/analyze/stream", async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: buildAnalyzeSseBody(),
      });
    });

    await page.goto("/intake");
    await page.locator("#user-input").fill("할 일 관리 서비스");
    await page.getByRole("button", { name: "분석하기" }).click();

    // Analyzing phase — spinner + status text should appear
    await expect(page.getByText(/질문을 생성하고 있습니다/)).toBeVisible();

    // Wait for questions to appear
    await expect(
      page.getByRole("heading", { name: "서비스 구성" }),
    ).toBeVisible();

    // Answer questions
    for (const q of MOCK_ANALYZE_RESPONSE.questions) {
      await page.getByText(q.choices[0].label).click();
    }

    // Delay generate/stream response to observe status text
    await page.route("**/api/v1/generate/stream", async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: buildGenerateSseBody(),
      });
    });

    await page.getByRole("button", { name: "생성하기" }).click();

    // Generating phase — spinner + status text should appear
    await expect(page.getByText(/프로젝트를 생성하고 있습니다/)).toBeVisible();

    // Wait for result
    await expect(page.getByText("아키텍처 카드")).toBeVisible();
  });

  test("수정 요청 반복 흐름", async ({ page }) => {
    await page.goto("/intake");

    // 텍스트 입력 → 분석 → 질문 응답 → 생성
    await page.locator("#user-input").fill("할 일 관리 서비스");
    await page.getByRole("button", { name: "분석하기" }).click();

    for (const q of MOCK_ANALYZE_RESPONSE.questions) {
      await page.getByText(q.choices[0].label).click();
    }
    await page.getByRole("button", { name: "생성하기" }).click();

    // 아키텍처 카드 확인
    await expect(page.getByText("아키텍처 카드")).toBeVisible();

    // '수정 요청' 클릭
    await page.getByRole("button", { name: "수정 요청" }).click();

    // RevisionInput 표시 확인
    await expect(page.getByText("수정 요청").first()).toBeVisible();
    const revisionTextarea = page.getByPlaceholder(
      "예: 인증을 JWT로 변경해 주세요",
    );
    await expect(revisionTextarea).toBeVisible();

    // 수정 텍스트 입력 + 반영
    await revisionTextarea.fill("인증을 OAuth로 변경해 주세요");
    await page.getByRole("button", { name: "수정 반영하기" }).click();

    // 아키텍처 카드 재표시 확인
    await expect(page.getByText("아키텍처 카드")).toBeVisible();
  });

  test("'새 프로젝트 시작' 버튼으로 초기화", async ({ page }) => {
    await page.goto("/intake");

    // 전체 흐름 → 완료
    await page.locator("#user-input").fill("할 일 관리 서비스");
    await page.getByRole("button", { name: "분석하기" }).click();

    for (const q of MOCK_ANALYZE_RESPONSE.questions) {
      await page.getByText(q.choices[0].label).click();
    }
    await page.getByRole("button", { name: "생성하기" }).click();
    await page.getByRole("button", { name: "이대로 진행" }).click();
    await expect(page.getByText("프로젝트 생성 완료!")).toBeVisible();

    // '새 프로젝트 시작' 클릭 → 입력 화면으로 복귀
    await page.getByRole("button", { name: "새 프로젝트 시작" }).click();
    await expect(page.locator("#user-input")).toBeVisible();
  });
});
