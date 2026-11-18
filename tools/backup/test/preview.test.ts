import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fixture } from "./helpers.ts";

test("preview includes restorable system.js data while preserving the identity exclusions", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const root = join(f.root, "snapshot");
  const saved = await f.run(["backup", "--output", root], {
    TEST_SYSTEM_JS: "1",
  });
  assert.equal(saved.code, 0, saved.output);
  const result = await f.run(["restore", "--input", root, "--dry-run"]);
  assert.equal(result.code, 0, result.output);
  assert.match(
    result.output,
    /RESTORE snapshot collections \(2\):\n {2}"posts"\n {2}"system.js"/,
  );
});

test("restore accepts JSON property/inventory reordering before and during confirmation", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const root = join(f.root, "snapshot");
  assert.equal((await f.run(["backup", "--output", root])).code, 0);
  const path = join(root, "manifest.json");
  const m = JSON.parse(await readFile(path, "utf8"));
  m.files = m.files
    .reverse()
    .map(
      ({
        path,
        size,
        sha256,
      }: {
        path: string;
        size: number;
        sha256: string;
      }) => ({ sha256, size, path }),
    );
  await writeFile(
    path,
    JSON.stringify({
      files: m.files,
      createdAt: m.createdAt,
      database: m.database,
      environment: m.environment,
      version: m.version,
    }),
  );
  const result = await f.run(
    ["restore", "--input", root, "--confirm", "test"],
    { TEST_REORDER_MANIFEST: path },
  );
  assert.equal(result.code, 0, result.output);
});

test("dry run lists exact collections and all media changes, escaping remote object names", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const root = join(f.root, "snapshot");
  assert.equal((await f.run(["backup", "--output", root])).code, 0);
  await f.resetLog();
  const result = await f.run(["restore", "--input", root, "--dry-run"], {
    TEST_DESTINATION_KEYS: JSON.stringify(["photo.txt", "old\nobject.txt"]),
  });
  assert.equal(result.code, 0, result.output);
  assert.match(
    result.output,
    /DROP destination collections \(2\):\n {2}"obsolete"\n {2}"posts"/,
  );
  assert.match(
    result.output,
    /RESTORE snapshot collections \(1\):\n {2}"posts"/,
  );
  assert.match(
    result.output,
    /UPLOAD snapshot objects .*\(1\):\n {2}"photo.txt"/,
  );
  assert.match(
    result.output,
    /DELETE destination-only objects \(1\):\n {2}"old\\nobject.txt"/,
  );
  assert.doesNotMatch(result.output, /secret-password/);
  assert.ok(
    !(await f.commands()).some(
      (c) =>
        c.input.includes(".drop()") ||
        c.args.includes("cp") ||
        c.args.includes("--delete"),
    ),
  );
});

test("malformed destination inventories refuse restore before destructive operations", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const root = join(f.root, "snapshot");
  assert.equal((await f.run(["backup", "--output", root])).code, 0);
  await f.resetLog();
  const result = await f.run(
    ["restore", "--input", root, "--confirm", "test"],
    { TEST_DESTINATION_KEYS: '[{"unexpected":"shape"}]' },
  );
  assert.notEqual(result.code, 0);
  assert.match(result.output, /Invalid S3 object inventory/);
  assert.ok(
    !(await f.commands()).some(
      (c) => c.input.includes(".drop()") || c.args.includes("cp"),
    ),
  );
});
