import "dotenv/config";
import path from "path";
import fs from "fs/promises";
import RunwayML from "@runwayml/sdk";
import { readJSON } from "./util.js";

const runway = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY! });

// Runway API supported durations (in seconds)
const SUPPORTED_DURATIONS = [4, 6, 8] as const;
type SupportedDuration = typeof SUPPORTED_DURATIONS[number];

function mapToSupportedDuration(seconds: number): SupportedDuration {
  if (seconds <= 4) return 4;
  if (seconds <= 6) return 6;
  return 8;
}

type Beat = {
  id: string;
  prompt: string;
  durationSec: number;
  dialogue?: { speaker: string; text: string };
  needLipSync?: boolean;
};

type Script = {
  characters: { reference_images?: string[] }[];
  beats: Beat[];
};

async function main() {
  const script = await readJSON<Script>("data/beats.json");
  const outDir = path.resolve("out");
  await fs.mkdir(outDir, { recursive: true });

  for (const beat of script.beats) {
    console.log("Render", beat.id);
    const duration = mapToSupportedDuration(beat.durationSec);
    const task = await runway.textToVideo.create({
      model: "veo3.1_fast",
      promptText: beat.prompt,
      ratio: "1920:1080",
      duration
    }).waitForTaskOutput();

    const url = task.output?.[0];
    if (!url) throw new Error("No video output");
    const file = path.join(outDir, `${beat.id}.mp4`);
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(file, buf);
    console.log("Saved", file);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
