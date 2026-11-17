import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  writeFile,
  mkdir,
  symlink,
  readdir,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fixture } from "./helpers.ts";
import {
  describe,
  loadEnvironment,
  restoreConnectionUri,
} from "../src/config.ts";
import { validateSnapshot } from "../src/snapshot.ts";

test("restore URI removes database selection while preserving explicit, implicit and SRV authentication", async () => {
  const local = new URL(
    await restoreConnectionUri(
      "mongodb://user:password@localhost:27017/target",
    ),
  );
  assert.equal(local.pathname, "/");
  assert.equal(local.searchParams.get("authSource"), "target");
  const explicit = new URL(
    await restoreConnectionUri(
      "mongodb://user:password@localhost/target?authSource=admin&tls=true",
    ),
  );
  assert.equal(explicit.searchParams.get("authSource"), "admin");
  assert.equal(explicit.searchParams.get("tls"), "true");
  const external = new URL(
    await restoreConnectionUri(
      "mongodb://localhost/target?authMechanism=MONGODB-X509",
    ),
  );
  assert.equal(external.searchParams.get("authSource"), "$external");
  const srv = await restoreConnectionUri(
    "mongodb+srv://user:password@cluster.example/target",
    async (host) => {
      assert.equal(host, "cluster.example");
      return [["authSource=", "admin&replicaSet=test"]];
    },
  );
  assert.match(srv, /authSource=admin/);
  assert.doesNotMatch(srv, /\/target/);
  const srvDefault = await restoreConnectionUri(
    "mongodb+srv://user:password@cluster.example/target",
    async () => [],
  );
  assert.match(srvDefault, /authSource=target/);
  await assert.rejects(
    restoreConnectionUri(
      "mongodb+srv://user:password@cluster.example/target",
      async () => [["authSource=one"], ["authSource=two"]],
    ),
    /Cannot resolve/,
  );
});

test("snapshots accept the prelude metadata emitted by newer database tools", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const root = join(f.root, "snapshot");
  const result = await f.run(["backup", "--output", root], {
    TEST_PRELUDE: "1",
  });
  assert.equal(result.code, 0, result.output);
  assert.ok(
    (await validateSnapshot(root)).files.some(
      (f) => f.path === "database/prelude.json",
    ),
  );
});

test("a complete snapshot replaced during confirmation is refused before deletion", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const root = join(f.root, "snapshot");
  assert.equal((await f.run(["backup", "--output", root])).code, 0);
  await f.resetLog();
  const result = await f.run(
    ["restore", "--input", root, "--confirm", "test"],
    { TEST_REPLACE_MANIFEST: join(root, "manifest.json") },
  );
  assert.notEqual(result.code, 0);
  assert.match(result.output, /Snapshot changed/);
  assert.ok(!(await f.commands()).some((c) => c.input.includes(".drop()")));
});

test("unsafe S3 keys are refused before backup, and storage failures stop completion/deletion", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  for (const keys of [
    ["../escape"],
    ["/absolute"],
    ["nested/../escape"],
    ["folder/"],
    ["Photo.txt", "photo.txt"],
    ["photo.txt", "photo.txt/nested"],
  ]) {
    await f.resetLog();
    const result = await f.run(["backup", "--output", join(f.root, "unsafe")], {
      TEST_OBJECTS: JSON.stringify(keys.map((Key) => ({ Key, Size: 4 }))),
    });
    assert.notEqual(result.code, 0);
    assert.ok(
      !(await f.commands()).some(
        (c) => c.tool === "mongodump" && !c.args.includes("--version"),
      ),
    );
  }
  const failed = join(f.root, "failed-media");
  const result = await f.run(["backup", "--output", failed], {
    TEST_FAIL: "aws",
    TEST_FAIL_ARG: "sync",
  });
  assert.notEqual(result.code, 0);
  assert.ok(!(await readdir(failed)).includes("manifest.json"));
  const good = join(f.root, "good");
  assert.equal((await f.run(["backup", "--output", good])).code, 0);
  await f.resetLog();
  const restore = await f.run(
    ["restore", "--input", good, "--confirm", "test"],
    { TEST_FAIL: "aws", TEST_FAIL_ARG: "cp" },
  );
  assert.notEqual(restore.code, 0);
  assert.match(restore.output, /uploading S3 objects/);
  assert.ok(
    !(await f.commands()).some(
      (c) => c.args.includes("--delete") && !c.args.includes("--dryrun"),
    ),
  );
  assert.doesNotMatch(JSON.stringify(await f.commands()), /secret-password/);
  assert.ok(
    !(await readdir(f.root)).some((name) => name.startsWith("website-mongo-")),
  );
});

test("configuration is explicit, validated, isolated from shell settings and redacted", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const env = await loadEnvironment("test", f.config);
  assert.equal(env.database, "source");
  assert.doesNotMatch(describe(env), /operator|secret-password/);
  for (const name of ["../test", "Test", "", "test/extra", "--production"])
    await assert.rejects(
      loadEnvironment(name, f.config),
      /Invalid environment/,
    );
  const path = join(f.config, ".env.test");
  const original = await readFile(path, "utf8");
  for (const uri of [
    "https://host/source",
    "mongodb://localhost",
    "mongodb://localhost/admin",
    "mongodb://localhost/ADMIN",
    "mongodb://localhost/config",
    "mongodb://localhost/local",
    "mongodb://localhost/wild*card",
  ]) {
    await writeFile(
      path,
      original.replace(/DATABASE_URI=.*/, `DATABASE_URI=${uri}`),
    );
    await assert.rejects(loadEnvironment("test", f.config), /DATABASE_URI/);
  }
  for (const [key, value] of [
    ["S3_BUCKET", "s3://bucket/path"],
    ["AWS_PROFILE", "bad profile"],
    ["AWS_REGION", "invalid"],
    ["S3_ENDPOINT_URL", "https://user:password@host/"],
  ]) {
    await writeFile(path, original + `\n${key}=${value}\n`);
    await assert.rejects(loadEnvironment("test", f.config));
  }
  await writeFile(path, original.replace(/DATABASE_URI=.*/, ""));
  assert.notEqual(
    (
      await f.run(["backup", "--output", join(f.root, "snapshot")], {
        DATABASE_URI: env.uri,
      })
    ).code,
    0,
  );
  assert.equal((await f.commands()).length, 0);
  await writeFile(
    path,
    original + `\nIGNORED='$(touch ${join(f.root, "executed")})'\n`,
  );
  await loadEnvironment("test", f.config);
  assert.ok(!(await readdir(f.root)).includes("executed"));
  await writeFile(
    path,
    original.replace("localhost:27017", "host-a:27017,host-b:27018"),
  );
  assert.equal(
    (await loadEnvironment("test", f.config)).hosts,
    "host-a:27017,host-b:27018",
  );
});

test("backup publishes checksummed snapshots without overwriting; restore maps namespaces and preserves identity", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const snapshot = join(f.root, "snapshot with spaces");
  const saved = await f.run(["backup", "--output", snapshot]);
  assert.equal(saved.code, 0, saved.output);
  assert.doesNotMatch(saved.output, /secret-password/);
  const m = await validateSnapshot(snapshot);
  assert.equal(m.database, "source");
  assert.equal(m.files.length, 3);
  assert.doesNotMatch(
    await readFile(join(snapshot, "manifest.json"), "utf8"),
    /operator|secret-password/,
  );
  const before = await readFile(join(snapshot, "manifest.json"), "utf8");
  assert.notEqual((await f.run(["backup", "--output", snapshot])).code, 0);
  assert.equal(await readFile(join(snapshot, "manifest.json"), "utf8"), before);
  const path = join(f.config, ".env.test");
  await writeFile(
    path,
    (await readFile(path, "utf8")).replace("/source", "/destination"),
  );
  await f.resetLog();
  const dry = await f.run(["restore", "--input", snapshot, "--dry-run"]);
  assert.equal(dry.code, 0, dry.output);
  assert.ok(
    !(await f.commands()).some(
      (c) => c.input.includes(".drop()") || c.args.includes("cp"),
    ),
  );
  for (const args of [[], ["--confirm", "production"]]) {
    await f.resetLog();
    const refused = await f.run(["restore", "--input", snapshot, ...args]);
    assert.notEqual(refused.code, 0);
    assert.ok(
      !(await f.commands()).some(
        (c) => c.input.includes(".drop()") || c.args.includes("cp"),
      ),
    );
  }
  await f.resetLog();
  const restored = await f.run([
    "restore",
    "--input",
    snapshot,
    "--confirm",
    "test",
  ]);
  assert.equal(restored.code, 0, restored.output);
  const commands = await f.commands();
  const drop = commands.find((c) => c.input.includes(".drop()"))!;
  assert.match(drop.input, /users.*api-keys.*payload-preferences/);
  const restore = commands.find(
    (c) =>
      c.tool === "mongorestore" &&
      !c.args.includes("--dryRun") &&
      !c.args.includes("--version"),
  )!;
  for (const arg of [
    "--stopOnError",
    "--nsFrom=source.*",
    "--nsTo=destination.*",
    "--nsExclude=source.users",
    "--nsExclude=source.api-keys",
    "--nsExclude=source.payload-preferences",
  ])
    assert.ok(restore.args.includes(arg));
  const upload = commands.findIndex((c) => c.args.includes("cp"));
  assert.ok(upload > commands.indexOf(restore));
  assert.ok(
    commands.slice(upload + 1).some((c) => c.args.includes("--delete")),
  );
});

test("corrupt, incomplete, foreign-namespace and symlink snapshots are refused before subprocesses", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const root = join(f.root, "snapshot");
  assert.equal((await f.run(["backup", "--output", root])).code, 0);
  const manifestPath = join(root, "manifest.json");
  const text = await readFile(manifestPath, "utf8");
  const m = JSON.parse(text);
  const media = join(root, "media", "photo.txt");
  async function refused() {
    await f.resetLog();
    const result = await f.run([
      "restore",
      "--input",
      root,
      "--confirm",
      "test",
    ]);
    assert.notEqual(result.code, 0, result.output);
    assert.equal((await f.commands()).length, 0);
  }
  await writeFile(media, "evil");
  await refused();
  await writeFile(media, "copy");
  await writeFile(join(root, "extra"), "unexpected");
  await refused();
  await rm(join(root, "extra"));
  await mkdir(join(root, "unfinished"));
  await refused();
  await rm(join(root, "unfinished"), { recursive: true });
  await rm(media);
  await symlink(manifestPath, media);
  await refused();
  await rm(media);
  await writeFile(media, "copy");
  for (const change of [
    { version: 2 },
    { database: "other" },
    { files: [...m.files, m.files[0]] },
    { files: [{ ...m.files[0], path: "../escape" }] },
    {
      files: m.files.filter((f: { path: string }) =>
        f.path.startsWith("media/"),
      ),
    },
  ]) {
    await writeFile(manifestPath, JSON.stringify({ ...m, ...change }));
    await refused();
  }
  await rm(manifestPath);
  await refused();
});

test("failed backups cannot be restored, and failed MongoDB recovery never uploads media", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const broken = join(f.root, "broken");
  const failed = await f.run(["backup", "--output", broken], {
    TEST_FAIL: "mongodump",
  });
  assert.notEqual(failed.code, 0);
  assert.match(failed.output, /Backup incomplete/);
  assert.doesNotMatch(failed.output, /secret-password/);
  assert.ok(!(await readdir(broken)).includes("manifest.json"));
  const good = join(f.root, "good");
  assert.equal((await f.run(["backup", "--output", good])).code, 0);
  await f.resetLog();
  const restore = await f.run(
    ["restore", "--input", good, "--confirm", "test"],
    { TEST_FAIL: "mongorestore" },
  );
  assert.notEqual(restore.code, 0);
  assert.match(restore.output, /partially changed/);
  assert.doesNotMatch(restore.output, /secret-password/);
  assert.ok(!(await f.commands()).some((c) => c.args.includes("cp")));
  await f.resetLog();
  assert.notEqual(
    (
      await f.run(["restore", "--input", good, "--confirm", "test"], {
        TEST_FAIL: "mongorestore",
        TEST_FAIL_DRY: "1",
      })
    ).code,
    0,
  );
  assert.ok(!(await f.commands()).some((c) => c.input.includes(".drop()")));
});

test("launch failures and interruption fail closed and do not publish a completed snapshot", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  await rm(join(f.bin, "mongodump"));
  const missing = await f.run(["backup", "--output", join(f.root, "missing")], {
    PATH: f.bin,
  });
  assert.notEqual(missing.code, 0);
  assert.match(missing.output, /Could not launch mongodump/);
  const f2 = await fixture();
  t.after(f2.cleanup);
  const root = join(f2.root, "interrupted");
  const { child, done } = f2.start(["backup", "--output", root], {
    TEST_BLOCK: "mongodump",
  });
  for (let i = 0; i < 100; i++) {
    if (
      (await f2.commands()).some(
        (c) => c.tool === "mongodump" && !c.args.includes("--version"),
      )
    )
      break;
    await setTimeout(50);
  }
  child.kill("SIGTERM");
  const result = await done;
  assert.equal(result.code, 130, result.output);
  assert.ok(!(await readdir(root)).includes("manifest.json"));
});
