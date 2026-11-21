import { spawn } from "node:child_process";
import type { Environment } from "./config.ts";

export class Interrupted extends Error {}

// Never print child arguments or raw output: drivers may echo credentialed URIs.
export async function run(
  command: string,
  args: string[],
  signal: AbortSignal,
  input?: string,
  extraEnv: NodeJS.ProcessEnv = {},
): Promise<string> {
  if (signal.aborted) throw new Interrupted("Interrupted.");
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
    });
    let killTimer: NodeJS.Timeout | undefined;
    const abort = () => {
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
      killTimer.unref();
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    const chunks: Buffer[] = [];
    let bytes = 0;
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes <= 1024 * 1024) chunks.push(chunk);
    });
    child.stderr.resume();
    child.on("error", () =>
      reject(
        signal.aborted
          ? new Interrupted("Interrupted.")
          : new Error(
              `Could not launch ${command}; check installation and permissions.`,
            ),
      ),
    );
    child.on("close", (code, childSignal) => {
      signal.removeEventListener("abort", abort);
      clearTimeout(killTimer);
      if (signal.aborted || childSignal)
        reject(new Interrupted(`${command} interrupted.`));
      else if (code !== 0)
        reject(
          new Error(
            `${command} failed (exit ${code}). Check connectivity, permissions, tool compatibility and input data.`,
          ),
        );
      else if (bytes > 1024 * 1024)
        reject(new Error(`${command} returned excessive output.`));
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

export function aws(env: Environment, args: string[], signal: AbortSignal) {
  // Explicit --profile disables environment credentials. Also disable ambient
  // endpoint overrides so a different shell configuration cannot redirect S3.
  return run(
    "aws",
    [
      "--profile",
      env.profile,
      "--region",
      env.region,
      "--no-cli-pager",
      ...(env.endpoint ? ["--endpoint-url", env.endpoint] : []),
      ...args,
    ],
    signal,
    undefined,
    {
      AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: "true",
      AWS_CLI_AUTO_PROMPT: "off",
    },
  );
}

export function mongo(env: Environment, script: string, signal: AbortSignal) {
  // Supply the URI through the child environment rather than its command line.
  return run(
    "mongosh",
    ["--nodb", "--quiet", "--file", "/dev/stdin"],
    signal,
    `const db = connect(process.env.WEBSITE_BACKUP_DATABASE_URI);\n${script}\n`,
    { WEBSITE_BACKUP_DATABASE_URI: env.uri },
  );
}

export async function preflight(
  env: Environment,
  signal: AbortSignal,
  restore: boolean,
) {
  let phase = "checking tool availability";
  try {
    for (const command of [
      restore ? "mongorestore" : "mongodump",
      "mongosh",
      "aws",
    ]) {
      await run(command, ["--version"], signal);
    }
    phase = "checking MongoDB access";
    await mongo(
      env,
      'if (db.runCommand({ping: 1}).ok !== 1) throw new Error("Ping failed"); db.getCollectionInfos();',
      signal,
    );
    phase = "checking S3 access";
    await aws(env, ["s3api", "head-bucket", "--bucket", env.bucket], signal);
    await aws(
      env,
      ["s3api", "list-objects-v2", "--bucket", env.bucket, "--max-keys", "1"],
      signal,
    );
  } catch (error) {
    throw new Error(
      `Preflight failed while ${phase}; no data changed. ${error instanceof Error ? error.message : "Operation failed."}`,
      { cause: error },
    );
  }
}
