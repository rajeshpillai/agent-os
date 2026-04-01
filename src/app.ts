import { parseArgs, showHelp } from "./cli/parse-args.js";
import { runTaskCommand } from "./cli/commands/run-task.js";

async function main() {
  const args = parseArgs(process.argv);

  switch (args.command) {
    case "run":
      await runTaskCommand(args);
      break;
    case "help":
    case "--help":
    case "-h":
      console.log(showHelp());
      break;
    default:
      console.error(`Unknown command: ${args.command}`);
      console.log(showHelp());
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Fatal: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
