import { useLivePreview } from "@payloadcms/live-preview-react";
import { type ReactNode, useMemo, useState } from "react";
import { useEnvironment } from "~/utils/environment";
import {
  createPreviewRequestHandler,
  type PreviewDocument,
} from "./preview-request";

export type OptInLivePreviewProps<TData extends PreviewDocument> = {
  document: string;
  data: TData;
  depth: number;
  children: (data: TData) => ReactNode;
};

export function OptInLivePreview<TData extends PreviewDocument>({
  children,
  document,
  data,
  depth,
}: OptInLivePreviewProps<TData>) {
  const { livePreviewDocument } = useEnvironment();

  return !!livePreviewDocument && livePreviewDocument === document ? (
    <LivePreview key={data.id} data={data} depth={depth}>
      {children}
    </LivePreview>
  ) : (
    children(data)
  );
}

type LivePreviewProps<TData extends PreviewDocument> = {
  data: TData;
  depth: number;
  children: (data: TData) => ReactNode;
};

function LivePreview<T extends PreviewDocument>({
  data,
  depth,
  children,
}: LivePreviewProps<T>) {
  const { payloadCmsBaseUrl } = useEnvironment();
  const [updateFailed, setUpdateFailed] = useState(false);
  const requestHandler = useMemo(
    () => createPreviewRequestHandler(data, setUpdateFailed),
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
