import { GlobalConfig } from "payload";
import { refreshCacheForGlobals } from "@/hooks/refresh-cache-hook";

export const Meta: GlobalConfig = {
  slug: "meta",
  hooks: {
    afterChange: [({ req }) => refreshCacheForGlobals(["meta"], req)],
  },
  fields: [
    {
      name: "socialImageTemplate",
      label: "Social Image Template",
      type: "group",
      admin: {
        description:
          "Used for pages and posts without a manual SEO image. Select a base image once to enable automatic previews.",
      },
      fields: [
        {
          name: "baseImage",
          type: "upload",
          relationTo: "media",
          filterOptions: {
            mimeType: {
              in: ["image/jpeg", "image/png", "image/webp", "image/avif"],
            },
          },
          admin: {
            description:
              "Use a 1200×630 image with space for a title inside a 72-pixel margin. Existing SEO images take priority.",
          },
        },
        {
          name: "titlePosition",
          type: "select",
          defaultValue: "bottom-left",
          options: [
            { label: "Top left", value: "top-left" },
            { label: "Center", value: "center" },
            { label: "Bottom left", value: "bottom-left" },
          ],
        },
        {
          name: "fontSize",
          type: "number",
          min: 32,
          max: 72,
          defaultValue: 64,
          validate: (value: number | null | undefined) =>
            value == null ||
            (Number.isInteger(value) && value >= 32 && value <= 72)
              ? true
              : "Use a whole number from 32 to 72 pixels.",
        },
        {
          name: "textColor",
          type: "text",
          defaultValue: "#FFFFFF",
          validate: (value: string | null | undefined) =>
            !value || /^#[0-9a-f]{6}$/i.test(value)
              ? true
              : "Use a six-digit hex color, for example #FFFFFF.",
        },
      ],
    },
    {
      name: "siteName",
      label: "Site Name",
      type: "text",
    },
    {
      name: "locale",
      label: "Locale Code (e.g. 'en')",
      type: "text",
    },
    {
      name: "favicon",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "faviconSvg",
      label: "Favicon (SVG)",
      type: "upload",
      relationTo: "media",
      filterOptions: {
        mimeType: {
          equals: "image/svg+xml",
        },
      },
    },
    {
      name: "faviconIco",
      label: "Favicon (ICO)",
      type: "upload",
      relationTo: "media",
      filterOptions: {
        mimeType: {
          equals: "image/vnd.microsoft.icon",
        },
      },
    },
    {
      name: "themeColor",
      label: "Theme Color",
      type: "text",
      admin: {
        description: "CSS color for the theme color",
      },
    },
    {
      name: "themeColorDark",
      label: "Theme Color (dark mode)",
      type: "text",
      admin: {
        description: "CSS color for the dark mode theme color",
      },
    },
    {
      name: "backgroundColor",
      label: "Background Color",
      type: "text",
      admin: {
        description: "CSS color for the background color",
      },
    },
  ],
};
