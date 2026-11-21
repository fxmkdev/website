import { describe, exclusions } from "./config.ts";
import type { Environment } from "./config.ts";
import { aws, mongo } from "./process.ts";
import type { Manifest } from "./snapshot.ts";

export interface RestorePlan {
  dropCollections: string[];
  restoreCollections: string[];
  uploadObjects: string[];
  deleteObjects: string[];
}

function stringList(
  json: string,
  resource: string,
  allowNull = false,
): string[] {
  const values: unknown = JSON.parse(json);
  if (values === null && allowNull) return [];
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== "string")
  ) {
    throw new Error(`Invalid ${resource} inventory; recovery refused.`);
  }
  return values;
}

function shouldDropCollection(name: string): boolean {
  return !exclusions.includes(name) && !name.startsWith("system.");
}

export async function createRestorePlan(
  env: Environment,
  manifest: Manifest,
  signal: AbortSignal,
): Promise<RestorePlan> {
  const collections = stringList(
    await mongo(env, "print(JSON.stringify(db.getCollectionNames()));", signal),
    "MongoDB collection",
  );
  const objects = stringList(
    await aws(
      env,
      [
        "s3api",
        "list-objects-v2",
        "--bucket",
        env.bucket,
        "--query",
        "Contents[].Key",
        "--output",
        "json",
      ],
      signal,
    ),
    "S3 object",
    true,
  );
  const prefix = `database/${manifest.database}/`;
  const restoreCollections = new Set(
    manifest.files
      .filter((file) => file.path.startsWith(prefix))
      .map((file) =>
        decodeURIComponent(
          file.path
            .slice(prefix.length)
            .replace(/\.(bson|metadata\.json)$/, ""),
        ),
      )
      .filter((name) => !exclusions.includes(name)),
  );
  const uploadObjects = manifest.files
    .filter((file) => file.path.startsWith("media/"))
    .map((file) => file.path.slice("media/".length));
  const uploaded = new Set(uploadObjects);
  return {
    dropCollections: collections.filter(shouldDropCollection).sort(),
    restoreCollections: [...restoreCollections].sort(),
    uploadObjects: uploadObjects.sort(),
    deleteObjects: objects.filter((key) => !uploaded.has(key)).sort(),
  };
}

export function printRestoreTarget(env: Environment, manifest: Manifest) {
  console.log(
    `Snapshot: ${manifest.environment}/${manifest.database}, ${manifest.createdAt}\n${describe(env)}\nPreserve collections: ${exclusions.join(", ")}.\nPause application writes; this operation has no automatic rollback.`,
  );
}

export function printRestorePlan(plan: RestorePlan) {
  const lists: [string, string[]][] = [
    ["DROP destination collections", plan.dropCollections],
    ["RESTORE snapshot collections", plan.restoreCollections],
    [
      "UPLOAD snapshot objects (including same-size replacements)",
      plan.uploadObjects,
    ],
    ["DELETE destination-only objects", plan.deleteObjects],
  ];
  for (const [label, names] of lists) {
    console.log(`${label} (${names.length}):`);
    // Quote data names to escape control characters. Never print raw tool
    // output, which can include connection credentials and diagnostics.
    for (const name of names) console.log(`  ${JSON.stringify(name)}`);
  }
}
