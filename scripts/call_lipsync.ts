import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import { readJSON } from "./util.js";

type Beat = { id: string; needLipSync?: boolean; effect?: string };

type Script = { beats: Beat[] };

type ReplicateResponse = {
  id: string;
  status: string;
  output?: string;
};

async function replicateWav2Lip(video: Buffer, audio: Buffer) {
  const input = {
    face: `data:video/mp4;base64,${video.toString("base64")}`,
    audio: `data:audio/mpeg;base64,${audio.toString("base64")}`,
    pads: 0,
    nosmooth: false
  };

  const job = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      version: "f3bd0cb5538aa0c47a58f3408b233d6cea61bc939f1b256a0e065b4bd11fdd20",
      input
    })
  }).then(r => r.json()) as ReplicateResponse;

  let poll: ReplicateResponse = job;
  while (!["succeeded", "failed", "canceled"].includes(poll.status)) {
    await new Promise(r => setTimeout(r, 2000));
    poll = await fetch(`https://api.replicate.com/v1/predictions/${job.id}`, {
      headers: { "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}` }
    }).then(r => r.json()) as ReplicateResponse;
  }
  if (poll.status !== "succeeded") throw new Error("Wav2Lip failed");
  if (!poll.output) throw new Error("No output URL in response");
  const outBuf = await fetch(poll.output).then(r => r.arrayBuffer());
  return Buffer.from(outBuf);
}

async function main() {
  const script = await readJSON<Script>("data/beats.json");
  const inDir = path.resolve("out");
  const audioDir = path.resolve("out/audio");
  const outDir = path.resolve("out/synced");
  await fs.mkdir(outDir, { recursive: true });

  for (const beat of script.beats) {
    if (!beat.needLipSync) continue;
    const v = await fs.readFile(path.join(inDir, `${beat.id}.mp4`));
    const a = await fs.readFile(path.join(audioDir, `${beat.id}.mp3`));
    const synced = await replicateWav2Lip(v, a);
    const out = path.join(outDir, `${beat.id}.mp4`);
    await fs.writeFile(out, synced);
    console.log("Saved", out);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
