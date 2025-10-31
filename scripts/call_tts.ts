import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import {
  hasVoiceInformation,
  loadScriptPlan,
  ScriptPlan,
  ScriptValidationError
} from "./script_schema.js";
import { StatusReporter, withRetry } from "./status.js";

async function tts(text: string, voiceId: string) {
  return withRetry(async () => {
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
  });
}

function resolveVoiceForSpeaker(plan: ScriptPlan, speaker?: string) {
  if (speaker) {
    const matching = plan.characters.find(c => c.name === speaker && c.voice_id);
    if (matching?.voice_id) {
      return matching.voice_id;
    }
  }
  const fallback = plan.characters.find(c => c.voice_id);
  return fallback?.voice_id;
}

async function main() {
  const status = new StatusReporter("tts", {
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
    status.emptyState("Beats", "Add dialogue beats to data/beats.json before calling TTS.");
    return;
  }

  if (!hasVoiceInformation(plan)) {
    status.error("No characters have a voice_id configured. Add one to data/beats.json to enable TTS.");
    return;
  }

  const outDir = path.resolve("out/audio");
  await fs.mkdir(outDir, { recursive: true });

  let generatedCount = 0;
  for (const beat of plan.beats) {
    if (!beat.dialogue) continue;
    const voiceId = resolveVoiceForSpeaker(plan, beat.dialogue.speaker);
    if (!voiceId) {
      status.warn(
        `Skipping ${beat.id} — could not find a voice_id for speaker ${beat.dialogue.speaker ?? "(unknown)"}.`
      );
      continue;
    }
    await status.step(`Generating audio for ${beat.id}`, async () => {
      const buf = await tts(beat.dialogue!.text, voiceId);
      const out = path.join(outDir, `${beat.id}.mp3`);
      await fs.writeFile(out, buf);
      generatedCount += 1;
    });
  }

  if (generatedCount === 0) {
    status.emptyState("Dialogue", "Add dialogue blocks to beats that need speech.");
  } else {
    status.success(`Generated ${generatedCount} audio file(s).`);
  }
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
