import { expect, test } from "@playwright/test";

import {
  buildSseErrorBody,
  MOCK_ANALYZE_RESPONSE,
  setupApiMocks,
} from "./fixtures";

test.describe("에러 시나리오", () => {
  test("analyze 스트림 HTTP 실패 시 에러 메시지 표시", async ({ page }) => {
    // analyze/stream만 실패하도록 mock
    await page.route("**/api/v1/analyze/stream", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "서버 내부 오류가 발생했습니다." }),
      }),
    );

    await page.goto("/intake");
    await page.locator("#user-input").fill("테스트 입력");
    await page.getByRole("button", { name: "분석하기" }).click();

    // 에러 메시지 표시 확인
    await expect(page.getByText("서버 내부 오류가 발생했습니다.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "처음부터 다시 시작" }),
    ).toBeVisible();
  });

  test("analyze 실패 후 '처음부터 다시 시작'으로 복구", async ({ page }) => {
    await page.route("**/api/v1/analyze/stream", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "일시적 오류" }),
      }),
    );

    await page.goto("/intake");
    await page.locator("#user-input").fill("테스트 입력");
    await page.getByRole("button", { name: "분석하기" }).click();

    await expect(page.getByText("일시적 오류")).toBeVisible();

    // '처음부터 다시 시작' 클릭 → 입력 화면 복귀
    await page.getByRole("button", { name: "처음부터 다시 시작" }).click();
    await expect(page.locator("#user-input")).toBeVisible();
  });

  test("analyze 스트림 SSE error 이벤트 시 에러 메시지 표시", async ({
    page,
  }) => {
    await page.route("**/api/v1/analyze/stream", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: buildSseErrorBody("AI 서비스에 일시적 문제가 발생했습니다."),
      }),
    );

    await page.goto("/intake");
    await page.locator("#user-input").fill("테스트 입력");
    await page.getByRole("button", { name: "분석하기" }).click();

    await expect(
      page.getByText("AI 서비스에 일시적 문제가 발생했습니다."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "처음부터 다시 시작" }),
    ).toBeVisible();
  });

  test("generate 스트림 HTTP 실패 시 에러 메시지 표시", async ({ page }) => {
    // analyze는 성공, generate/stream만 실패
    await setupApiMocks(page);
    await page.route("**/api/v1/generate/stream", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "YAML 생성에 실패했습니다." }),
      }),
    );

    await page.goto("/intake");
    await page.locator("#user-input").fill("테스트 입력");
    await page.getByRole("button", { name: "분석하기" }).click();

    // 질문 응답
    for (const q of MOCK_ANALYZE_RESPONSE.questions) {
      await page.getByText(q.choices[0].label).click();
    }

    await page.getByRole("button", { name: "생성하기" }).click();

    // 에러 메시지 표시 확인
    await expect(page.getByText("YAML 생성에 실패했습니다.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "처음부터 다시 시작" }),
    ).toBeVisible();
  });

  test("finalize API 실패 시 에러 메시지 표시", async ({ page }) => {
    await setupApiMocks(page);
    await page.route("**/api/v1/finalize", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "ZIP 생성에 실패했습니다." }),
      }),
    );

    await page.goto("/intake");
    await page.locator("#user-input").fill("테스트 입력");
    await page.getByRole("button", { name: "분석하기" }).click();

    for (const q of MOCK_ANALYZE_RESPONSE.questions) {
      await page.getByText(q.choices[0].label).click();
    }

    await page.getByRole("button", { name: "생성하기" }).click();
    await expect(page.getByText("아키텍처 카드")).toBeVisible();

    await page.getByRole("button", { name: "이대로 진행" }).click();

    await expect(page.getByText("ZIP 생성에 실패했습니다.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "처음부터 다시 시작" }),
    ).toBeVisible();
  });
});
