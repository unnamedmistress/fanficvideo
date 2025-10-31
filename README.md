# Fanfic AI Video Automation

This repo turns short fan‑fic text into an AI‑generated video. It parses text into beats, generates a clip per beat with Runway, makes voice with ElevenLabs, tightens lip sync with Wav2Lip on Replicate, stitches with FFmpeg, and uploads the result as a GitHub Actions artifact.

## Quick start
1. Create a private repo and copy this starter.
2. **Set up GitHub Actions secrets** (see below).
3. **Upload character reference images** to `data/refs/` (e.g., `heroine_ref1.jpg`, `heroine_ref2.jpg`).
4. Edit `data/fanfic.txt` or `data/beats.json` with your fanfic content.
5. Run the `build_scene` workflow from the Actions tab or push an update to `data/beats.json`.
6. Download the artifact `final_scene` from the completed workflow run.

## Setting Up GitHub Actions Secrets
Go to your repo → **Settings** → **Secrets and variables** → **Actions**.

Add the following secrets with your actual API keys:
- `RUNWAY_API_KEY` - Get from [Runway ML](https://runwayml.com/)
- `ELEVENLABS_API_KEY` - Get from [ElevenLabs](https://elevenlabs.io/)
- `REPLICATE_API_TOKEN` - Get from [Replicate](https://replicate.com/)

Optional secrets (if using specific features):
- `HUGGINGFACE_API_TOKEN` - For Hugging Face models
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` - If uploading to S3

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

## Character Reference Images
Upload character reference images to the `data/refs/` directory:
- Example: `data/refs/heroine_ref1.jpg`, `data/refs/heroine_ref2.jpg`
- These images help maintain character consistency across scenes
- Update the paths in `data/beats.json` to match your uploaded images

## Notes
- Keep clips short for best quality.
- For stronger character consistency, add StoryDiffusion or a small LoRA stage later.
- **Do not use real actor voices or exact actor face likeness.**
- **Never commit your real API keys or `.env` file** - use GitHub secrets or local `.env` only.
