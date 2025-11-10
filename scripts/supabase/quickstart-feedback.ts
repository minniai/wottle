import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { exit, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

interface CliOptions {
  rating?: number;
  notes?: string;
  source?: string;
  outputPath: string;
  nonInteractive: boolean;
}

const DEFAULT_OUTPUT = "test-results/quickstart-feedback.jsonl";

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    outputPath: resolve(process.cwd(), process.env.QUICKSTART_FEEDBACK_PATH ?? DEFAULT_OUTPUT),
    nonInteractive: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      exit(0);
    }

    if (arg === "--non-interactive") {
      options.nonInteractive = true;
      continue;
    }

    if (arg.startsWith("--output=")) {
      const [, value] = arg.split("=", 2);
      if (value) {
        options.outputPath = resolve(process.cwd(), value);
      }
      continue;
    }

    if (arg === "--output") {
      const value = argv[i + 1];
      if (value) {
        options.outputPath = resolve(process.cwd(), value);
        i += 1;
      }
      continue;
    }

    if (arg.startsWith("--rating=")) {
      const [, value] = arg.split("=", 2);
      if (value) {
        options.rating = Number(value);
      }
      continue;
    }

    if (arg === "--rating") {
      const value = argv[i + 1];
      if (value) {
        options.rating = Number(value);
        i += 1;
      }
      continue;
    }

    if (arg.startsWith("--notes=")) {
      const [, value] = arg.split("=", 2);
      if (value !== undefined) {
        options.notes = value;
      }
      continue;
    }

    if (arg === "--notes") {
      const value = argv[i + 1];
      if (value !== undefined) {
        options.notes = value;
        i += 1;
      }
      continue;
    }

    if (arg.startsWith("--source=")) {
      const [, value] = arg.split("=", 2);
      if (value) {
        options.source = value;
      }
      continue;
    }

    if (arg === "--source") {
      const value = argv[i + 1];
      if (value) {
        options.source = value;
        i += 1;
      }
      continue;
    }
  }

  return options;
}

function printHelp() {
  stdout.write(`Capture developer feedback after running the Supabase quickstart.\n\n`);
  stdout.write(`Usage: pnpm quickstart:feedback [options] \n\n`);
  stdout.write(`Options:\n`);
  stdout.write(`  --rating <1-5>          Confidence rating (1=low, 5=high)\n`);
  stdout.write(`  --notes <text>          Optional feedback notes\n`);
  stdout.write(`  --source <label>        Identifier for the feedback source (e.g., cli, ci)\n`);
  stdout.write(`  --output <path>         Override output file path (default: ${DEFAULT_OUTPUT})\n`);
  stdout.write(`  --non-interactive       Do not prompt; requires --rating\n`);
  stdout.write(`  -h, --help              Show this message\n`);
}

function assertValidRating(value: number | undefined): asserts value is number {
  if (value === undefined) {
    throw new Error("Invalid rating. Provide an integer between 1 and 5.");
  }

  if (!Number.isFinite(value) || value < 1 || value > 5) {
    throw new Error("Invalid rating. Provide an integer between 1 and 5.");
  }
}

async function promptForRating(rl: ReturnType<typeof createInterface>): Promise<number> {
  while (true) {
    const answer = await rl.question("Confidence after quickstart (1-5): ");
    const numeric = Number(answer.trim());
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) {
      return numeric;
    }
    stdout.write("Please enter an integer between 1 and 5.\n");
  }
}

async function promptForNotes(rl: ReturnType<typeof createInterface>): Promise<string | undefined> {
  const answer = await rl.question("Any feedback notes? (optional): ");
  const trimmed = answer.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function persistFeedback(options: { outputPath: string; payload: Record<string, unknown> }) {
  const directory = dirname(options.outputPath);
  mkdirSync(directory, { recursive: true });
  appendFileSync(options.outputPath, `${JSON.stringify(options.payload)}\n`, "utf8");
}

async function main() {
  const [, , ...argv] = process.argv;
  const options = parseArgs(argv);

  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  try {
    if (options.rating === undefined) {
      if (options.nonInteractive) {
        throw new Error("--rating is required when using --non-interactive");
      }
      options.rating = await promptForRating(rl);
    }

    assertValidRating(options.rating);

    if (options.notes === undefined && !options.nonInteractive) {
      options.notes = await promptForNotes(rl);
    }

    const payload = {
      event: "supabase.quickstart.feedback",
      timestamp: new Date().toISOString(),
      rating: options.rating,
      notes: options.notes,
      source: options.source ?? (options.nonInteractive ? "automated" : "cli"),
    };

    persistFeedback({ outputPath: options.outputPath, payload });

    stdout.write(`Feedback recorded in ${options.outputPath}\n`);
  } catch (error) {
    if (error instanceof Error) {
      stdout.write(`${error.message}\n`);
    } else {
      stdout.write(`${String(error)}\n`);
    }
    exit(1);
  } finally {
    rl.close();
  }
}

await main();
