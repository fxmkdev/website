import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { fixture } from "./helpers.ts";

const execute = promisify(execFile);
const workspace = fileURLToPath(new URL("../../../", import.meta.url));

test(
  "pnpm data resolves backup and restore paths from the repository root",
  { timeout: 120_000 },
  async (t) => {
    const f = await fixture();
    t.after(f.cleanup);
    const backups = join(workspace, ".backups");
    await mkdir(backups, { recursive: true });
    const directory = await mkdtemp(join(backups, "entrypoint-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const snapshot = join(directory, "snapshot");
    const relativeSnapshot = relative(workspace, snapshot);
    const data = (args: string[]) =>
      execute(
        "pnpm",
        ["data", ...args, "--env", "test", "--config-dir", f.config],
        { cwd: workspace, env: f.env, signal: t.signal },
      );

    // The absolute-path control proves the selected configuration and fake tools
    // work independently of the root command's relative-path handling.
    await data(["backup", "--output", join(directory, "absolute-control")]);
    const saved = await data(["backup", "--output", relativeSnapshot]);
    assert.ok(saved.stdout.includes(`Backup complete: ${snapshot}`));
    assert.equal(
      JSON.parse(await readFile(join(snapshot, "manifest.json"), "utf8"))
        .database,
      "source",
    );
    await execute("git", ["check-ignore", "--", relativeSnapshot], {
      cwd: workspace,
    });

    await f.resetLog();
    const preview = await data([
      "restore",
      "--input",
      relativeSnapshot,
      "--dry-run",
    ]);
    assert.match(preview.stdout, /Dry run complete: no data changed/);
    await assert.rejects(
      data(["restore", "--input", relativeSnapshot]),
      /Noninteractive restore requires --confirm test/,
    );
    assert.ok(
      !(await f.commands()).some(
        (command) =>
          command.input.includes(".drop()") || command.args.includes("cp"),
      ),
    );

    await f.resetLog();
    const restored = await data([
      "restore",
      "--input",
      relativeSnapshot,
      "--confirm",
      "test",
    ]);
    assert.match(restored.stdout, /Restore complete/);
    assert.ok(
      (await f.commands()).some((command) => command.input.includes(".drop()")),
    );
  },
);
