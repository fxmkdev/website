import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

// No host MongoDB/AWS installations or real credentials are used. The CLI
// invokes the actual tools inside disposable containers via PATH adapters.
test(
  "real backup and cross-environment recovery with disposable MongoDB and MinIO",
  { timeout: 900_000 },
  async (t) => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), "website-recovery-")),
    );
    const id = `website-recovery-${randomUUID().slice(0, 8)}`;
    const mongo = `${id}-mongo`,
      minio = `${id}-minio`,
      aws = `${id}-aws`;
    const mongoImage = "mongo:8.0";
    const minioImage = "website-backup-minio:2025-09-07";
    const awsImage = "amazon/aws-cli:2.27.6";
    const bin = join(root, "bin");
    await mkdir(bin);
    const credentials = join(root, "credentials");
    await writeFile(
      credentials,
      "[disposable]\naws_access_key_id=disposable-access\naws_secret_access_key=disposable-secret\n",
      { mode: 0o600 },
    );
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      TMPDIR: root,
      AWS_SHARED_CREDENTIALS_FILE: credentials,
      AWS_CONFIG_FILE: join(root, "aws-config"),
      AWS_EC2_METADATA_DISABLED: "true",
      BUILDX_CONFIG: join(root, "buildx"),
      AWS_ACCESS_KEY_ID: "",
      AWS_SECRET_ACCESS_KEY: "",
      AWS_SESSION_TOKEN: "",
    };
    async function exec(
      command: string,
      args: string[],
      input = "",
      allowFailure = false,
    ) {
      return new Promise<string>((resolve, reject) => {
        const child = spawn(command, args, {
          env,
          signal: allowFailure ? undefined : t.signal,
          stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (c) => {
          stdout += c;
        });
        child.stderr.on("data", (c) => {
          stderr += c;
        });
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0 || allowFailure
            ? resolve(stdout)
            : reject(
                new Error(`${command} failed (${code}): ${stdout}\n${stderr}`),
              ),
        );
        child.stdin.on("error", () => {});
        child.stdin.end(input);
      });
    }
    t.after(async () => {
      try {
        await exec("docker", ["rm", "-f", "-v", aws, minio, mongo], "", true);
        const remaining = await exec("docker", [
          "ps",
          "-aq",
          "--filter",
          `name=${id}-`,
        ]);
        assert.equal(
          remaining.trim(),
          "",
          "Disposable containers were not cleaned up.",
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
    for (const image of [mongoImage, awsImage])
      await exec("docker", ["pull", image]);
    await exec("docker", [
      "build",
      "-t",
      minioImage,
      "-f",
      fileURLToPath(new URL("Minio.Dockerfile", import.meta.url)),
      fileURLToPath(new URL(".", import.meta.url)),
    ]);
    const mount = ["--mount", `type=bind,source=${root},target=${root}`];
    await exec("docker", ["run", "-d", "--name", mongo, ...mount, mongoImage]);
    await exec("docker", [
      "run",
      "-d",
      "--name",
      minio,
      "-e",
      "MINIO_ROOT_USER=disposable-access",
      "-e",
      "MINIO_ROOT_PASSWORD=disposable-secret",
      minioImage,
      "server",
      "/data",
    ]);
    await exec("docker", [
      "run",
      "-d",
      "--name",
      aws,
      "--network",
      `container:${minio}`,
      ...mount,
      "--entrypoint",
      "/bin/sh",
      awsImage,
      "-c",
      "while true; do sleep 3600; done",
    ]);
    for (const tool of ["mongosh", "mongodump", "mongorestore", "aws"]) {
      const container = tool === "aws" ? aws : mongo;
      const adapter = `#!${process.execPath}
import { spawn } from 'node:child_process';
const vars=['WEBSITE_BACKUP_DATABASE_URI','AWS_SHARED_CREDENTIALS_FILE','AWS_CONFIG_FILE','AWS_EC2_METADATA_DISABLED','AWS_IGNORE_CONFIGURED_ENDPOINT_URLS','AWS_CLI_AUTO_PROMPT'];
const args=['exec','-i','--user',${JSON.stringify(`${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`)},'-e',${JSON.stringify(`HOME=${root}`)},...vars.flatMap(k=>process.env[k]===undefined?[]:['-e',k+'='+process.env[k]]),${JSON.stringify(container)},${JSON.stringify(tool)},...process.argv.slice(2)];
const child=spawn('docker',args,{stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>child.kill(signal));
child.on('error',()=>process.exit(1)); child.on('close',code=>process.exit(code??1));
`;
      await writeFile(join(bin, tool), adapter);
      await chmod(join(bin, tool), 0o700);
    }
    const awsArgs = [
      "--profile",
      "disposable",
      "--region",
      "us-east-1",
      "--endpoint-url",
      "http://127.0.0.1:9000",
    ];
    async function s3(args: string[]) {
      return exec(join(bin, "aws"), [...awsArgs, ...args]);
    }
    async function shell(database: string, script: string) {
      return exec(
        join(bin, "mongosh"),
        ["--nodb", "--quiet", "--file", "/dev/stdin"],
        `const db=connect('mongodb://127.0.0.1:27017/${database}');\n${script}`,
      );
    }
    async function ready(check: () => Promise<unknown>) {
      for (let i = 0; i < 60; i++) {
        try {
          await check();
          return;
        } catch {
          await setTimeout(1000);
        }
      }
      throw new Error("Disposable service failed to become ready.");
    }
    await ready(() => shell("source", "db.runCommand({ping:1});"));
    await ready(() => s3(["s3api", "list-buckets"]));
    for (const name of ["source-media", "destination-media"])
      await s3(["s3api", "create-bucket", "--bucket", name]);
    async function config(name: string, database: string, bucket: string) {
      await writeFile(
        join(root, `.env.${name}`),
        `DATABASE_URI=mongodb://127.0.0.1:27017/${database}\nS3_BUCKET=${bucket}\nAWS_PROFILE=disposable\nAWS_REGION=us-east-1\nS3_ENDPOINT_URL=http://127.0.0.1:9000\n`,
      );
    }
    await config("source", "source", "source-media");
    await config("destination", "destination", "destination-media");
    const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
    async function data(args: string[]) {
      return exec(process.execPath, [cli, ...args, "--config-dir", root]);
    }
    await shell(
      "source",
      `db.posts.insertOne({_id:'saved',title:'Recovered'}); db.posts.createIndex({title:1},{unique:true}); for(const c of ['users','api-keys','payload-preferences']) db.getCollection(c).insertOne({_id:'source-identity'});`,
    );
    await shell(
      "destination",
      `db.posts.insertOne({_id:'old'}); db.orphan.insertOne({_id:'remove'}); for(const c of ['users','api-keys','payload-preferences']) db.getCollection(c).insertOne({_id:'destination-identity'});`,
    );
    const photo = join(root, "photo.txt");
    await writeFile(photo, "good");
    await s3(["s3", "cp", photo, "s3://source-media/photo.txt"]);
    const snapshot = join(root, "snapshot");
    await data(["backup", "--env", "source", "--output", snapshot]);
    // A same-size newer object must be overwritten, even when sync would skip it.
    await writeFile(photo, "evil");
    await s3(["s3", "cp", photo, "s3://destination-media/photo.txt"]);
    await s3(["s3", "cp", photo, "s3://destination-media/extra.txt"]);
    const preview = await data([
      "restore",
      "--env",
      "destination",
      "--input",
      snapshot,
      "--dry-run",
    ]);
    assert.match(
      preview,
      /DROP destination collections \(2\):\n {2}"orphan"\n {2}"posts"/,
    );
    assert.match(preview, /RESTORE snapshot collections \(1\):\n {2}"posts"/);
    assert.match(preview, /UPLOAD snapshot objects .*\(1\):\n {2}"photo.txt"/);
    assert.match(
      preview,
      /DELETE destination-only objects \(1\):\n {2}"extra.txt"/,
    );
    assert.equal(
      (await shell("destination", `print(db.posts.findOne()._id);`)).trim(),
      "old",
    );
    await assert.rejects(
      data([
        "restore",
        "--env",
        "destination",
        "--input",
        snapshot,
        "--confirm",
        "source",
      ]),
    );
    await data([
      "restore",
      "--env",
      "destination",
      "--input",
      snapshot,
      "--confirm",
      "destination",
    ]);
    const result = JSON.parse(
      (
        await shell(
          "destination",
          `print(JSON.stringify({posts:db.posts.find().toArray(),orphan:db.getCollectionNames().includes('orphan'),identities:['users','api-keys','payload-preferences'].map(c=>db.getCollection(c).find().toArray()),indexes:db.posts.getIndexes()}));`,
        )
      ).trim(),
    );
    assert.equal(result.posts.length, 1);
    assert.equal(result.posts[0]._id, "saved");
    assert.equal(result.orphan, false);
    assert.ok(
      result.identities.every(
        (docs: { _id: string }[]) =>
          docs.length === 1 && docs[0]._id === "destination-identity",
      ),
    );
    assert.ok(
      result.indexes.some(
        (index: { name: string; unique?: boolean }) =>
          index.name === "title_1" && index.unique,
      ),
    );
    const recovered = join(root, "recovered.txt");
    await s3(["s3", "cp", "s3://destination-media/photo.txt", recovered]);
    assert.equal(await readFile(recovered, "utf8"), "good");
    const objects = JSON.parse(
      await s3(["s3api", "list-objects-v2", "--bucket", "destination-media"]),
    );
    assert.deepEqual(
      objects.Contents.map((o: { Key: string }) => o.Key),
      ["photo.txt"],
    );
    // An empty media snapshot is valid, and deliberately empties destination S3.
    await s3(["s3", "rm", "s3://source-media", "--recursive"]);
    const empty = join(root, "empty-media");
    await data(["backup", "--env", "source", "--output", empty]);
    await data([
      "restore",
      "--env",
      "destination",
      "--input",
      empty,
      "--confirm",
      "destination",
    ]);
    const emptyObjects = JSON.parse(
      await s3(["s3api", "list-objects-v2", "--bucket", "destination-media"]),
    );
    assert.deepEqual(emptyObjects.Contents ?? [], []);
    t.diagnostic(
      "Verified documents, indexes, cross-database namespace mapping, all identity exclusions, destination-only deletions, same-size media replacement, and empty-media recovery.",
    );
  },
);
