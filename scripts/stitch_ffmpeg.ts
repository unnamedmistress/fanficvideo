import fs from "fs/promises";
import path from "path";
import { readJSON } from "./util.js";
import { spawn } from "child_process";

type Beat = { id: string; needLipSync?: boolean; effect?: string };

type Script = { beats: Beat[] };

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
  const script = await readJSON<Script>("data/beats.json");
  const files = [] as string[];
  for (const beat of script.beats) {
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

    files.push(`out/${beat.id}.mp4`);
  }
  const out = path.resolve("out/final_scene.mp4");
  await ffmpegConcat(files, out);
  console.log("Final:", out);
}

main().catch(e => { console.error(e); process.exit(1); });
