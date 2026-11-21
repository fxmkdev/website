type TextArea = {
  fontSize: number;
  width: number;
  height: number;
  widthScale: number;
};

export function fitSocialImageTitle(title: string, area: TextArea) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const encoder = new TextEncoder();
  let bytes = 0;
  let truncated = false;
  const characters = Array.from(
    segmenter.segment(title.replace(/\s+/gu, " ").trim()),
    ({ segment }) => segment,
  ).filter((character) => {
    bytes += encoder.encode(character).length;
    // Leave room for line breaks and an ellipsis under ImageKit's base64 limit.
    if (bytes > 1200) {
      truncated = true;
      return false;
    }
    return true;
  });
  if (truncated) characters.push("…");
  const maxColumns = Math.floor(area.width / area.fontSize);
  const maxLines = Math.floor(area.height / (area.fontSize * 1.5));
  const characterWidth = (text: string) =>
    titleCharacterWidth(text) * area.widthScale;
  const lines: string[] = [];
  while (characters.length && lines.length < maxLines) {
    let count = 0;
    let columns = 0;
    while (count < characters.length) {
      const width = characterWidth(characters[count]);
      if (columns + width > maxColumns) break;
      columns += width;
      count++;
    }
    if (
      count < characters.length &&
      (lines.length === maxLines - 1 || count === 0)
    ) {
      while (columns + characterWidth("…") > maxColumns && count > 0)
        columns -= characterWidth(characters[--count]);
      lines.push(characters.slice(0, count).join("").trimEnd() + "…");
      break;
    }
    if (characters.length > count && characters[count] !== " ") {
      const space = characters.slice(0, count).lastIndexOf(" ");
      if (space > 0) count = space;
    }
    lines.push(characters.splice(0, count).join("").trim());
    while (characters[0] === " ") characters.shift();
  }
  return lines.join("\n");
}

function titleCharacterWidth(grapheme: string) {
  // Conservative bold Roboto estimates; other families use a safety factor.
  // Unknown Unicode reserves space for wide/fallback glyphs in joined emoji.
  return Array.from(grapheme).reduce((width, character) => {
    if (character === " ") return width + 0.35;
    if (/^[ijlI.,:;'!|]$/.test(character)) return width + 0.4;
    if (/^[a-z0-9]$/.test(character) && !/[mw]/.test(character))
      return width + 0.7;
    if (/^[A-Z]$/.test(character) && !/[MW]/.test(character))
      return width + 0.85;
    return width + (character.codePointAt(0)! > 127 ? 2 : 1);
  }, 0);
}
