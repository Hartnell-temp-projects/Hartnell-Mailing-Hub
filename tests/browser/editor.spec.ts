import { expect, Page, test } from "@playwright/test";

const templateHtml = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#c2c2c2;font-family:Arial,sans-serif">
    <table role="presentation" width="100%">
      <tr><td style="background:#52002f;color:white;padding:24px;font-size:24px">Hartnell College</td></tr>
      <tr><td data-editable-region="body" style="padding:24px;background:#fff">
        <p>Dear Panthers,</p>
        <p>Welcome to the campus communication test.</p>
        <ul><li>First template item</li><li>Second template item</li></ul>
      </td></tr>
    </table>
  </body>
</html>`;

async function mockAuthenticatedApp(page: Page) {
  await page.route("**/api/auth/session**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user: { email: "tester@hartnell.edu", name: "Test User", subject: "test-user" },
      }),
    })
  );

  await page.route("**/api/email-templates**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        templates: [
          {
            id: "it-security-notice",
            name: "IT Security Notice",
            description: "Hartnell IT security alert with branded styling.",
            subject: "IT Security Notice",
            content: templateHtml,
            source: "built-in",
          },
        ],
        errors: [],
      }),
    })
  );
}

test.describe("email editor browser compatibility", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto("/");
  });

  test("keeps personalization tokens in the editor and replaces them in preview", async ({ page }) => {
    await page.getByRole("button", { name: /Start from scratch/ }).click();

    await page.getByRole("textbox", { name: "SUBJECT *" }).fill("Personalized test");
    const editor = page.locator('#body-editor [contenteditable="true"]');
    await editor.fill("Hi {{first_name}}, welcome to Hartnell.");

    await expect(editor).toContainText("{{first_name}}");

    const preview = page.frameLocator('iframe[title="Rendered email body preview"]');
    await expect(preview.locator("body")).toContainText("Hi Oscar, welcome to Hartnell.");
  });

  test("inserts a personalization token from the recipient-name menu", async ({ page }) => {
    await page.getByRole("button", { name: /Start from scratch/ }).click();

    const editor = page.locator('#body-editor [contenteditable="true"]');
    await editor.fill("Dear ");
    await page.getByRole("button", { name: "Insert recipient name" }).click();
    await page.getByRole("menuitem", { name: /First name/ }).click();

    await expect(editor).toContainText("Dear {{first_name}}");
  });

  test("loads a styled template and preserves its structure when adding a name token", async ({ page }) => {
    await page.getByRole("button", { name: /IT Security Notice.*Use/ }).click();

    const templateFrame = page.frameLocator('iframe[title="Editable rendered email template"]');
    await expect(templateFrame.locator("body")).toContainText("Dear Panthers,");
    await expect(templateFrame.locator("ul")).toBeVisible();

    await templateFrame.locator("p").first().click({ position: { x: 2, y: 2 } });
    await page.getByRole("button", { name: "Insert recipient name" }).click();
    await page.getByRole("menuitem", { name: /First name/ }).click();

    const htmlToggle = page.getByRole("switch", { name: "Show HTML source" });
    await expect(templateFrame.locator("body")).toContainText("{{first_name}}");

    await htmlToggle.click();
    const htmlEditor = page.getByRole("textbox", { name: "HTML message body" });
    await expect(htmlEditor).toContainText("{{first_name}}");
    await expect(htmlEditor).toContainText("background:#52002f");
    await expect(htmlEditor).toContainText("<ul>");

    const preview = page.frameLocator('iframe[title="Rendered email body preview"]');
    await expect(preview.locator("body")).toContainText("Oscar");

    await htmlToggle.click();
    await expect(page.getByTitle("Editable rendered email template")).toBeVisible();
    await expect(page.frameLocator('iframe[title="Editable rendered email template"]').locator("body")).toContainText("{{first_name}}");
  });

  test("updates the preview when ordinary template text is edited", async ({ page }) => {
    await page.getByRole("button", { name: /IT Security Notice.*Use/ }).click();

    const templateFrame = page.frameLocator('iframe[title="Editable rendered email template"]');
    const paragraph = templateFrame.locator("p").nth(1);
    await paragraph.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Edited");
    await expect(templateFrame.locator("body")).toContainText("Welcome to the campus communication test. Edited");

    const preview = page.frameLocator('iframe[title="Rendered email body preview"]');
    await expect(preview.locator("body")).toContainText("Welcome to the campus communication test. Edited");
  });
});
