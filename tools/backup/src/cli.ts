import { Command } from "commander";
import { fileURLToPath } from "node:url";
import { loadEnvironment } from "./config.ts";
import { backup, restore } from "./operations.ts";

const controller = new AbortController();
let interrupted = false;
for (const event of ["SIGINT", "SIGTERM"] as const)
  process.on(event, () => {
    interrupted = true;
    controller.abort();
  });

const program = new Command()
  .name("data")
  .description(
    "Back up or destructively restore an explicitly selected environment.",
  );
function operation(name: string) {
  return program
    .command(name)
    .requiredOption("--env <environment>", "environment name (no default)")
    .option(
      "--config-dir <directory>",
      "directory containing .env.<environment>",
      fileURLToPath(new URL("../", import.meta.url)),
    );
}
operation("backup")
  .description("Create a new complete MongoDB and media snapshot.")
  .requiredOption(
    "--output <directory>",
    "new snapshot directory; parent must exist",
  )
  .action(async (options) =>
    backup(
      await loadEnvironment(options.env, options.configDir),
      options.output,
      controller.signal,
    ),
  );
operation("restore")
  .description(
    "Replace destination data, preserving environment-specific identity collections.",
  )
  .requiredOption("--input <directory>", "complete snapshot directory")
  .option("--dry-run", "validate and preview without writes")
  .option(
    "--confirm <environment>",
    "confirm exact destination environment for automation",
  )
  .action(async (options) =>
    restore(
      await loadEnvironment(options.env, options.configDir),
      options.input,
      controller.signal,
      options,
    ),
  );

try {
  await program.parseAsync();
} catch (error) {
  // Filesystem exceptions can include private filenames. Only our own errors
  // and sanitized subprocess diagnostics are suitable for terminal output.
  const message =
    error instanceof Error && !("code" in error)
      ? error.message
      : interrupted
        ? "Interrupted; no further operations will run."
        : "Cannot access the requested files; check paths and permissions.";
  console.error(`Error: ${message}`);
  process.exitCode = interrupted ? 130 : 1;
}
