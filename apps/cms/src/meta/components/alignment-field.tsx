"use client";

import { useField } from "@payloadcms/ui";
import type { SelectFieldClientProps } from "payload";
import {
  socialImageAlignment,
  socialImagePosition,
  type HorizontalAlignment,
  type VerticalAlignment,
} from "@fxmk/shared/social-image";
import "./social-image.scss";

export function AlignmentField({
  path,
  field,
  readOnly,
}: SelectFieldClientProps) {
  const { value, setValue, showError, errorMessage } = useField<string>({
    path: path || field.name,
  });
  const { horizontal, vertical } = socialImageAlignment(value || "bottom-left");
  return (
    <fieldset className="social-image-alignment" disabled={Boolean(readOnly)}>
      <legend>Title alignment</legend>
      <label>
        Horizontal alignment
        <select
          value={horizontal}
          onChange={(event) =>
            setValue(
              socialImagePosition(
                event.target.value as HorizontalAlignment,
                vertical,
              ),
            )
          }
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>
      <label>
        Vertical alignment
        <select
          value={vertical}
          onChange={(event) =>
            setValue(
              socialImagePosition(
                horizontal,
                event.target.value as VerticalAlignment,
              ),
            )
          }
        >
          <option value="top">Top</option>
          <option value="center">Center</option>
          <option value="bottom">Bottom</option>
        </select>
      </label>
      {showError && <p role="alert">{errorMessage}</p>}
    </fieldset>
  );
}
