# Environment backup and recovery

This CLI replaces the root `backup.sh` and `restore.sh` scripts. It backs up a
single MongoDB application database and its S3 media bucket together. All
operations require an explicit environment; there is no default.

## Prerequisites and configuration

Use macOS or Linux, Node.js 24, and the repository's pinned pnpm version.
Install dependencies with `pnpm install --frozen-lockfile`. Install MongoDB
Database Tools (`mongodump` and `mongorestore`, supporting `--config` and
`--dryRun`), `mongosh`, and AWS CLI v2 on your PATH. Use compatible MongoDB
source/destination major versions and database tools; this is a logical
application backup, not an oplog or cluster disaster-recovery tool.

Copy `tools/backup/.env.example` to `tools/backup/.env.production`,
`.env.staging`, or another named environment. Names must start with a lowercase
letter and contain only lowercase letters, digits, or hyphens (maximum 63
characters).

```dotenv
DATABASE_URI=mongodb+srv://operator:password@cluster.example/website-cms?authSource=admin
S3_BUCKET=website-media
AWS_PROFILE=website
AWS_REGION=eu-central-1
```

The database name must be explicit in the URI, contain only letters, digits,
underscores, or hyphens, and must not be `admin`, `config`, or `local`.
`S3_BUCKET` is a plain bucket name, without `s3://` or a prefix. Optionally set
`S3_ENDPOINT_URL` to an HTTP(S) origin for S3-compatible storage.

Environment files are ignored by Git and parsed as data, never sourced as shell
scripts. Connection/bucket settings come only from the selected file; the CLI
does not fall back to a root `.env` or ambient connection variables. Configure
credentials separately using the named AWS profile (for example,
`aws configure --profile website` or AWS SSO). The profile and region are
explicit on every AWS command; ambient endpoint overrides are disabled. Standard
AWS credential/config file locations remain supported.

Use `--config-dir /absolute/directory` to read `.env.<environment>` elsewhere.
Restrict permissions on environment files and backups; snapshots contain all
database collections, including identity data. Child-tool diagnostics are
suppressed because they may echo connection credentials; errors identify the
tool, exit status, and failing phase instead.

## Create a backup

Pause CMS/application writes while backing up both MongoDB and media. The two
systems are copied sequentially and do not form a transactional snapshot.

```sh
mkdir -p .backups
pnpm data backup --env production --output .backups/production-2026-11-17
```

The output must not exist, and its parent directory must already exist. Every
backup gets its own private directory; previous backups are never rotated,
deleted, or overwritten. Paths to snapshots must not traverse symlinks (use
physical paths such as `/private/tmp` rather than `/tmp` on macOS).

A completed snapshot contains:

- `database/<source-database>/`: BSON collections and MongoDB metadata/indexes.
- `database/prelude.json`: source server/tool metadata, when emitted by the
  database tools.
- `media/`: all S3 objects, including an empty directory for an empty bucket.
- `manifest.json`: format version, source environment/database, creation time,
  and the exact file inventory with sizes and SHA-256 checksums. It contains no
  connection URI or AWS credentials.

The manifest is published last, only after both copies and validation succeed. A
failed/interrupted backup has no completion manifest and is rejected by restore.
Keep existing good backups and retry using a new output directory. You may
manually remove incomplete output after inspecting it.

S3 keys must be safely representable as local files. Traversal components,
backslashes, control characters, trailing-slash markers, case collisions, and
file/directory collisions are rejected rather than silently lost. Empty MongoDB
databases with no BSON collections are rejected to prevent accidental empty
database replacement.

Checksums detect accidental corruption, not maliciously rewritten manifests.
Only restore snapshots you trust, and keep them immutable during recovery.

## Preview and restore

Pause writes to the destination. First create and retain a separate backup of
its current data so you have a recovery point.

```sh
pnpm data backup --env staging --output .backups/staging-before-restore
pnpm data restore --env staging --input .backups/production-2026-11-17 --dry-run
pnpm data restore --env staging --input .backups/production-2026-11-17
```

Restore validates the complete inventory, checksums, dump namespace, tool
availability, database connectivity, and bucket access before asking for
confirmation. Dry run performs validation and read-only destination checks; it
cannot guarantee future write permissions or successful data import.

The interactive prompt requires typing the exact destination environment.
Automation must supply that same name explicitly:

```sh
pnpm data restore --env staging --input .backups/production-2026-11-17 --confirm staging
```

There is no `--yes` shortcut. A missing confirmation in a noninteractive session
or a mismatched name fails before data changes.

Restore deliberately:

- Preserves destination `users`, `api-keys`, and `payload-preferences`. These
  exclusions apply both to dropping collections and importing the dump; the
  backup still includes them.
- Drops other non-system destination collections, including collections absent
  from the snapshot. Imports the source database into the configured destination
  database using namespace mapping and stops on the first import error.
- Uploads **every** snapshot media file, including same-size files whose
  destination timestamps are newer, then deletes destination-only S3 objects. An
  empty media snapshot deliberately empties the destination bucket.

Only the selected database and bucket are targeted. Confirm the displayed
MongoDB host/database, bucket, AWS profile, region, and endpoint before
accepting. S3 version history, object ACLs, and custom metadata are not backed
up; this tool recovers file contents using the same local-file model as the old
scripts.

## Failure recovery and migration

Every failed command stops the operation and exits nonzero. SIGINT/SIGTERM stop
the active child, escalating termination after five seconds if necessary. A
MongoDB failure prevents subsequent media recovery. A failure during restore may
leave partial database or bucket changes; there is no automatic rollback across
these systems. Keep writes paused, correct the reported problem, and rerun
recovery from a verified snapshot. Use the separate pre-restore backup if the
destination needs to return to its earlier content.

The old `.backup`, `.s3-backup`, and `.previous-backup.tar.gz` files are left
untouched. Legacy backups are not accepted by this CLI because they have no
completion/integrity manifest. Take a fresh backup with the new command before
retiring the old workflow. Do not fabricate a manifest for an old directory
pair.

## Verification

```sh
pnpm --filter @fxmk/backup-tools check-format
pnpm --filter @fxmk/backup-tools lint
pnpm --filter @fxmk/backup-tools typecheck
pnpm --filter @fxmk/backup-tools test
pnpm --filter @fxmk/backup-tools test:integration
```

The integration test requires Docker, builds pinned upstream MinIO source, and
pulls MongoDB and AWS CLI images. It starts isolated disposable containers,
temporary credentials, databases, buckets, and directories without publishing
host ports or using website credentials. PATH adapters run real MongoDB tools
and AWS CLI inside those containers, so host installations are unnecessary. It
verifies document/index recovery, all identity exclusions, cross-database
mapping, extra collection/object deletion, same-size media replacement, empty
media recovery, dry run, and confirmation refusal. Containers and temporary
files are removed on completion or failure. Downloaded images/build caches are
retained for subsequent runs. The dedicated Backup tools CI workflow runs the
same checks without deployment credentials.
