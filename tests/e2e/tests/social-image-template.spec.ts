import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { create } from "../common/cms";

// A valid one-pixel PNG; image responses are controlled to avoid relying on ImageKit.
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==",
  "base64",
);

test("template preview reflects unsaved controls and handles missing media and image failures", async ({
  browser,
}) => {
  const cms = process.env.CMS_BASE_URL!;
  const email = `social-preview-${randomUUID()}@example.com`;
  const password = randomUUID();
  const user = await create("users", { email, password });
  const context = await browser.newContext();
  let mediaId: string | undefined;
  try {
    const login = await context.request.post(`${cms}/api/users/login`, {
      data: { email, password },
      headers: { Origin: cms },
    });
    expect(login.ok()).toBe(true);
    const filename = `social-preview-${randomUUID()}.png`;
    const upload = await context.request.post(`${cms}/api/media`, {
      multipart: {
        _payload: "{}",
        file: { name: filename, mimeType: "image/png", buffer: pixel },
      },
    });
    expect(upload.ok(), await upload.text()).toBe(true);
    mediaId = (await upload.json()).doc.id;
    const before = await (
      await context.request.get(`${cms}/api/globals/meta`)
    ).json();
    const page = await context.newPage();
    let failImage = false;
    let failMedia = false;
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (route.request().resourceType() === "image") {
        if (failImage && url.searchParams.get("tr")?.includes("l-text"))
          await route.abort();
        else await route.fulfill({ contentType: "image/png", body: pixel });
      } else if (
        failMedia &&
        url.pathname === `/api/media/${mediaId}` &&
        url.searchParams.get("depth") === "0"
      ) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: '{"errors":[{"message":"Not found"}]}',
        });
      } else await route.continue();
    });
    await page.goto(`${cms}/admin/globals/meta`);
    const preview = page.getByRole("region", {
      name: "Social image template preview",
    });
    await expect(preview).toContainText(
      "Select a base image to see the preview.",
    );
    const selectBase = async () => {
      await page
        .locator("#field-socialImageTemplate__baseImage")
        .getByRole("button", { name: "Choose from existing" })
        .click();
      await page.getByText(filename, { exact: true }).last().click();
    };
    await selectBase();
    const image = preview.getByRole("img", { name: "Social image preview" });
    await expect(image).toBeVisible();
    await page.getByLabel("Font Family", { exact: true }).click();
    await page.getByRole("option", { name: "Montserrat", exact: true }).click();
    await page.getByLabel("Font Weight", { exact: true }).click();
    await page.getByRole("option", { name: "Regular", exact: true }).click();
    await page
      .getByLabel("Horizontal alignment", { exact: true })
      .selectOption("right");
    await page
      .getByLabel("Vertical alignment", { exact: true })
      .selectOption("top");
    await page.locator("#field-socialImageTemplate__margins__left").fill("180");
    await preview.getByLabel("Sample title").fill("Unsaved sample title");
    await expect
      .poll(async () => {
        const src = await image.getAttribute("src");
        if (!src) return "";
        const tr = new URL(src).searchParams.get("tr")!;
        const title = Buffer.from(tr.match(/ie-([^,]+)/)![1], "base64")
          .toString("utf8")
          .replaceAll("\n", " ");
        return JSON.stringify({
          font: tr.includes("ff-Montserrat"),
          regular: !tr.includes("tg-b"),
          width: tr.includes("w-948"),
          position: tr.includes("ia-right,lap-top_right,lx-N72,ly-72"),
          title,
        });
      })
      .toBe(
        JSON.stringify({
          font: true,
          regular: true,
          width: true,
          position: true,
          title: "Unsaved sample title",
        }),
      );
    const after = await (
      await context.request.get(`${cms}/api/globals/meta`)
    ).json();
    expect(after.socialImageTemplate).toEqual(before.socialImageTemplate);
    expect(JSON.stringify(after)).not.toContain("Unsaved sample title");
    failImage = true;
    await preview.getByLabel("Sample title").fill("Image loading failure");
    await expect(preview).toContainText(
      "The image preview could not be loaded.",
    );
    page.on("dialog", (dialog) => dialog.accept());
    await page.reload();
    await expect(preview).toContainText(
      "Select a base image to see the preview.",
    );
    failMedia = true;
    await selectBase();
    await expect(preview).toContainText(
      "Unable to load the selected base image.",
    );
    await expect(preview.getByLabel("Sample title")).toBeEditable();
  } finally {
    if (mediaId)
      expect(
        (await context.request.delete(`${cms}/api/media/${mediaId}`)).ok(),
      ).toBe(true);
    await context.close();
    const cleanup = await fetch(`${cms}/api/users/${user.id}`, {
      method: "DELETE",
      headers: { Authorization: `api-keys API-Key ${process.env.CMS_API_KEY}` },
    });
    expect(cleanup.ok).toBe(true);
  }
});
