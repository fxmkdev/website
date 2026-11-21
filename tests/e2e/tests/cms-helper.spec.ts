import { expect, test } from "@playwright/test";
import { update } from "../common/cms";

test("CMS updates return the saved document rather than the REST response wrapper", async () => {
  const document = {
    id: "saved-document",
    title: "Saved draft",
    _status: "draft",
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      doc: document,
      message: "Draft saved successfully",
    });
  try {
    const saved = await update("pages/saved-document?draft=true", {
      title: document.title,
      _status: document._status,
    });
    expect(saved).toEqual(document);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
