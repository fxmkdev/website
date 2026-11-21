import { MetaImageField } from "@payloadcms/plugin-seo/fields";

export function seoImageField() {
  const field = MetaImageField({ relationTo: "media" });
  field.label = "Social image override";
  // The plugin applies overrides shallowly, so retain its custom field editor.
  field.admin = {
    ...field.admin,
    description:
      "Optional manual override. Leave empty to use the global Social Image Template with this document’s title.",
  };
  return field;
}
