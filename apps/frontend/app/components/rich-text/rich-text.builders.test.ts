import { expect, test } from "vitest";
import type { Page, Post } from "@fxmk/payload-types";
import {
  text,
  bold,
  italic,
  underline,
  paragraph,
  customUrlLink,
  strikethrough,
  code,
  richTextRoot,
  heading,
  list,
  internalLink,
  lineBreak,
  listitem,
  tab,
  type Node,
} from "@fxmk/shared";

test("Shared builders produce rich text compatible with Payload documents", () => {
  const content = richTextRoot(
    paragraph(text("Default Content")),
  ) satisfies Post["content"];
  const hero = richTextRoot(
    heading("h1", text("E2E Test Page")),
  ) satisfies NonNullable<Page["hero"]>["richText"];

  expect(content.root).toMatchObject({
    type: "root",
    direction: null,
    format: "",
    indent: 0,
    version: 1,
    children: [
      {
        type: "paragraph",
        version: 1,
        children: [{ type: "text", text: "Default Content", version: 1 }],
      },
    ],
  });
  expect(hero.root.children[0]).toMatchObject({
    type: "heading",
    tag: "h1",
    version: 1,
  });
});

test("Shared builders preserve node versions throughout nested content", () => {
  const content = richTextRoot(
    list(
      "ul",
      listitem(
        paragraph(
          2,
          bold("Bold"),
          italic("Italic"),
          underline("Underline"),
          strikethrough("Strike"),
          code("Code"),
          lineBreak(),
          tab(),
          customUrlLink("https://example.com", text("External")),
          internalLink("/page", text("Internal")),
        ),
      ),
    ),
  );

  function expectVersion(node: Node | typeof content.root) {
    expect(node.version).toBe(1);
    if ("children" in node) node.children.forEach(expectVersion);
  }

  expectVersion(content.root);
});
