import { expect, test } from "@playwright/test";

import {
  buildAnalyzeSseBody,
  buildGenerateSseBody,
  buildSseErrorBody,
  MOCK_ANALYZE_RESPONSE,
  setupApiMocks,
} from "./fixtures";

test.describe("에러 시나리오", () => {
  test("analyze 스트림 HTTP 실패 시 에러 메시지 + 분석 재시도 버튼 표시", async ({ page }) => {
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

    await expect(page.getByText("서버 내부 오류가 발생했습니다.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "분석 재시도" }),
    ).toBeVisible();
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

    await page.getByRole("button", { name: "처음부터 다시 시작" }).click();
    await expect(page.locator("#user-input")).toBeVisible();
  });

  test("analyze 스트림 SSE error 이벤트 시 에러 메시지 + 분석 재시도 버튼 표시", async ({
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
      page.getByRole("button", { name: "분석 재시도" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "처음부터 다시 시작" }),
    ).toBeVisible();
  });

  test("generate 스트림 HTTP 실패 시 에러 메시지 + 생성 재시도 버튼 표시", async ({ page }) => {
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

    for (const q of MOCK_ANALYZE_RESPONSE.questions) {
      await page.getByText(q.choices[0].label).click();
    }

    await page.getByRole("button", { name: "생성하기" }).click();

    await expect(page.getByText("YAML 생성에 실패했습니다.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "생성 재시도" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "처음부터 다시 시작" }),
    ).toBeVisible();
  });

  test("finalize API 실패 시 에러 메시지 + 다시 시도 버튼 표시", async ({ page }) => {
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
      page.getByRole("button", { name: "다시 시도" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "처음부터 다시 시작" }),
    ).toBeVisible();
  });

  test("analyze 에러 후 '분석 재시도'로 재시도 성공", async ({ page }) => {
    let callCount = 0;

    await page.route("**/api/v1/analyze/stream", (route) => {
      callCount++;
      if (callCount === 1) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "일시적 오류" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: buildAnalyzeSseBody(),
      });
    });

    await page.goto("/intake");
    await page.locator("#user-input").fill("테스트 입력");
    await page.getByRole("button", { name: "분석하기" }).click();

    await expect(page.getByText("일시적 오류")).toBeVisible();

    await page.getByRole("button", { name: "분석 재시도" }).click();

    await expect(page.getByRole("heading", { name: "서비스 구성" })).toBeVisible();
  });

  test("generate 에러 후 '생성 재시도'로 재시도 성공", async ({ page }) => {
    let generateCallCount = 0;

    await setupApiMocks(page);
    await page.route("**/api/v1/generate/stream", (route) => {
      generateCallCount++;
      if (generateCallCount === 1) {
        return route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ error: "일시적 생성 오류" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: buildGenerateSseBody(),
      });
    });

    await page.goto("/intake");
    await page.locator("#user-input").fill("테스트 입력");
    await page.getByRole("button", { name: "분석하기" }).click();

    for (const q of MOCK_ANALYZE_RESPONSE.questions) {
      await page.getByText(q.choices[0].label).click();
    }

    await page.getByRole("button", { name: "생성하기" }).click();

    await expect(page.getByText("일시적 생성 오류")).toBeVisible();

    await page.getByRole("button", { name: "생성 재시도" }).click();

    await expect(page.getByText("아키텍처 카드")).toBeVisible();
  });
});
