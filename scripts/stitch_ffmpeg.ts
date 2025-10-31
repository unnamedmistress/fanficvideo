import fs from "fs/promises";
import path from "path";
import { readJSON } from "./util.js";
import { spawn } from "child_process";

type Beat = { id: string; needLipSync?: boolean };

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

async function main() {
  const script = await readJSON<Script>("data/beats.json");
  const files = script.beats.map(b => b.needLipSync ? `out/synced/${b.id}.mp4` : `out/${b.id}.mp4`);
  const out = path.resolve("out/final_scene.mp4");
  await ffmpegConcat(files, out);
  console.log("Final:", out);
}

main().catch(e => { console.error(e); process.exit(1); });
