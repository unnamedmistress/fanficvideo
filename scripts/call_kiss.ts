import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import { env, envOr, saveURL, sleep } from "./util.js";
import { loadScriptPlan, ScriptPlan, ScriptValidationError } from "./script_schema.js";
import { StatusReporter, withRetry } from "./status.js";

type GenerateResponse = {
  task_id?: string;
  taskId?: string;
  task_url?: string;
  taskUrl?: string;
};

type TaskOutput = {
  status: string;
  result?: {
    download_url?: string;
    video_url?: string;
  };
  output?: {
    video_url?: string;
  };
  error?: string;
};

const API_KEY = env("GOENHANCE_API_KEY");
const API_BASE = envOr("GOENHANCE_API_BASE_URL", "https://api.goenhance.com").replace(/\/$/, "");

async function pollTask(url: string): Promise<TaskOutput> {
  for (;;) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`
      }
    });
    if (!res.ok) {
      throw new Error(`GoEnhance task poll failed ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as TaskOutput;
    const status = body.status?.toLowerCase();
    if (["succeeded", "completed", "finished"].includes(status)) {
      return body;
    }
    if (["failed", "error", "canceled"].includes(status)) {
      throw new Error(`GoEnhance task failed (${body.status}): ${body.error ?? ""}`);
    }
    await sleep(2000);
  }
}

async function triggerEffect(beatId: string, videoPath: string) {
  const video = await fs.readFile(videoPath);
  const res = await withRetry(
    () =>
      fetch(`${API_BASE}/video-effects/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          effect: "kiss",
          metadata: { beatId },
          input_video: `data:video/mp4;base64,${video.toString("base64")}`
        })
      }),
    { attempts: 3, delayMs: 1500 }
  );
  if (!res.ok) {
    throw new Error(`GoEnhance generate failed ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as GenerateResponse;
  const taskUrl =
    json.task_url ??
    json.taskUrl ??
    (json.task_id ? `${API_BASE}/tasks/${json.task_id}` : undefined) ??
    (json.taskId ? `${API_BASE}/tasks/${json.taskId}` : undefined);
  if (!taskUrl) {
    throw new Error("GoEnhance response missing task URL");
  }
  return pollTask(taskUrl);
}

async function main() {
  const status = new StatusReporter("kiss", {
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

  const beats = plan.beats.filter(b => b.effect === "kiss");
  if (beats.length === 0) {
    status.emptyState(
      "Kiss effect",
      "Tag beats with effect: \"kiss\" to send them to GoEnhance or skip this step."
    );
    return;
  }

  const outDir = path.resolve("out/kiss");
  await fs.mkdir(outDir, { recursive: true });

  for (const beat of beats) {
    const baseVideo = path.resolve("out", `${beat.id}.mp4`);
    await status.step(`Submitting GoEnhance task for ${beat.id}`, async () => {
      const result = await triggerEffect(beat.id, baseVideo);
      const downloadUrl =
        result.result?.download_url ??
        result.result?.video_url ??
        result.output?.video_url;
      if (!downloadUrl) {
        throw new Error(`GoEnhance completed without download URL for beat ${beat.id}`);
      }
      const outPath = path.join(outDir, `${beat.id}.mp4`);
      await saveURL(downloadUrl, outPath);
    });
  }

  status.success(`Enhanced ${beats.length} beat(s) with kiss overlay.`);
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
