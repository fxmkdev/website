import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { RichText } from "./rich-text";
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
  unsupportedElementWithoutChildren,
  lineBreak,
  listitem,
  tab,
  type Node,
} from "@fxmk/shared";
import type { PropsWithChildren } from "react";
import type { Page, Post } from "@fxmk/payload-types";

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

test("Bold text node is rendered as <strong> element.", () => {
  render(
    <RichText
      content={richTextRoot(
        paragraph(text("Hello, "), bold("world"), text("!")),
      )}
    />,
  );

  expect(screen.getByRole("paragraph")).toHaveTextContent("Hello, world!");
  expect(screen.getByRole("strong")).toHaveTextContent("world");
});

test("Italic text node is rendered as <em> element.", () => {
  render(
    <RichText
      content={richTextRoot(
        paragraph(text("Hello, "), italic("world"), text("!")),
      )}
    />,
  );

  expect(screen.getByRole("paragraph")).toHaveTextContent("Hello, world!");
  expect(screen.getByRole("emphasis")).toHaveTextContent("world");
});

test("Underline text node is rendered as <u> element.", () => {
  render(
    <RichText
      content={richTextRoot(
        paragraph(text("Hello, "), underline("world"), text("!")),
      )}
    />,
  );

  expect(screen.getByRole("paragraph")).toHaveTextContent("Hello, world!");
  expect(screen.getByText("world")).toHaveStyle("text-decoration: underline");
});

test("Strikethrough text node is rendered as <s> element.", () => {
  render(
    <RichText
      content={richTextRoot(
        paragraph(text("Hello, "), strikethrough("world"), text("!")),
      )}
    />,
  );

  expect(screen.getByRole("paragraph")).toHaveTextContent("Hello, world!");
  expect(screen.getByText("world")).toHaveStyle(
    "text-decoration: line-through",
  );
});

test("Code text node is rendered as <code> element.", () => {
  render(
    <RichText
      content={richTextRoot(
        paragraph(text("Hello, "), code("world"), text("!")),
      )}
    />,
  );

  expect(screen.getByRole("paragraph")).toHaveTextContent("Hello, world");
  expect(screen.getByRole("code")).toHaveTextContent("world");
});

test("Text nodes with multiple styles on the same node are rendered correctly", () => {
  const { container } = render(
    <RichText
      content={richTextRoot(
        paragraph(
          text("Hello, "),
          text("world", {
            bold: true,
            italic: true,
            underline: true,
          }),
          text("!"),
        ),
      )}
    />,
  );

  expect(container).toMatchInlineSnapshot(`
    <div>
      <p>
        Hello, 
        <u>
          <em>
            <strong>
              world
            </strong>
          </em>
        </u>
        !
      </p>
    </div>
  `);
});

test("Paragraph element nodes are rendered as paragraphs.", () => {
  render(
    <RichText
      content={richTextRoot(
        paragraph(text("Hello, "), underline("world"), text("!")),
        paragraph(text("This is the next line")),
        paragraph(text("This is the last line")),
      )}
    />,
  );

  const paragraphs = screen.getAllByRole("paragraph");

  expect(paragraphs).toHaveLength(3);
  expect(paragraphs[0]).toHaveTextContent("Hello, world!");
  expect(paragraphs[1]).toHaveTextContent("This is the next line");
  expect(paragraphs[2]).toHaveTextContent("This is the last line");
});

test("heading element nodes are rendered as heading elements with the correct level.", () => {
  render(
    <RichText content={richTextRoot(heading("h4", text("Hello, world!")))} />,
  );

  expect(screen.getByRole("heading", { level: 4 })).toHaveTextContent(
    "Hello, world!",
  );
});

test("heading elements have an anchor ID with the slugified text content", () => {
  render(
    <RichText
      content={richTextRoot(
        heading("h4", text("Hello, "), lineBreak(), bold("world!")),
      )}
    />,
  );

  expect(screen.getByRole("heading")).toHaveAttribute("id", "hello-world");
});

test("heading anchor IDs prevents duplicate IDs by appending a counter", () => {
  render(
    <RichText
      content={richTextRoot(
        heading("h4", text("Hello, world!")),
        heading("h4", text("Hello, world!")),
        heading("h4", text("Hello, world!")),
      )}
    />,
  );

  const headingElements = screen.getAllByRole("heading");
  expect(headingElements[0]).toHaveAttribute("id", "hello-world");
  expect(headingElements[1]).toHaveAttribute("id", "hello-world-2");
  expect(headingElements[2]).toHaveAttribute("id", "hello-world-3");
});

test("ul element nodes with li as children are rendered as <ul> and <li> elements.", () => {
  render(
    <RichText
      content={richTextRoot(
        list(
          "ul",
          listitem(text("First item")),
          listitem(text("Second item")),
          listitem(text("Third item")),
        ),
      )}
    />,
  );

  const listElement = screen.getByRole("list");
  expect(listElement).toBeInTheDocument();
  expect(within(listElement).getAllByRole("listitem")).toHaveLength(3);
  expect(within(listElement).getByText("First item")).toBeInTheDocument();
  expect(within(listElement).getByText("Second item")).toBeInTheDocument();
  expect(within(listElement).getByText("Third item")).toBeInTheDocument();
});

test("ol element nodes with li as children are rendered as <ol> and <li> elements.", () => {
  render(
    <RichText
      content={richTextRoot(
        list(
          "ol",
          listitem(text("First item")),
          listitem(text("Second item")),
          listitem(text("Third item")),
        ),
      )}
    />,
  );

  const listElement = screen.getByRole("list");
  expect(listElement).toBeInTheDocument();
  expect(within(listElement).getAllByRole("listitem")).toHaveLength(3);
  expect(within(listElement).getByText("First item")).toBeInTheDocument();
  expect(within(listElement).getByText("Second item")).toBeInTheDocument();
  expect(within(listElement).getByText("Third item")).toBeInTheDocument();
});

test("link element nodes are rendered as <a> elements with the correct href attribute for a custom URL link.", () => {
  render(
    <RichText
      content={richTextRoot(
        customUrlLink("https://example.com", text("Click here!")),
      )}
    />,
  );

  const linkElement = screen.getByRole("link");
  expect(linkElement).toHaveTextContent("Click here!");
  expect(linkElement).toHaveAttribute("href", "https://example.com");
});

test("link element nodes are rendered as <a> elements with the correct href attribute for an internal link.", () => {
  render(
    <RichText
      content={richTextRoot(internalLink("/cancellation", text("Click here!")))}
    />,
  );

  const linkElement = screen.getByRole("link");
  expect(linkElement).toHaveTextContent("Click here!");
  expect(linkElement).toHaveAttribute("href", "/cancellation");
});

describe("block element nodes", () => {
  test("Block elements are rendered as the specified component with the fields passed through.", () => {
    render(
      <RichText
        content={richTextRoot({
          type: "block",
          version: 1,
          fields: {
            blockType: "testBlock",
            testField: "Test Field Value",
          },
        })}
        blocks={{ testBlock: TestBlockComponent }}
      />,
    );

    expect(screen.getByRole("paragraph")).toHaveTextContent("Test Field Value");

    function TestBlockComponent({ testField }: { testField: string }) {
      return <p>{testField}</p>;
    }
  });

  test("An error is thrown if the block type is unknown.", () => {
    expect(() =>
      render(
        <RichText
          content={richTextRoot({
            type: "block",
            version: 1,
            fields: { blockType: "unknownBlock" },
          })}
        />,
      ),
    ).toThrowError(/unsupported block type 'unknownBlock'/i);
  });
});

test("line breaks are rendered as <br /> elements.", () => {
  const { container } = render(
    <RichText
      content={richTextRoot(
        paragraph(text("hello"), lineBreak(), text("world")),
      )}
    />,
  );

  expect(container).toMatchInlineSnapshot(`
    <div>
      <p>
        hello
        <br />
        world
      </p>
    </div>
  `);
});

test("tabs are rendered as whitespace.", () => {
  render(
    <RichText
      content={richTextRoot(paragraph(text("hello"), tab(), text("world")))}
    />,
  );

  expect(screen.getByText("hello world")).toBeInTheDocument();
});

describe("custom elements", () => {
  test("if a custom bold element is specified, it is used for bold text nodes", () => {
    function CustomHighlight({ children }: PropsWithChildren) {
      return <span data-testid="custom-highlight">{children}</span>;
    }

    render(
      <RichText
        content={richTextRoot(paragraph(bold("Hello, world!")))}
        elements={{
          bold: CustomHighlight,
        }}
      />,
    );

    expect(screen.getByTestId("custom-highlight")).toHaveTextContent(
      "Hello, world!",
    );
  });

  test("if a custom italic element is specified, it is used for italic text nodes", () => {
    function CustomItalic({ children }: PropsWithChildren) {
      return <span data-testid="custom-italic">{children}</span>;
    }

    render(
      <RichText
        content={richTextRoot(paragraph(italic("Hello, world!")))}
        elements={{
          italic: CustomItalic,
        }}
      />,
    );

    expect(screen.getByTestId("custom-italic")).toHaveTextContent(
      "Hello, world!",
    );
  });

  test("if a custom underline element is specified, it is used for underline text nodes", () => {
    function CustomUnderline({ children }: PropsWithChildren) {
      return <span data-testid="custom-underline">{children}</span>;
    }

    render(
      <RichText
        content={richTextRoot(paragraph(underline("Hello, world!")))}
        elements={{
          underline: CustomUnderline,
        }}
      />,
    );

    expect(screen.getByTestId("custom-underline")).toHaveTextContent(
      "Hello, world!",
    );
  });

  test("if a custom strikethrough element is specified, it is used for strikethrough text nodes", () => {
    function CustomStrikethrough({ children }: PropsWithChildren) {
      return <span data-testid="custom-strikethrough">{children}</span>;
    }

    render(
      <RichText
        content={richTextRoot(paragraph(strikethrough("Hello, world!")))}
        elements={{
          strikethrough: CustomStrikethrough,
        }}
      />,
    );

    expect(screen.getByTestId("custom-strikethrough")).toHaveTextContent(
      "Hello, world!",
    );
  });

  test("if a custom code element is specified, it is used for code text nodes", () => {
    function CustomCode({ children }: PropsWithChildren) {
      return <span data-testid="custom-code">{children}</span>;
    }

    render(
      <RichText
        content={richTextRoot(paragraph(code("Hello, world!")))}
        elements={{
          code: CustomCode,
        }}
      />,
    );

    expect(screen.getByTestId("custom-code")).toHaveTextContent(
      "Hello, world!",
    );
  });

  test("if a custom link element is specified, it is used for link element nodes", () => {
    function CustomLink({ children, to }: PropsWithChildren<{ to: string }>) {
      return (
        <span data-testid="custom-link" data-href={to}>
          {children}
        </span>
      );
    }

    render(
      <RichText
        content={richTextRoot(
          customUrlLink("https://example.com", text("Click here!")),
        )}
        elements={{
          link: CustomLink,
        }}
      />,
    );

    const linkElement = screen.getByTestId("custom-link");
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveTextContent("Click here!");
    expect(linkElement).toHaveAttribute("data-href", "https://example.com");
  });

  test("if a custom h4 element is specified, it is used for h4 element nodes", () => {
    function CustomH4({ children }: PropsWithChildren) {
      return <span data-testid="custom-h4">{children}</span>;
    }

    render(
      <RichText
        content={richTextRoot(heading("h4", text("Hello, world!")))}
        elements={{
          h4: CustomH4,
        }}
      />,
    );

    expect(screen.getByTestId("custom-h4")).toHaveTextContent("Hello, world!");
  });

  test("if a custom h5 element is specified, it is used for h5 element nodes", () => {
    function CustomH5({ children }: PropsWithChildren) {
      return <span data-testid="custom-h5">{children}</span>;
    }

    render(
      <RichText
        content={richTextRoot(heading("h5", text("Hello, world!")))}
        elements={{
          h5: CustomH5,
        }}
      />,
    );

    expect(screen.getByTestId("custom-h5")).toHaveTextContent("Hello, world!");
  });

  test("if a custom ul element is specified, it is used for ul element nodes", () => {
    function CustomUl({ children }: PropsWithChildren) {
      return <span data-testid="custom-ul">{children}</span>;
    }

    render(
      <RichText
        content={richTextRoot(
          list(
            "ul",
            listitem(text("First item")),
            listitem(text("Second item")),
            listitem(text("Third item")),
          ),
        )}
        elements={{
          ul: CustomUl,
        }}
      />,
    );

    expect(screen.getByTestId("custom-ul")).toHaveTextContent(
      "First itemSecond itemThird item",
    );
  });

  test("if a custom ol element is specified, it is used for ol element nodes", () => {
    function CustomOl({ children }: PropsWithChildren) {
      return <span data-testid="custom-ol">{children}</span>;
    }

    render(
      <RichText
        content={richTextRoot(
          list(
            "ol",
            listitem(text("First item")),
            listitem(text("Second item")),
            listitem(text("Third item")),
          ),
        )}
        elements={{
          ol: CustomOl,
        }}
      />,
    );

    expect(screen.getByTestId("custom-ol")).toHaveTextContent(
      "First itemSecond itemThird item",
    );
  });

  test("if a custom li element is specified, it is used for li element nodes", () => {
    function CustomLi({ children }: PropsWithChildren) {
      return <span data-testid="custom-li">{children}</span>;
    }

    render(
      <RichText
        content={richTextRoot(list("ul", listitem(text("First item"))))}
        elements={{
          li: CustomLi,
        }}
      />,
    );

    expect(screen.getByTestId("custom-li")).toHaveTextContent("First item");
  });

  test("if a custom paragraph element is specified, it is used for paragraph element nodes", () => {
    function CustomParagraph({ children }: PropsWithChildren) {
      return <span data-testid="custom-paragraph">{children}</span>;
    }

    render(
      <RichText
        content={richTextRoot(paragraph(text("Hello, world!")))}
        elements={{
          paragraph: CustomParagraph,
        }}
      />,
    );

    expect(screen.getByTestId("custom-paragraph")).toHaveTextContent(
      "Hello, world!",
    );
  });

  test("custom paragraph elements receive the paragraph's indent", () => {
    function CustomParagraph({
      children,
      indent,
    }: PropsWithChildren<{ indent?: number }>) {
      return (
        <span data-testid="custom-paragraph" data-indent={indent}>
          {children}
        </span>
      );
    }

    render(
      <RichText
        content={richTextRoot(paragraph(3, text("Hello, world!")))}
        elements={{
          paragraph: CustomParagraph,
        }}
      />,
    );

    expect(screen.getByTestId("custom-paragraph")).toHaveAttribute(
      "data-indent",
      "3",
    );
  });

  test("if a custom line-break element is specified, it is used for line break nodes", () => {
    function CustomLineBreak() {
      return <span data-testid="custom-linebreak" />;
    }

    render(
      <RichText
        content={richTextRoot(
          paragraph(text("Hello"), lineBreak(), text("world")),
        )}
        elements={{
          linebreak: CustomLineBreak,
        }}
      />,
    );

    expect(screen.getByTestId("custom-linebreak")).toBeInTheDocument();
  });
});

describe("lineBreakHandling", () => {
  test("if lineBreakHandling is 'paragraph', each plain element node is rendered as paragraph", () => {
    render(
      <RichText
        content={richTextRoot(
          paragraph(text("Hello, world!")),
          paragraph(text("This is the next line")),
          paragraph(text("")),
          paragraph(text("This is the last line")),
        )}
        lineBreakHandling="paragraph"
      />,
    );

    const paragraphs = screen.getAllByRole("paragraph");

    expect(paragraphs).toHaveLength(4);
    expect(paragraphs[0]).toHaveTextContent("Hello, world!");
    expect(paragraphs[1]).toHaveTextContent("This is the next line");
    expect(paragraphs[2]).toHaveTextContent("");
    expect(paragraphs[3]).toHaveTextContent("This is the last line");
  });

  test("if lineBreakHandling is 'line-break', plain element nodes at root level are separated by <br />", () => {
    const { container } = render(
      <RichText
        content={richTextRoot(
          paragraph(text("Hello, world!")),
          paragraph(text("This is the next line")),
          paragraph(text("")),
          paragraph(text("This is the last line")),
        )}
        lineBreakHandling="line-break"
      />,
    );

    expect(container).toMatchInlineSnapshot(`
      <div>
        Hello, world!
        <br />
        This is the next line
        <br />
        <br />
        This is the last line
      </div>
    `);
  });

  test("if lineBreakHandling is 'line-break', 'paragraph' element nodes at root level are separated by <br />", () => {
    const { container } = render(
      <RichText
        content={richTextRoot(
          paragraph(text("Hello, world!")),
          paragraph(text("This is the next line")),
          paragraph(text("")),
          paragraph(text("This is the last line")),
        )}
        lineBreakHandling="line-break"
      />,
    );

    expect(container).toMatchInlineSnapshot(`
      <div>
        Hello, world!
        <br />
        This is the next line
        <br />
        <br />
        This is the last line
      </div>
    `);
  });

  test("if lineBreakHandling is 'line-break', plain element nodes at deeper levels are separated by <br />", () => {
    const { container } = render(
      <RichText
        content={richTextRoot(
          paragraph(text("Hello, world!")),
          paragraph(text("This is the next line")),
          paragraph(text("")),
          list(
            "ul",
            listitem(
              paragraph(text("First line")),
              paragraph(text("")),
              paragraph(text("Third line")),
            ),
          ),
        )}
        lineBreakHandling="line-break"
      />,
    );

    expect(container).toMatchInlineSnapshot(`
      <div>
        Hello, world!
        <br />
        This is the next line
        <br />
        <br />
        <ul>
          <li>
            First line
            <br />
            <br />
            Third line
          </li>
        </ul>
      </div>
    `);
  });
});

test("newline characters are replaced with <br /> elements", () => {
  const { container } = render(
    <RichText
      content={richTextRoot(
        paragraph(text("Hello, world!\nThis is the next line")),
      )}
    />,
  );

  expect(container).toMatchInlineSnapshot(`
    <div>
      <p>
        Hello, world!
        <br />
        This is the next line
      </p>
    </div>
  `);
});

test("Nodes of type 'text' without text render without an error", () => {
  render(
    <RichText
      content={richTextRoot(
        paragraph(text("Hello, "), text(undefined), text("world!")),
      )}
    />,
  );

  expect(screen.getByRole("paragraph")).toHaveTextContent("Hello, world!");
});

test("If an element with unsupported node type is used, it should throw a clear error message", () => {
  expect(() =>
    render(
      <RichText content={richTextRoot(unsupportedElementWithoutChildren())} />,
    ),
  ).toThrowError(/unsupported node type 'NOT_SUPPORTED'/i);
});
