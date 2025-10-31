import "dotenv/config";
import fs from "fs/promises";
import path from "path";

// Simple baseline: if beats.json exists, keep it. Otherwise build a minimal one from fanfic.txt
async function main() {
  const beatsPath = path.resolve("data/beats.json");
  try {
    await fs.access(beatsPath);
    console.log("beats.json present, skipping autoplanning");
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
      }
    ]
  };

  await fs.writeFile(beatsPath, JSON.stringify(json, null, 2));
  console.log("Wrote data/beats.json");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
