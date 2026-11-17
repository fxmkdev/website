import { lstat, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline/promises";
import { describe, exclusions, restoreConnectionUri } from "./config.ts";
import type { Environment } from "./config.ts";
import { aws, mongo, preflight, run } from "./process.ts";
import {
  assertRealPath,
  inventory,
  safeRelative,
  validateSnapshot,
} from "./snapshot.ts";
import type { Manifest } from "./snapshot.ts";

async function withMongoConfig<T>(
  uri: string,
  action: (path: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "website-mongo-"));
  const path = join(directory, "connection.yml");
  try {
    // JSON is also YAML. Database Tools reads this protected file without putting
    // the credentialed URI in process arguments or diagnostic output.
    await writeFile(path, JSON.stringify({ uri }), { mode: 0o600 });
    return await action(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

interface ObjectEntry {
  Key: string;
  Size: number;
}
async function sourceObjects(
  env: Environment,
  signal: AbortSignal,
): Promise<ObjectEntry[]> {
  const objects: ObjectEntry[] =
    JSON.parse(
      await aws(
        env,
        [
          "s3api",
          "list-objects-v2",
          "--bucket",
          env.bucket,
          "--query",
          "Contents[].{Key:Key,Size:Size}",
          "--output",
          "json",
        ],
        signal,
      ),
    ) ?? [];
  if (!Array.isArray(objects)) throw new Error("Invalid S3 object inventory.");
  const folded = new Set<string>();
  for (const obj of objects) {
    if (
      typeof obj.Key !== "string" ||
      !safeRelative(obj.Key) ||
      !Number.isSafeInteger(obj.Size) ||
      obj.Size < 0 ||
      folded.has(obj.Key.toLowerCase())
    )
      throw new Error(
        "S3 contains keys that cannot be safely represented as local files.",
      );
    folded.add(obj.Key.toLowerCase());
  }
  for (const obj of objects) {
    const parts = obj.Key.toLowerCase().split("/");
    for (let i = 1; i < parts.length; i++)
      if (folded.has(parts.slice(0, i).join("/")))
        throw new Error("S3 contains conflicting file/directory keys.");
  }
  return objects;
}

export async function backup(
  env: Environment,
  output: string,
  signal: AbortSignal,
) {
  const root = resolve(output);
  await assertRealPath(dirname(root));
  try {
    await lstat(root);
    throw new Error("Output already exists; choose a new snapshot directory.");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  console.log(describe(env));
  await preflight(env, signal, false);
  const objects = await sourceObjects(env, signal);
  // Exclusive reservation: another invocation cannot overwrite this path.
  await mkdir(root, { mode: 0o700 });
  const staging = await mkdtemp(join(root, ".incomplete-"));
  try {
    const media = join(staging, "media");
    await mkdir(media, { mode: 0o700 });
    console.log("Backing up MongoDB…");
    await withMongoConfig(env.uri, (config) =>
      run(
        "mongodump",
        [`--config=${config}`, `--out=${join(staging, "database")}`],
        signal,
      ),
    );
    // Newer mongodump places prelude.json inside a single-database dump.
    // Normalize it to the dump root so namespace-based mongorestore finds it.
    try {
      await rename(
        join(staging, "database", env.database, "prelude.json"),
        join(staging, "database", "prelude.json"),
      );
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
    console.log("Backing up S3…");
    await aws(
      env,
      [
        "s3",
        "sync",
        `s3://${env.bucket}`,
        media,
        "--no-follow-symlinks",
        "--only-show-errors",
      ],
      signal,
    );
    const files = await inventory(staging);
    const mediaFiles = files.filter((f) => f.path.startsWith("media/"));
    if (
      mediaFiles.length !== objects.length ||
      objects.some(
        (o) =>
          !mediaFiles.some(
            (f) => f.path === `media/${o.Key}` && f.size === o.Size,
          ),
      )
    )
      throw new Error(
        "S3 backup does not match the source inventory; pause writes and retry.",
      );
    const manifest: Manifest = {
      version: 1,
      environment: env.name,
      database: env.database,
      createdAt: new Date().toISOString(),
      files,
    };
    await writeFile(
      join(staging, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      { mode: 0o600 },
    );
    await validateSnapshot(staging);
    if (signal.aborted)
      throw new Error("Interrupted before snapshot completion.");
    await rename(join(staging, "database"), join(root, "database"));
    await rename(media, join(root, "media"));
    // The completion manifest is published last. Failed backups are unusable.
    if (signal.aborted)
      throw new Error("Interrupted before snapshot completion.");
    await rename(join(staging, "manifest.json"), join(root, "manifest.json"));
    console.log(`Backup complete: ${root}`);
  } catch (error) {
    throw new Error(
      `Backup incomplete at ${root}; use a new output path to retry. ${error instanceof Error ? error.message : "Operation failed."}`,
      { cause: error },
    );
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export function restoreArgs(
  manifest: Manifest,
  env: Environment,
  root: string,
  config: string,
): string[] {
  return [
    `--config=${config}`,
    "--stopOnError",
    "--drop",
    `--nsInclude=${manifest.database}.*`,
    ...exclusions.map((c) => `--nsExclude=${manifest.database}.${c}`),
    `--nsFrom=${manifest.database}.*`,
    `--nsTo=${env.database}.*`,
    `--dir=${join(root, "database")}`,
  ];
}

export async function confirmRestore(
  environment: string,
  confirmation: string | undefined,
  signal: AbortSignal,
) {
  if (confirmation !== undefined) {
    if (confirmation !== environment)
      throw new Error("--confirm must exactly match the target environment.");
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error(
      `Noninteractive restore requires --confirm ${environment}.`,
    );
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await prompt.question(
      `Type ${environment} to replace its data: `,
      { signal },
    );
    if (answer !== environment)
      throw new Error("Confirmation did not match; restore cancelled.");
  } finally {
    prompt.close();
  }
}

export async function restore(
  env: Environment,
  input: string,
  signal: AbortSignal,
  options: { dryRun?: boolean; confirm?: string },
) {
  const root = resolve(input);
  const manifest = await validateSnapshot(root);
  console.log(
    `Snapshot: ${manifest.environment}/${manifest.database}, ${manifest.createdAt}\n${describe(env)}\nReplace all application collections except ${exclusions.join(", ")}.\nUpload all snapshot media and DELETE destination-only S3 objects.\nPause application writes; this operation has no automatic rollback.`,
  );
  await preflight(env, signal, true);
  await withMongoConfig(await restoreConnectionUri(env.uri), async (config) => {
    const args = restoreArgs(manifest, env, root, config);
    await run("mongorestore", [...args, "--dryRun"], signal);
    await aws(
      env,
      [
        "s3",
        "sync",
        join(root, "media"),
        `s3://${env.bucket}`,
        "--delete",
        "--no-follow-symlinks",
        "--dryrun",
      ],
      signal,
    );
    if (options.dryRun) {
      console.log(
        "Dry run complete: database namespaces validated; all snapshot media will be uploaded, and destination-only objects deleted. No data changed.",
      );
      return;
    }
    await confirmRestore(env.name, options.confirm, signal);
    // Recheck after the prompt so accidental edits while reviewing cannot turn
    // a validated snapshot into an incomplete destructive restore.
    const rechecked = await validateSnapshot(root);
    if (JSON.stringify(rechecked) !== JSON.stringify(manifest))
      throw new Error(
        "Snapshot changed during confirmation; recovery refused.",
      );
    let phase = "dropping destination collections";
    try {
      console.log("Replacing MongoDB collections…");
      await mongo(
        env,
        `const excluded = ${JSON.stringify(exclusions)};\nfor (const c of db.getCollectionInfos()) { if (!excluded.includes(c.name) && !c.name.startsWith("system.")) { if (!db.getCollection(c.name).drop()) throw new Error("Collection drop failed"); } }`,
        signal,
      );
      phase = "restoring MongoDB";
      await run("mongorestore", args, signal);
      phase = "uploading S3 objects";
      console.log("Replacing S3 media…");
      await aws(
        env,
        [
          "s3",
          "cp",
          join(root, "media"),
          `s3://${env.bucket}`,
          "--recursive",
          "--no-follow-symlinks",
          "--only-show-errors",
        ],
        signal,
      );
      phase = "deleting destination-only S3 objects";
      await aws(
        env,
        [
          "s3",
          "sync",
          join(root, "media"),
          `s3://${env.bucket}`,
          "--delete",
          "--no-follow-symlinks",
          "--only-show-errors",
        ],
        signal,
      );
    } catch (error) {
      throw new Error(
        `Restore failed while ${phase}. Destination may be partially changed; keep writes paused and recover from a verified snapshot. ${error instanceof Error ? error.message : "Operation failed."}`,
        { cause: error },
      );
    }
    console.log("Restore complete.");
  });
}
