import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { validateScript } from "./script_schema.js";
import { StatusReporter } from "./status.js";

// Simple baseline: if beats.json exists, keep it. Otherwise build a minimal one from fanfic.txt
async function main() {
  const beatsPath = path.resolve("data/beats.json");
  const status = new StatusReporter("planner", {
    escalationContact: "support@fanficvideo.local"
  });
  try {
    await fs.access(beatsPath);
    status.info("beats.json present, skipping autoplanning");
    return;
  } catch {}

  const text = await fs.readFile("data/fanfic.txt", "utf8");
  const line = text.split(/\n/).map(s => s.trim()).filter(Boolean)[0] ?? "She whispers, I will fix this.";

  const json = {
    title: "Auto Scene",
    characters: [
      {
        name: "Heroine",
        embedding_token: "@HeroineA",
        voice_id: "EXAVITQu4vr4xnSDxMaL",
        reference_images: ["data/refs/heroine_ref1.jpg", "data/refs/heroine_ref2.jpg"]
      }
    ],
    beats: [
      {
        id: "beat1",
        durationSec: 5,
        prompt: "A rainy neon alley at night with @HeroineA looking back. Cinematic, shallow depth of field.",
        camera: "medium shot"
      },
      {
        id: "beat2",
        durationSec: 4,
        prompt: "Close up of @HeroineA whispering, rain beads on hair.",
        dialogue: { speaker: "Heroine", text: line.replace(/\"/g, '"') },
        needLipSync: true,
        camera: "tight close up"
      },
      {
        id: "beat3",
        durationSec: 6,
        prompt: "Two-shot of @HeroineA leaning in for a kiss beneath the neon rain, soft rim light, subtle heart-shaped bokeh. Use kiss overlay from data/effects/kiss_overlay.png and sparkle particles from data/effects/kiss_sparkles.mov.",
        dialogue: { speaker: "Heroine", text: "Come closer..." },
        effect: "kiss",
        effectAssets: {
          overlay: "data/effects/kiss_overlay.png",
          particles: "data/effects/kiss_sparkles.mov"
        },
        camera: "two shot"
      }
    ]
  };

  validateScript(json);

  await fs.writeFile(beatsPath, JSON.stringify(json, null, 2));
  status.success("Wrote data/beats.json");
}

void main().catch(e => {
  if ("formatIssues" in e && typeof e.formatIssues === "function") {
    console.error((e as { formatIssues: () => string }).formatIssues());
  }
  console.error(e);
  process.exit(1);
});
