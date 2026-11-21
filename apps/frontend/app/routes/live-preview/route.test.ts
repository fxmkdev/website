import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { action, loader } from "./route";

const id = "678509e0f890471cacad42f7";
const requestBody = {
  endpoint: `pages/${id}`,
  data: { data: { title: "Unsaved title", layout: [] }, depth: 99 },
};

function update(body: unknown = requestBody, key = "preview+key") {
  const url = new URL("https://frontend.example/api/live-preview");
  url.searchParams.set("previewKey", key);
  return action({
    url,
    request: new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as Parameters<typeof action>[0]);
}

beforeEach(() => {
  vi.stubEnv("PREVIEW_KEY", "preview+key");
  vi.stubEnv("PAYLOAD_CMS_BASE_URL", "https://cms.example");
  vi.stubEnv("PAYLOAD_CMS_API_KEY", "server-api-key");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ id, title: "Updated" })),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test.each(["", "wrong"])(
  "rejects a missing or invalid preview key: %s",
  async (key) => {
    expect((await update(requestBody, key)).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  },
);

test("rejects requests when the preview key is not configured", async () => {
  vi.stubEnv("PREVIEW_KEY", "");
  expect((await update()).status).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});

test.each(["pages", "posts"])(
  "proxies %s reads with server credentials and bounded depth",
  async (collection) => {
    const response = await update({
      ...requestBody,
      endpoint: `${collection}/${id}`,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(`https://cms.example/api/${collection}/${id}`);
    expect(init?.headers).toEqual({
      Authorization: "api-keys API-Key server-api-key",
      "Content-Type": "application/json",
      "X-Payload-HTTP-Method-Override": "GET",
    });
    expect(init?.cache).toBe("no-store");
    expect(JSON.parse(init?.body as string)).toEqual({
      data: { id, title: "Unsaved title", layout: [] },
      depth: 1,
      flattenLocales: false,
    });
    expect(await response.json()).toEqual({ id, title: "Updated" });
  },
);

test.each([
  `users/${id}`,
  `pages/${id}?depth=100`,
  "https://untrusted.example/pages",
  "pages/../users",
  "pages/undefined",
])("rejects an unsupported or malformed target: %s", async (endpoint) => {
  expect((await update({ ...requestBody, endpoint })).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});

test.each([null, {}, { ...requestBody, data: { data: [] } }])(
  "rejects malformed payloads: %j",
  async (body) => {
    expect((await update(body)).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  },
);

test("does not expose upstream errors as document data", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ errors: [{ message: "Forbidden" }] }, { status: 403 }),
  );
  const response = await update();
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "Preview update failed" });
});

test("handles network failures", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));
  expect((await update()).status).toBe(502);
});

test("only accepts POST", () => {
  expect(loader().status).toBe(405);
  expect(loader().headers.get("Allow")).toBe("POST");
});
