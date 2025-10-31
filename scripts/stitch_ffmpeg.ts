import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { loadScriptPlan, ScriptPlan, ScriptValidationError } from "./script_schema.js";
import { StatusReporter } from "./status.js";

async function ffmpegConcat(files: string[], out: string) {
  const listPath = path.resolve("out", "ffconcat.txt");
  const lines = files.map(f => `file '${f.replace(/'/g, "'\\''")}' `).join("\n");
  await fs.writeFile(listPath, lines, "utf8");
  await new Promise<void>((resolve, reject) => {
    const p = spawn("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", out], {
      stdio: "inherit"
    });
    p.on("close", code => code === 0 ? resolve() : reject(new Error("ffmpeg failed")));
  });
}

async function fileExists(filePath: string) {
  try {
    await fs.access(path.resolve(filePath));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const status = new StatusReporter("stitch", {
    escalationContact: "support@fanficvideo.local"
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
    status.emptyState("Beats", "Add beats before stitching a final video.");
    return;
  }

  const files = [] as string[];
  for (const beat of plan.beats) {
    const kissPath = `out/kiss/${beat.id}.mp4`;
    if (beat.effect === "kiss" && await fileExists(kissPath)) {
      files.push(kissPath);
      continue;
    }

    const syncedPath = `out/synced/${beat.id}.mp4`;
    if (beat.needLipSync && await fileExists(syncedPath)) {
      files.push(syncedPath);
      continue;
    }

    const basePath = `out/${beat.id}.mp4`;
    if (await fileExists(basePath)) {
      files.push(basePath);
    } else {
      status.warn(`Missing source clip for beat ${beat.id}. Expected ${basePath}.`);
    }
  }

  if (files.length === 0) {
    status.emptyState("Rendered clips", "Generate videos before stitching them together.");
    return;
  }

  const out = path.resolve("out/final_scene.mp4");
  await status.step("Concatenating final video", async () => {
    await ffmpegConcat(files, out);
  });
  status.success(`Final scene ready at ${out}`);
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
