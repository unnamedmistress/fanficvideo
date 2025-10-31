import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import { readJSON } from "./util.js";

type Beat = { id: string; dialogue?: { speaker: string; text: string } };

type Script = {
  characters: { name: string; voice_id: string }[];
  beats: Beat[];
};

async function tts(text: string, voiceId: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.4, similarity_boost: 0.7 }
    })
  });
  if (!res.ok) throw new Error(`TTS failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const script = await readJSON<Script>("data/beats.json");
  const outDir = path.resolve("out/audio");
  await fs.mkdir(outDir, { recursive: true });

  const hero = script.characters[0];

  for (const beat of script.beats) {
    if (!beat.dialogue) continue;
    const buf = await tts(beat.dialogue.text, hero.voice_id);
    const out = path.join(outDir, `${beat.id}.mp3`);
    await fs.writeFile(out, buf);
    console.log("Saved", out);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
