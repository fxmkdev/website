import { expect, test } from "@playwright/test";
import { heading, richTextRoot, text } from "@fxmk/shared";
import { createPage } from "../common/cms";

test.use({ extraHTTPHeaders: {} });

test("live updates render without any browser cookies or API credentials", async ({
  page,
}) => {
  const document = await createPage({
    hero: {
      richText: richTextRoot(heading("h1", text("Initial preview content"))),
    },
  });
  await page.context().clearCookies();
  await page.goto(
    `${document.pathname}?previewKey=preview-key&livePreviewDocument=page`,
  );
  await expect(
    page.getByRole("heading", { name: "Initial preview content" }),
  ).toBeVisible();

  const population = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/live-preview" &&
      response.request().method() === "POST",
  );
  await page.evaluate(
    ({ data, origin }) => {
      window.dispatchEvent(
        new MessageEvent("message", {
          // Match the CMS origin configured in the frontend.
          origin,
          data: { type: "payload-live-preview", collectionSlug: "pages", data },
        }),
      );
    },
    {
      origin: process.env.CMS_PREVIEW_ORIGIN ?? process.env.CMS_BASE_URL!,
      data: {
        ...document,
        hero: {
          richText: richTextRoot(
            heading("h1", text("Updated without cookies")),
          ),
        },
      },
    },
  );

  const response = await population;
  expect(response.status()).toBe(200);
  expect(new URL(response.url()).origin).toBe(new URL(page.url()).origin);
  const headers = await response.request().allHeaders();
  expect(headers.cookie).toBeUndefined();
  expect(headers.authorization).toBeUndefined();
  await expect(
    page.getByRole("heading", { name: "Updated without cookies" }),
  ).toBeVisible();
});

test("a failed preview response preserves content and displays an error", async ({
  page,
}) => {
  const document = await createPage({
    hero: {
      richText: richTextRoot(heading("h1", text("Content stays visible"))),
    },
  });
  await page.goto(
    `${document.pathname}?previewKey=preview-key&livePreviewDocument=page`,
  );
  await expect(
    page.getByRole("heading", { name: "Content stays visible" }),
  ).toBeVisible();
  await page.route("**/api/live-preview?*", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ errors: [{ message: "Forbidden" }] }),
    }),
  );
  await page.evaluate(
    ({ data, origin }) => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin,
          data: { type: "payload-live-preview", collectionSlug: "pages", data },
        }),
      );
    },
    {
      data: document,
      origin: process.env.CMS_PREVIEW_ORIGIN ?? process.env.CMS_BASE_URL!,
    },
  );
  await expect(page.getByRole("alert")).toContainText("Preview update failed");
  await expect(
    page.getByRole("heading", { name: "Content stays visible" }),
  ).toBeVisible();
});
