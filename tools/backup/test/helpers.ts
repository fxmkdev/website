import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
export async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "backup-unit-")));
  const bin = join(root, "bin");
  const config = join(root, "config");
  await mkdir(bin);
  await mkdir(config);
  await writeFile(
    join(config, ".env.test"),
    "DATABASE_URI=mongodb://operator:secret-password@localhost:27017/source\nS3_BUCKET=test-media\nAWS_PROFILE=disposable\nAWS_REGION=us-east-1\n",
  );
  const stub = `#!${process.execPath}\n${await readFile(new URL("./fake-tool.mjs", import.meta.url), "utf8")}`;
  for (const tool of ["mongodump", "mongorestore", "mongosh", "aws"]) {
    const path = join(bin, tool);
    await writeFile(path, stub);
    await chmod(path, 0o700);
  }
  const log = join(root, "commands.jsonl");
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    TEST_LOG: log,
    TMPDIR: root,
  };
  function start(args: string[], extra: NodeJS.ProcessEnv = {}) {
    const child = spawn(
      process.execPath,
      [cliPath, ...args, "--env", "test", "--config-dir", config],
      { env: { ...env, ...extra }, stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.stdin.end();
    const done = new Promise<{ code: number | null; output: string }>(
      (resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code) => resolve({ code, output }));
      },
    );
    return { child, done };
  }
  return {
    root,
    config,
    bin,
    log,
    env,
    start,
    run: (args: string[], extra?: NodeJS.ProcessEnv) => start(args, extra).done,
    commands: async (): Promise<
      { tool: string; args: string[]; input: string }[]
    > =>
      (await readFile(log, "utf8").catch(() => ""))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    resetLog: () => writeFile(log, ""),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
