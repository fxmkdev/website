import type { useLivePreview } from "@payloadcms/live-preview-react";

export type PreviewDocument = { id: string; title: string };
type RequestHandler = NonNullable<
  Parameters<typeof useLivePreview>[0]["requestHandler"]
>;

export function createPreviewRequestHandler<T extends PreviewDocument>(
  initialData: T,
  onFailure: (failed: boolean) => void,
): RequestHandler {
  let lastValidData = initialData;
  let latestRequest = 0;

  return async ({ endpoint, data }) => {
    const request = ++latestRequest;
    try {
      const url = new URL("/api/live-preview", window.location.origin);
      const previewKey = new URL(window.location.href).searchParams.get(
        "previewKey",
      );
      if (previewKey) url.searchParams.set("previewKey", previewKey);
      const response = await fetch(url, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, data }),
      });
      if (!response.ok) throw new Error("Preview request failed");
      const updatedData: unknown = await response.json();
      if (!isPreviewDocument(updatedData, initialData.id)) {
        throw new Error("Invalid preview response");
      }
      // Requests for consecutive edits can complete out of order.
      if (request === latestRequest) {
        lastValidData = updatedData as T;
        onFailure(false);
      }
    } catch {
      if (request === latestRequest) onFailure(true);
    }
    return Response.json(lastValidData);
  };
}

function isPreviewDocument(
  value: unknown,
  id: string,
): value is PreviewDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    !("errors" in value) &&
    "id" in value &&
    value.id === id &&
    "title" in value &&
    typeof value.title === "string"
  );
}
