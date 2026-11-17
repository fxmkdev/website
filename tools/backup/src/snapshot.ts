import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validDatabase, validEnvironment } from "./config.ts";

export interface Entry {
  path: string;
  size: number;
  sha256: string;
}
export interface Manifest {
  version: 1;
  environment: string;
  database: string;
  createdAt: string;
  files: Entry[];
}

export function safeRelative(path: string): boolean {
  return (
    path.length > 0 &&
    !path.includes("\\") &&
    !Array.from(path).some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    ) &&
    path
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

export async function assertRealPath(path: string) {
  let current = resolve(path);
  for (;;) {
    if ((await lstat(current)).isSymbolicLink())
      throw new Error("Symlinks are forbidden in snapshot paths.");
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;
  }
}

export async function inventory(root: string): Promise<Entry[]> {
  const files: Entry[] = [];
  async function visit(relative: string) {
    const absolute = join(root, relative);
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink())
      throw new Error("Symlinks are forbidden in snapshots.");
    if (stat.isDirectory()) {
      for (const name of (await readdir(absolute)).sort())
        await visit(relative ? `${relative}/${name}` : name);
    } else if (stat.isFile() && safeRelative(relative)) {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(absolute)) hash.update(chunk);
      files.push({
        path: relative,
        size: stat.size,
        sha256: hash.digest("hex"),
      });
    } else
      throw new Error("Snapshot contains an unsafe path or unsupported file.");
  }
  await visit("");
  return files;
}

export async function validateSnapshot(root: string): Promise<Manifest> {
  await assertRealPath(root);
  const manifestPath = join(root, "manifest.json");
  const stat = await lstat(manifestPath);
  if (!stat.isFile() || stat.size > 16 * 1024 * 1024)
    throw new Error("Invalid snapshot manifest.");
  let value: unknown;
  try {
    value = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    throw new Error("Cannot parse snapshot manifest.");
  }
  if (!value || typeof value !== "object")
    throw new Error("Invalid snapshot manifest.");
  const m = value as Manifest;
  if (
    m.version !== 1 ||
    typeof m.environment !== "string" ||
    !validEnvironment(m.environment) ||
    typeof m.database !== "string" ||
    !validDatabase(m.database) ||
    typeof m.createdAt !== "string" ||
    !Number.isFinite(Date.parse(m.createdAt)) ||
    !Array.isArray(m.files)
  ) {
    throw new Error("Unsupported or incomplete snapshot manifest.");
  }
  const paths = new Set<string>();
  for (const file of m.files) {
    if (
      !file ||
      typeof file.path !== "string" ||
      !safeRelative(file.path) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      typeof file.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      paths.has(file.path)
    )
      throw new Error("Invalid snapshot file inventory.");
    paths.add(file.path);
    const parts = file.path.split("/");
    if (parts[0] === "database") {
      if (parts.length === 2 && parts[1] === "prelude.json") continue;
      if (
        parts.length !== 3 ||
        parts[1] !== m.database ||
        !/\.(bson|metadata\.json)$/.test(parts[2])
      )
        throw new Error(
          "Snapshot contains an unexpected database namespace or dump file.",
        );
    } else if (parts[0] !== "media" || parts.length < 2)
      throw new Error("Snapshot contains an unexpected file.");
  }
  if (
    !m.files.some(
      (f) =>
        f.path.startsWith(`database/${m.database}/`) &&
        f.path.endsWith(".bson"),
    )
  )
    throw new Error(
      "Snapshot has no database collections; refusing destructive recovery.",
    );
  for (const dir of ["database", `database/${m.database}`, "media"]) {
    if (!(await lstat(join(root, dir))).isDirectory())
      throw new Error("Snapshot directory is missing.");
  }
  const actual = (await inventory(root)).filter(
    (f) => f.path !== "manifest.json",
  );
  const expected = [...m.files].sort((a, b) =>
    a.path.localeCompare(b.path, "en"),
  );
  actual.sort((a, b) => a.path.localeCompare(b.path, "en"));
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error("Snapshot inventory/checksum mismatch; recovery refused.");
  // Empty directories can hide incomplete staging data too.
  async function checkDirectories(relative: string) {
    for (const name of await readdir(join(root, relative))) {
      const path = relative ? `${relative}/${name}` : name;
      if ((await lstat(join(root, path))).isDirectory()) {
        if (
          !["database", `database/${m.database}`, "media"].includes(path) &&
          !(
            path.startsWith("media/") &&
            m.files.some((f) => f.path.startsWith(`${path}/`))
          )
        )
          throw new Error("Snapshot contains an unexpected directory.");
        await checkDirectories(path);
      }
    }
  }
  await checkDirectories("");
  return m;
}
