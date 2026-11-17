import fs from "fs/promises";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { tryGetPage } from "./cms-data.server";

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PAYLOAD_CMS_BASE_URL", "https://cms.example.com");
  vi.stubEnv("PAYLOAD_CMS_API_KEY", "test-api-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("loads unpublished page drafts without reading or writing the published cache", async () => {
  const draft = { id: "draft-page", _status: "draft" };
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ docs: [draft] }));
  vi.stubGlobal("fetch", fetchMock);

  expect(await tryGetPage("/experiences/lost-city", true)).toEqual(draft);

  const url = fetchMock.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/api/pages");
  expect(url.searchParams.get("draft")).toBe("true");
  expect(url.searchParams.get("where[pathname][equals]")).toBe(
    "/experiences/lost-city",
  );
  expect(url.searchParams.has("where[_status][equals]")).toBe(false);
  expect(fs.readFile).not.toHaveBeenCalled();
  expect(fs.writeFile).not.toHaveBeenCalled();
});

test("keeps ordinary page loads published-only and caches their result", async () => {
  const published = { id: "published-page", _status: "published" };
  vi.mocked(fs.readFile).mockRejectedValue(
    Object.assign(new Error("Cache missing"), { code: "ENOENT" }),
  );
  const fetchMock = vi
    .fn()
    .mockResolvedValue(Response.json({ docs: [published] }));
  vi.stubGlobal("fetch", fetchMock);

  expect(await tryGetPage("/")).toEqual(published);

  const url = fetchMock.mock.calls[0][0] as URL;
  expect(url.searchParams.get("draft")).toBe("false");
  expect(url.searchParams.get("where[_status][equals]")).toBe("published");
  expect(fs.readFile).toHaveBeenCalled();
  expect(fs.writeFile).toHaveBeenCalledWith(
    "./.cms-cache/pages_:/data.json",
    JSON.stringify(published),
  );
});

test("returns null for an unknown draft page", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ docs: [] })),
  );

  expect(await tryGetPage("/missing", true)).toBeNull();
  expect(fs.writeFile).not.toHaveBeenCalled();
});
