import {
  appendFileSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
const tool = basename(process.argv[1]);
const args = process.argv.slice(2);
let input = "";
for await (const chunk of process.stdin) input += chunk;
appendFileSync(
  process.env.TEST_LOG,
  JSON.stringify({ tool, args, input }) + "\n",
);
if (args.includes("--version")) process.exit(0);
if (
  tool === "mongorestore" &&
  args.includes("--dryRun") &&
  process.env.TEST_REPLACE_MANIFEST
) {
  const path = process.env.TEST_REPLACE_MANIFEST;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.environment = "replaced";
  writeFileSync(path, JSON.stringify(manifest));
}
if (
  tool === "mongorestore" &&
  args.includes("--dryRun") &&
  process.env.TEST_REORDER_MANIFEST
) {
  const path = process.env.TEST_REORDER_MANIFEST;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.files = manifest.files
    .reverse()
    .map(({ path, size, sha256 }) => ({ sha256, size, path }));
  writeFileSync(path, JSON.stringify(manifest));
}
if (process.env.TEST_BLOCK === tool && !args.includes("--dryRun")) {
  setInterval(() => {}, 1000);
} else if (
  process.env.TEST_FAIL === tool &&
  (!process.env.TEST_FAIL_ARG || args.includes(process.env.TEST_FAIL_ARG)) &&
  (!args.includes("--dryRun") || process.env.TEST_FAIL_DRY === "1")
) {
  console.error(
    "credential leak: mongodb://operator:secret-password@localhost/source",
  );
  process.exit(7);
} else if (tool === "mongodump") {
  const out = args.find((a) => a.startsWith("--out=")).slice(6);
  const uri = JSON.parse(
    readFileSync(args.find((a) => a.startsWith("--config=")).slice(9), "utf8"),
  ).uri;
  const db = new URL(uri).pathname.slice(1);
  mkdirSync(join(out, db), { recursive: true });
  if (process.env.TEST_PRELUDE)
    writeFileSync(join(out, db, "prelude.json"), "{}");
  writeFileSync(join(out, db, "posts.bson"), "test-bson");
  writeFileSync(join(out, db, "posts.metadata.json"), "{}");
  if (process.env.TEST_SYSTEM_JS)
    writeFileSync(join(out, db, "system.js.bson"), "test-bson");
} else if (
  tool === "mongosh" &&
  input.includes("print(JSON.stringify(db.getCollectionNames()))")
)
  console.log(
    JSON.stringify([
      "posts",
      "obsolete",
      "users",
      "api-keys",
      "payload-preferences",
      "system.views",
    ]),
  );
else if (tool === "aws" && args.includes("Contents[].Key"))
  console.log(
    process.env.TEST_DESTINATION_KEYS ??
      JSON.stringify(["photo.txt", "old.txt"]),
  );
else if (tool === "aws" && args.includes("list-objects-v2"))
  console.log(
    process.env.TEST_OBJECTS ?? JSON.stringify([{ Key: "photo.txt", Size: 4 }]),
  );
else if (
  tool === "aws" &&
  args.includes("sync") &&
  args.some((a) => a.startsWith("s3://")) &&
  !args.includes("--dryrun")
) {
  const source = args[args.indexOf("sync") + 1];
  const destination = args[args.indexOf("sync") + 2];
  if (source.startsWith("s3://"))
    writeFileSync(join(destination, "photo.txt"), "copy");
}
