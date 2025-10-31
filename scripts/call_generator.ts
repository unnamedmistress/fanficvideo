import "dotenv/config";
import path from "path";
import fs from "fs/promises";
import RunwayML from "@runwayml/sdk";
import {
  describeSupportedDurations,
  loadScriptPlan,
  mapToSupportedDuration,
  ScriptPlan,
  ScriptValidationError
} from "./script_schema.js";
import { StatusReporter, withRetry } from "./status.js";
import {
  AspectRatioPreference,
  RunwayModelPreference,
  loadPreferences,
  savePreferences
} from "./preferences.js";

const runway = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY! });

type CliOptions = {
  model?: string;
  ratio?: string;
  advanced?: boolean;
  help?: boolean;
};

const SUPPORTED_MODELS: RunwayModelPreference[] = ["veo3.1_fast", "veo3.1", "veo3"];
const SUPPORTED_RATIOS: AspectRatioPreference[] = ["1280:720", "720:1280", "1080:1920", "1920:1080"];

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      break;
    }
    if (arg === "--advanced") {
      options.advanced = true;
      continue;
    }
    if (arg === "--model" && args[i + 1]) {
      options.model = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--ratio" && args[i + 1]) {
      options.ratio = args[i + 1];
      i += 1;
    }
  }
  return options;
}

function printHelp() {
  console.log(`Usage: ts-node scripts/call_generator.ts [options]\n\n`);
  console.log(`Options:`);
  console.log(`  --model <name>     Override the Runway model (default: saved preference)`);
  console.log(`  --ratio <w:h>      Override the aspect ratio (default: saved preference)`);
  console.log(`  --advanced         Show progressive disclosure details for debugging`);
  console.log(`  -h, --help         Show this message and exit`);
}

function normalizeModel(value: string | undefined, fallback: RunwayModelPreference, status: StatusReporter) {
  if (!value) return fallback;
  if ((SUPPORTED_MODELS as string[]).includes(value)) {
    return value as RunwayModelPreference;
  }
  status.warn(
    `Model ${value} is not supported. Falling back to ${fallback}. Supported models: ${SUPPORTED_MODELS.join(", ")}.`
  );
  return fallback;
}

function normalizeRatio(value: string | undefined, fallback: AspectRatioPreference, status: StatusReporter) {
  if (!value) return fallback;
  if ((SUPPORTED_RATIOS as string[]).includes(value)) {
    return value as AspectRatioPreference;
  }
  status.warn(
    `Ratio ${value} is not supported. Falling back to ${fallback}. Supported ratios: ${SUPPORTED_RATIOS.join(", ")}.`
  );
  return fallback;
}

async function downloadVideo(url: string, outFile: string) {
  await withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Download failed ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(outFile, buf);
  });
}

function warnAboutDuration(plan: ScriptPlan, status: StatusReporter) {
  for (const beat of plan.beats) {
    const supported = mapToSupportedDuration(beat.durationSec);
    if (supported !== beat.durationSec) {
      status.warn(
        `Beat ${beat.id} duration ${beat.durationSec}s is not supported. Using ${supported}s instead. Supported durations: ${describeSupportedDurations()}.`
      );
    }
  }
}

async function main() {
  const cliOptions = parseArgs();
  if (cliOptions.help) {
    printHelp();
    return;
  }

  const status = new StatusReporter("generator", {
    escalationContact: "support@fanficvideo.local",
    advanced: cliOptions.advanced
  });

  let plan: ScriptPlan;
  try {
    plan = await loadScriptPlan();
  } catch (error) {
    if (error instanceof ScriptValidationError) {
      status.error(error.message);
      console.error(error.formatIssues());
      return;
    }
    throw error;
  }

  if (plan.beats.length === 0) {
    status.emptyState("Scene plan", "Run npm run plan to generate beats or edit data/beats.json manually.");
    return;
  }

  const preferences = await loadPreferences();
  const model = normalizeModel(cliOptions.model, preferences.defaultModel, status);
  const ratio = normalizeRatio(cliOptions.ratio, preferences.lastRatio, status);
  status.info(`Using Runway model ${model} (ratio ${ratio}).`);
  if (!cliOptions.model) {
    status.advanced(`Model filled from data/user-preferences.json. Override with --model if needed.`);
  }
  if (!cliOptions.ratio) {
    status.advanced(`Aspect ratio remembered from your last run.`);
  }

  warnAboutDuration(plan, status);

  const outDir = path.resolve("out");
  await fs.mkdir(outDir, { recursive: true });

  for (const beat of plan.beats) {
    const duration = mapToSupportedDuration(beat.durationSec);
    const targetFile = path.join(outDir, `${beat.id}.mp4`);
    await status.step(`Rendering ${beat.id} (${duration}s)`, async () => {
      status.advanced(`Prompt: ${beat.prompt}`);
      const task = await withRetry(
        async () =>
          runway.textToVideo
            .create({
              model,
              promptText: beat.prompt,
              ratio,
              duration
            })
            .waitForTaskOutput(),
        { attempts: 3, delayMs: 2000 }
      );

      const url = task.output?.[0];
      if (!url) throw new Error("No video output from Runway");
      status.advanced(`Download URL: ${url}`);
      await downloadVideo(url, targetFile);
    });
  }

  await savePreferences({ defaultModel: model, lastRatio: ratio });
  status.success("Saved defaults to data/user-preferences.json");
}

void main().catch(error => {
  if (error instanceof ScriptValidationError) {
    console.error(error.message);
    console.error(error.formatIssues());
  } else {
    console.error(error);
  }
  process.exit(1);
});
