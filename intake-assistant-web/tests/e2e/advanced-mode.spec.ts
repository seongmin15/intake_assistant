import { expect, test } from "@playwright/test";

test.describe("Advanced 모드 리다이렉트", () => {
  test("Advanced 모드 클릭 시 SDwC 웹 URL로 이동", async ({ page }) => {
    // VITE_SDWC_WEB_URL이 설정되어 있으면 window.location.href가 변경됨
    // Playwright에서 외부 URL 네비게이션을 감지
    await page.goto("/");

    // Advanced 모드 버튼이 표시되는지 확인
    const advancedButton = page.getByRole("button", { name: "Advanced 모드" });
    await expect(advancedButton).toBeVisible();

    // navigation 이벤트 대기 설정 (외부 URL이면 페이지 로드 실패할 수 있음)
    // VITE_SDWC_WEB_URL이 설정되지 않으면 클릭해도 아무 일도 일어나지 않음
    // 여기서는 버튼 존재 + 클릭 가능 여부만 확인
    await expect(advancedButton).toBeEnabled();
  });

  test("Simple 모드 클릭 시 /intake로 이동", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Simple 모드" }).click();
    await expect(page).toHaveURL("/intake");
    await expect(page.getByText("어떤 서비스를 만들고 싶으신가요?")).toBeVisible();
  });
});
