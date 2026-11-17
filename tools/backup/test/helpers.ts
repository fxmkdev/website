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
  const stub = `#!${process.execPath}
import { appendFileSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
const tool = basename(process.argv[1]);
const args = process.argv.slice(2);
let input = '';
for await (const chunk of process.stdin) input += chunk;
appendFileSync(process.env.TEST_LOG, JSON.stringify({tool,args,input})+'\\n');
if (args.includes('--version')) process.exit(0);
if (tool === 'mongorestore' && args.includes('--dryRun') && process.env.TEST_REPLACE_MANIFEST) {
  const path=process.env.TEST_REPLACE_MANIFEST;
  const manifest=JSON.parse(readFileSync(path,'utf8')); manifest.environment='replaced';
  writeFileSync(path,JSON.stringify(manifest));
}
if (process.env.TEST_BLOCK === tool && !args.includes('--dryRun')) { setInterval(() => {}, 1000); }
else if (process.env.TEST_FAIL === tool && (!process.env.TEST_FAIL_ARG || args.includes(process.env.TEST_FAIL_ARG)) && (!args.includes('--dryRun') || process.env.TEST_FAIL_DRY === '1')) {
  console.error('credential leak: mongodb://operator:secret-password@localhost/source'); process.exit(7);
}
else if (tool === 'mongodump') {
  const out = args.find(a=>a.startsWith('--out=')).slice(6);
  const uri = JSON.parse(readFileSync(args.find(a=>a.startsWith('--config=')).slice(9),'utf8')).uri;
  const db = new URL(uri).pathname.slice(1);
  mkdirSync(join(out, db), {recursive:true});
  if (process.env.TEST_PRELUDE) writeFileSync(join(out,db,'prelude.json'),'{}');
  writeFileSync(join(out, db, 'posts.bson'), 'test-bson');
  writeFileSync(join(out, db, 'posts.metadata.json'), '{}');
}
else if (tool === 'aws' && args.includes('list-objects-v2')) console.log(process.env.TEST_OBJECTS ?? JSON.stringify([{Key:'photo.txt',Size:4}]));
else if (tool === 'aws' && args.includes('sync') && args.some(a=>a.startsWith('s3://')) && !args.includes('--dryrun')) {
  const source = args[args.indexOf('sync')+1];
  const destination = args[args.indexOf('sync')+2];
  if (source.startsWith('s3://')) writeFileSync(join(destination,'photo.txt'),'copy');
}
`;
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
