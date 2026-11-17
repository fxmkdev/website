import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { resolveTxt } from "node:dns/promises";
import type { ConnectionString as MongoConnectionString } from "mongodb-connection-string-url" with {
  "resolution-mode": "require",
};

// Version 3 exposes its declarations through the CommonJS export only.
const ConnectionString: typeof MongoConnectionString = createRequire(
  import.meta.url,
)("mongodb-connection-string-url").ConnectionString;

export const exclusions = ["users", "api-keys", "payload-preferences"];
export const validEnvironment = (name: string) =>
  /^[a-z][a-z0-9-]{0,62}$/.test(name);
export const validDatabase = (name: string) =>
  /^[A-Za-z0-9_-]{1,63}$/.test(name) &&
  !["admin", "config", "local"].includes(name.toLowerCase());

export interface Environment {
  name: string;
  uri: string;
  database: string;
  hosts: string;
  bucket: string;
  profile: string;
  region: string;
  endpoint?: string;
}

function parseDatabase(uri: string) {
  let connection: MongoConnectionString;
  let database: string;
  try {
    connection = new ConnectionString(uri);
    database = decodeURIComponent(connection.pathname.slice(1));
    if (!connection.hosts.length || !validDatabase(database)) throw new Error();
  } catch {
    throw new Error(
      "DATABASE_URI must be a MongoDB URI with an explicit application database (letters, digits, underscores or hyphens). System databases are forbidden.",
    );
  }
  return { database, hosts: connection.hosts.join(",") };
}

function parseStorage(values: Record<string, string>) {
  const bucket = values.S3_BUCKET;
  if (
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
    bucket.includes("..") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(bucket)
  ) {
    throw new Error(
      "S3_BUCKET must be a bucket name, without s3://, a path or wildcards.",
    );
  }
  if (!/^[A-Za-z0-9_-]+$/.test(values.AWS_PROFILE))
    throw new Error("Invalid AWS_PROFILE.");
  if (!/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(values.AWS_REGION))
    throw new Error("Invalid AWS_REGION.");
  let endpoint: string | undefined;
  if (values.S3_ENDPOINT_URL) {
    try {
      const url = new URL(values.S3_ENDPOINT_URL);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/"
      )
        throw new Error();
      endpoint = url.origin;
    } catch {
      throw new Error(
        "S3_ENDPOINT_URL must be an HTTP(S) origin without credentials, query or path.",
      );
    }
  }
  return {
    bucket,
    profile: values.AWS_PROFILE,
    region: values.AWS_REGION,
    endpoint,
  };
}

export async function loadEnvironment(
  name: string,
  directory: string,
): Promise<Environment> {
  if (!validEnvironment(name))
    throw new Error(
      "Invalid environment name; use lowercase letters, digits and hyphens.",
    );
  let values: Record<string, string>;
  try {
    values = parseEnv(
      await readFile(resolve(directory, `.env.${name}`), "utf8"),
    ) as Record<string, string>;
  } catch {
    throw new Error(
      `Cannot read environment file .env.${name} in the selected config directory.`,
    );
  }
  for (const key of [
    "DATABASE_URI",
    "S3_BUCKET",
    "AWS_PROFILE",
    "AWS_REGION",
  ]) {
    if (!values[key]?.trim())
      throw new Error(`Missing ${key} in .env.${name}.`);
  }

  return {
    name,
    uri: values.DATABASE_URI,
    ...parseDatabase(values.DATABASE_URI),
    ...parseStorage(values),
  };
}

export function describe(env: Environment): string {
  return `Environment: ${env.name}\nMongoDB: ${env.hosts}/${env.database}\nS3: s3://${env.bucket}\nAWS profile: ${env.profile}; region: ${env.region}; endpoint: ${env.endpoint ?? "AWS"}`;
}

export async function restoreConnectionUri(
  uri: string,
  lookup = resolveTxt,
): Promise<string> {
  const connection = new ConnectionString(uri);
  const parameters = connection.typedSearchParams<Record<string, string>>();
  // A database in mongorestore's URI acts like --db and changes how it scans
  // directories, bypassing source namespace mapping. Remove it, preserving
  // authentication defaults (including authSource supplied by SRV DNS).
  if (!parameters.has("authSource")) {
    let source: string | undefined;
    if (connection.isSRV) {
      try {
        const records = await lookup(connection.hosts[0]);
        if (records.length > 1)
          throw new Error("Multiple MongoDB TXT records.");
        for (const [key, value] of new URLSearchParams(
          records[0]?.join("") ?? "",
        )) {
          if (key.toLowerCase() === "authsource") source = value;
        }
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            "code" in error &&
            ["ENODATA", "ENOTFOUND"].includes(String(error.code))
          )
        ) {
          throw new Error(
            "Cannot resolve MongoDB authentication settings for restore.",
            { cause: error },
          );
        }
      }
    }
    const mechanism = parameters.get("authMechanism")?.toUpperCase();
    if (
      [
        "GSSAPI",
        "PLAIN",
        "MONGODB-X509",
        "MONGODB-AWS",
        "MONGODB-OIDC",
      ].includes(mechanism ?? "")
    )
      source ??= "$external";
    if (source === undefined && connection.username)
      source = decodeURIComponent(connection.pathname.slice(1));
    if (source !== undefined) parameters.set("authSource", source);
  }
  connection.pathname = "/";
  return connection.toString();
}
