import { expect, type APIRequestContext, type Page } from "@playwright/test";

type PreviewUpdate = {
  collection: "pages" | "posts";
  data: Record<string, unknown>;
  targetOrigin: string;
};

export async function sendPreviewUpdate(
  page: Page,
  request: APIRequestContext,
  update: PreviewUpdate,
) {
  const previewOrigin =
    process.env.CMS_PREVIEW_ORIGIN ?? process.env.CMS_BASE_URL!;
  const popupUrl = `${previewOrigin}/api/users/me`;
  const context = page.context();
  // Compose uses an internal CMS hostname for the frontend. Route that browser
  // request to the published port while retaining the editor origin.
  await context.route(popupUrl, async (route) => {
    const response = await request.get(
      `${process.env.CMS_BASE_URL}/api/users/me`,
    );
    await route.fulfill({ response });
  });
  let cms: Page | undefined;
  try {
    const popup = page.waitForEvent("popup");
    await page.evaluate((url) => {
      window.open(url);
    }, popupUrl);
    cms = await popup;
    await cms.waitForLoadState();
    const response = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/live-preview",
    );
    await cms.evaluate(({ collection, data, targetOrigin }) => {
      window.opener.postMessage(
        { type: "payload-live-preview", collectionSlug: collection, data },
        targetOrigin,
      );
    }, update);
    expect((await response).status()).toBe(200);
  } finally {
    await cms?.close();
    await context.unroute(popupUrl);
  }
}
