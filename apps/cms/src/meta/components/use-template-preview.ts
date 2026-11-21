"use client";

import { useFormFields } from "@payloadcms/ui";
import { useEffect, useMemo, useState } from "react";
import {
  buildSocialImage,
  validateSocialImageTemplate,
  type SocialImageTemplateSettings,
} from "@fxmk/shared/social-image";

type PreviewSettings = SocialImageTemplateSettings & {
  baseImage?: string | { id?: string; filename?: string } | null;
};

export function useTemplatePreview(
  imagekitBaseUrl: string | undefined,
  sampleTitle: string,
) {
  const draft = useTemplateDraft(sampleTitle);
  const { settings } = draft;
  const media = useSelectedMedia(settings.baseImage);
  const validationError = validateSocialImageTemplate(settings);
  let message: string | undefined;
  if (!imagekitBaseUrl)
    message = "ImageKit is not configured for this environment.";
  else if (!settings.baseImage)
    message = "Select a base image to see the preview.";
  else if (validationError) message = validationError;
  else if (!draft.sampleTitle.trim())
    message = "Enter a sample title to see the preview.";
  else message = media.message;
  const image =
    !message && media.filename && imagekitBaseUrl
      ? buildSocialImage({
          urlEndpoint: imagekitBaseUrl,
          filename: media.filename,
          title: draft.sampleTitle,
          template: settings,
        })
      : undefined;
  return { image, message, updating: draft.updating };
}

function useTemplateDraft(sampleTitle: string) {
  const snapshot = useFormFields(([fields]) => {
    const value = (name: string) =>
      fields[`socialImageTemplate.${name}`]?.value;
    return JSON.stringify({
      baseImage: value("baseImage"),
      fontFamily: value("fontFamily"),
      fontWeight: value("fontWeight"),
      fontSize: value("fontSize"),
      textColor: value("textColor"),
      titlePosition: value("titlePosition"),
      margins: {
        top: value("margins.top"),
        right: value("margins.right"),
        bottom: value("margins.bottom"),
        left: value("margins.left"),
      },
    });
  });
  const [draft, setDraft] = useState({ snapshot, sampleTitle });
  useEffect(() => {
    const timeout = setTimeout(() => setDraft({ snapshot, sampleTitle }), 300);
    return () => clearTimeout(timeout);
  }, [snapshot, sampleTitle]);
  const settings = useMemo(
    () => JSON.parse(draft.snapshot) as PreviewSettings,
    [draft.snapshot],
  );
  return {
    settings,
    sampleTitle: draft.sampleTitle,
    updating: snapshot !== draft.snapshot || sampleTitle !== draft.sampleTitle,
  };
}

function useSelectedMedia(selected: PreviewSettings["baseImage"]) {
  const id = typeof selected === "string" ? selected : selected?.id;
  const populatedFilename =
    typeof selected === "object" ? selected?.filename : undefined;
  const [media, setMedia] = useState<{
    id?: string;
    filename?: string;
    error?: string;
  }>({});

  useEffect(() => {
    if (!id || populatedFilename) return;
    const controller = new AbortController();
    setMedia({ id });
    fetch(`/api/media/${encodeURIComponent(id)}?depth=0`, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Unable to load the selected base image.");
        const data = await response.json();
        if (typeof data.filename !== "string" || !data.filename)
          throw new Error("The selected media has no image filename.");
        if (!controller.signal.aborted)
          setMedia({ id, filename: data.filename });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMedia({
            id,
            error:
              "Unable to load the selected base image. Check your selection and try again.",
          });
      });
    return () => controller.abort();
  }, [id, populatedFilename]);

  if (populatedFilename) return { filename: populatedFilename };
  if (media.id === id && media.filename) return { filename: media.filename };
  return {
    message: !id
      ? "Unable to load the selected base image."
      : media.id === id && media.error
        ? media.error
        : "Loading base image…",
  };
}
