import type { ColumnsBlock } from "@fxmk/payload-types";
import { Container } from "~/components/container";
import { Archive } from "./archive";
import { Newsletter } from "./newsletter";
import { Work } from "./work";

export function Columns({ leftColumn, rightColumn }: ColumnsBlock) {
  return (
    <Container className="mt-24 md:mt-28">
      <div className="mx-auto grid max-w-xl grid-cols-1 gap-y-20 lg:max-w-none lg:grid-cols-2">
        <Column blocks={leftColumn} />
        <Column blocks={rightColumn} className="space-y-10 lg:pl-16 xl:pl-24" />
      </div>
    </Container>
  );
}

function Column({
  blocks,
  className,
}: {
  blocks: ColumnsBlock["leftColumn"];
  className?: string;
}) {
  return (
    <div className={className}>
      {blocks?.map((block) => {
        switch (block.blockType) {
          case "archive":
            return <Archive key={block.id} {...block} size="small" />;
          case "newsletter":
            return <Newsletter key={block.id} {...block} />;
          case "work":
            return <Work key={block.id} {...block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
