# Fanfic AI Video Automation

This repo turns short fan‑fic text into an AI‑generated video. It parses text into beats, generates a clip per beat with Runway, makes voice with ElevenLabs, tightens lip sync with Wav2Lip on Replicate, stitches with FFmpeg, and uploads the result as a GitHub Actions artifact.

## Quick start
1. Create a private repo and copy this starter.
2. Add GitHub Actions secrets: `RUNWAY_API_KEY`, `ELEVENLABS_API_KEY`, `REPLICATE_API_TOKEN`.
3. Edit `data/fanfic.txt` or `data/beats.json`.
4. Run the `build_scene` workflow from the Actions tab or push an update to `data/beats.json`.
5. Download the artifact `final_scene`.

## Local run (optional)

```
npm i
cp .env.example .env # fill in keys
npm run plan
npm run render
npm run tts
npm run lipsync
npm run stitch
```

## Notes
- Keep clips short for best quality.
- For stronger character consistency, add StoryDiffusion or a small LoRA stage later.
- Do not use real actor voices or exact actor face likeness.
