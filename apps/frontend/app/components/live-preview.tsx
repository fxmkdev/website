import { useLivePreview } from "@payloadcms/live-preview-react";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { useEnvironment } from "~/utils/environment";

export type OptInLivePreviewProps<TData extends object> = {
  document: string;
  data: TData;
  depth: number;
  children: (data: TData) => ReactNode;
};

export function OptInLivePreview<TData extends object>({
  children,
  document,
  data,
  depth,
}: OptInLivePreviewProps<TData>) {
  const { livePreviewDocument } = useEnvironment();

  return !!livePreviewDocument && livePreviewDocument === document ? (
    <LivePreview
      key={"id" in data ? String(data.id) : undefined}
      data={data}
      depth={depth}
    >
      {children}
    </LivePreview>
  ) : (
    children(data)
  );
}

type LivePreviewProps<TData extends object> = {
  data: TData;
  depth: number;
  children: (data: TData) => ReactNode;
};

function LivePreview<T extends object>({
  data,
  depth,
  children,
}: LivePreviewProps<T>) {
  const { payloadCmsBaseUrl } = useEnvironment();
  const lastValidData = useRef(data);
  const [updateFailed, setUpdateFailed] = useState(false);
  const requestHandler = useCallback<
    NonNullable<Parameters<typeof useLivePreview>[0]["requestHandler"]>
  >(
    async ({ endpoint, data: incomingData }) => {
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
          body: JSON.stringify({ endpoint, data: incomingData }),
        });
        if (!response.ok) throw new Error("Preview request failed");
        const updatedData: unknown = await response.json();
        if (
          !updatedData ||
          typeof updatedData !== "object" ||
          "errors" in updatedData ||
          !("id" in updatedData) ||
          !("id" in data) ||
          updatedData.id !== data.id
        ) {
          throw new Error("Invalid preview response");
        }
        lastValidData.current = updatedData as T;
        setUpdateFailed(false);
      } catch {
        setUpdateFailed(true);
      }
      return Response.json(lastValidData.current);
    },
    [data],
  );
  const { data: livePreviewData } = useLivePreview({
    initialData: data as Record<string, unknown>,
    serverURL: payloadCmsBaseUrl,
    depth,
    requestHandler,
  });
  return (
    <>
      {children(livePreviewData as T)}
      {updateFailed && (
        <p
          role="alert"
          className="fixed right-4 bottom-4 left-4 z-50 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          Preview update failed. Showing the last valid version.
        </p>
      )}
    </>
  );
}
