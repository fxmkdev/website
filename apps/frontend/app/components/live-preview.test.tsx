import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { OptInLivePreview } from "./live-preview";

const cmsOrigin = "https://cms.example";
const initialData = {
  id: "678509e0f890471cacad42f7",
  title: "Initial content",
};

vi.mock("~/utils/environment", () => ({
  useEnvironment: () => ({
    payloadCmsBaseUrl: "https://cms.example",
    livePreviewDocument: "page",
  }),
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/about?previewKey=preview%2Bkey");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPreview() {
  render(
    <OptInLivePreview document="page" data={initialData} depth={1}>
      {(data) => <h1>{data.title}</h1>}
    </OptInLivePreview>,
  );
}

async function sendUpdate() {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: cmsOrigin,
        data: {
          type: "payload-live-preview",
          collectionSlug: "pages",
          data: { ...initialData, title: "Edited content" },
        },
      }),
    );
  });
}

test("loads updates through the frontend without cookies", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ ...initialData, title: "Edited content" }),
  );
  renderPreview();
  await sendUpdate();
  expect(
    await screen.findByRole("heading", { name: "Edited content" }),
  ).toBeVisible();
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect((url as URL).origin).toBe(window.location.origin);
  expect((url as URL).pathname).toBe("/api/live-preview");
  expect((url as URL).searchParams.get("previewKey")).toBe("preview+key");
  expect(init?.credentials).toBe("omit");
});

test.each([
  () => Response.json({ errors: [{ message: "Forbidden" }] }, { status: 403 }),
  () => Response.json({ errors: [{ message: "Unexpected error" }] }),
  () => Response.json({ id: "another-document", title: "Wrong content" }),
])(
  "keeps content visible when a preview response fails validation",
  async (response) => {
    vi.mocked(fetch).mockResolvedValue(response());
    renderPreview();
    await sendUpdate();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Preview update failed",
    );
    expect(
      screen.getByRole("heading", { name: "Initial content" }),
    ).toBeVisible();
  },
);

test("retains the latest successful update after a failure and recovers", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(
      Response.json({ ...initialData, title: "Successful update" }),
    )
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce(
      Response.json({ ...initialData, title: "Recovered update" }),
    );
  renderPreview();
  await sendUpdate();
  expect(
    await screen.findByRole("heading", { name: "Successful update" }),
  ).toBeVisible();
  await sendUpdate();
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Successful update" }),
  ).toBeVisible();
  await sendUpdate();
  expect(
    await screen.findByRole("heading", { name: "Recovered update" }),
  ).toBeVisible();
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});
