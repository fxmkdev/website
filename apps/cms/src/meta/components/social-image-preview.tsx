"use client";

import { useState } from "react";
import Image from "next/image";
import { useTemplatePreview } from "./use-template-preview";
import "./social-image.scss";

type Props = { imagekitBaseUrl?: string };

export function SocialImagePreview({ imagekitBaseUrl }: Props) {
  const [sampleTitle, setSampleTitle] = useState(
    "Designing thoughtful software for the web",
  );
  const { image, message, updating } = useTemplatePreview(
    imagekitBaseUrl,
    sampleTitle,
  );
  const [result, setResult] = useState<{ url: string; failed: boolean }>();
  const failed = image && result?.url === image.url && result.failed;
  const loading = image && result?.url !== image.url;
  return (
    <section
      className="social-image-preview"
      aria-label="Social image template preview"
    >
      <h3>Template preview</h3>
      <p>
        Preview unsaved settings with sample text. The sample title is not
        saved.
      </p>
      <label>
        Sample title
        <textarea
          value={sampleTitle}
          onChange={(event) => setSampleTitle(event.target.value)}
          rows={2}
          maxLength={1000}
        />
      </label>
      <div role="status" aria-live="polite">
        {updating
          ? "Updating preview…"
          : message ||
            (failed
              ? "The image preview could not be loaded. Change the settings or base image to try again."
              : loading
                ? "Loading image preview…"
                : "")}
      </div>
      {image && !failed && (
        <Image
          unoptimized
          key={image.url}
          src={image.url}
          alt="Social image preview"
          width={1200}
          height={630}
          onLoad={() => setResult({ url: image.url, failed: false })}
          onError={() => setResult({ url: image.url, failed: true })}
        />
      )}
    </section>
  );
}
