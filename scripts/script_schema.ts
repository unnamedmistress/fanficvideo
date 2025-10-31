import fs from "fs/promises";
import path from "path";

export interface Dialogue {
  speaker: string;
  text: string;
}

export interface Beat {
  id: string;
  prompt: string;
  durationSec: number;
  dialogue?: Dialogue;
  needLipSync?: boolean;
  effect?: string;
  effectAssets?: Record<string, string>;
  camera?: string;
}

export interface Character {
  name: string;
  embedding_token?: string;
  voice_id?: string;
  reference_images?: string[];
}

export interface ScriptPlan {
  title?: string;
  characters: Character[];
  beats: Beat[];
}

export interface ValidationIssue {
  path: string;
  message: string;
  suggestion?: string;
}

export class ScriptValidationError extends Error {
  issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "ScriptValidationError";
    this.issues = issues;
  }

  formatIssues(): string {
    return this.issues
      .map(issue => {
        const hint = issue.suggestion ? `\n   ↳ ${issue.suggestion}` : "";
        return ` • ${issue.path}: ${issue.message}${hint}`;
      })
      .join("\n");
  }
}

const REQUIRED_BEAT_FIELDS: Array<keyof Beat> = ["id", "prompt", "durationSec"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ensureDialogue(dialogue: unknown, beatIndex: number, issues: ValidationIssue[]) {
  if (dialogue === undefined) return;
  if (!isRecord(dialogue)) {
    issues.push({
      path: `beats[${beatIndex}].dialogue`,
      message: "Expected a dialogue object with speaker and text",
      suggestion: "Use { \"speaker\": \"Name\", \"text\": \"Line\" }"
    });
    return;
  }

  if (typeof dialogue.speaker !== "string" || dialogue.speaker.trim() === "") {
    issues.push({
      path: `beats[${beatIndex}].dialogue.speaker`,
      message: "Speaker is required when dialogue is provided",
      suggestion: "Match the speaker to a character name so TTS can pick the right voice"
    });
  }

  if (typeof dialogue.text !== "string" || dialogue.text.trim() === "") {
    issues.push({
      path: `beats[${beatIndex}].dialogue.text`,
      message: "Dialogue text cannot be empty",
      suggestion: "Add the line that should be spoken or remove the dialogue block"
    });
  }
}

export function validateScript(raw: unknown, scriptPath = "data/beats.json"): ScriptPlan {
  const issues: ValidationIssue[] = [];

  if (!isRecord(raw)) {
    throw new ScriptValidationError(
      `Expected ${scriptPath} to contain a JSON object`,
      [
        {
          path: scriptPath,
          message: "The file must contain an object with beats and characters",
          suggestion: "Check for trailing commas or run npm run plan to regenerate a starter plan"
        }
      ]
    );
  }

  const beatsRaw = raw.beats;
  if (!Array.isArray(beatsRaw) || beatsRaw.length === 0) {
    issues.push({
      path: "beats",
      message: "No beats defined in the plan",
      suggestion: "Add at least one beat or run npm run plan to auto-create a starter scene"
    });
  }

  const charactersRaw = raw.characters;
  if (!Array.isArray(charactersRaw) || charactersRaw.length === 0) {
    issues.push({
      path: "characters",
      message: "The plan must declare at least one character",
      suggestion: "List the speaking characters with their voice_id so TTS can run"
    });
  }

  const beats: Beat[] = [];
  if (Array.isArray(beatsRaw)) {
    beatsRaw.forEach((beatRaw, index) => {
      if (!isRecord(beatRaw)) {
        issues.push({
          path: `beats[${index}]`,
          message: "Each beat must be an object",
          suggestion: "Ensure the beat is defined using curly braces with key/value pairs"
        });
        return;
      }

      REQUIRED_BEAT_FIELDS.forEach(field => {
        const value = beatRaw[field];
        if (typeof value === "undefined" || value === null || value === "") {
          issues.push({
            path: `beats[${index}].${field}`,
            message: `${field} is required`,
            suggestion: `Provide a ${field} for this beat so it can be rendered`
          });
        }
      });

      const duration = beatRaw.durationSec;
      if (typeof duration === "number") {
        if (!Number.isFinite(duration) || duration <= 0) {
          issues.push({
            path: `beats[${index}].durationSec`,
            message: "durationSec must be a positive number",
            suggestion: "Set durationSec to the intended clip length in seconds"
          });
        }
      }

      ensureDialogue(beatRaw.dialogue, index, issues);

      beats.push({
        id: String(beatRaw.id ?? ""),
        prompt: String(beatRaw.prompt ?? ""),
        durationSec: typeof beatRaw.durationSec === "number" ? beatRaw.durationSec : 0,
        dialogue: isRecord(beatRaw.dialogue)
          ? {
              speaker: typeof beatRaw.dialogue.speaker === "string" ? beatRaw.dialogue.speaker : "",
              text: typeof beatRaw.dialogue.text === "string" ? beatRaw.dialogue.text : ""
            }
          : undefined,
        needLipSync: Boolean(beatRaw.needLipSync),
        effect: typeof beatRaw.effect === "string" ? beatRaw.effect : undefined,
        effectAssets: isRecord(beatRaw.effectAssets)
          ? (Object.fromEntries(
              Object.entries(beatRaw.effectAssets).filter(([, v]) => typeof v === "string" && v.trim() !== "")
            ) as Record<string, string>)
          : undefined,
        camera: typeof beatRaw.camera === "string" ? beatRaw.camera : undefined
      });
    });
  }

  const characters: Character[] = Array.isArray(charactersRaw)
    ? charactersRaw
        .filter(isRecord)
        .map(character => ({
          name: typeof character.name === "string" ? character.name : "",
          embedding_token:
            typeof character.embedding_token === "string" ? character.embedding_token : undefined,
          voice_id: typeof character.voice_id === "string" ? character.voice_id : undefined,
          reference_images: Array.isArray(character.reference_images)
            ? character.reference_images.filter((img): img is string => typeof img === "string" && img.trim() !== "")
            : undefined
        }))
    : [];

  if (issues.length > 0) {
    throw new ScriptValidationError(`Unable to use ${scriptPath}. See the issues below.`, issues);
  }

  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    characters,
    beats
  };
}

export async function loadScriptPlan(scriptPath = "data/beats.json"): Promise<ScriptPlan> {
  const absolutePath = path.resolve(scriptPath);
  let fileContents: string;
  try {
    fileContents = await fs.readFile(absolutePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ScriptValidationError(`Missing required script plan at ${scriptPath}`, [
        {
          path: scriptPath,
          message: "The beats.json file could not be found",
          suggestion: "Run npm run plan to generate a starter plan or provide your own data/beats.json"
        }
      ]);
    }
    throw error;
  }

  if (fileContents.trim() === "") {
    throw new ScriptValidationError(`The file ${scriptPath} is empty`, [
      {
        path: scriptPath,
        message: "Empty files cannot be parsed",
        suggestion: "Paste your scene beats or regenerate the file"
      }
    ]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContents);
  } catch (error) {
    throw new ScriptValidationError(`Could not parse ${scriptPath}`, [
      {
        path: scriptPath,
        message: "Invalid JSON encountered",
        suggestion: (error as Error).message
      }
    ]);
  }

  return validateScript(parsed, scriptPath);
}

export type SupportedDuration = 4 | 6 | 8;
const SUPPORTED_DURATIONS: SupportedDuration[] = [4, 6, 8];

export function mapToSupportedDuration(seconds: number): SupportedDuration {
  const sorted = [...SUPPORTED_DURATIONS].sort((a, b) => a - b);
  for (const duration of sorted) {
    if (seconds <= duration) {
      return duration;
    }
  }
  return sorted[sorted.length - 1];
}

export function describeSupportedDurations(): string {
  return SUPPORTED_DURATIONS.map(d => `${d}s`).join(", ");
}

export function hasVoiceInformation(plan: ScriptPlan): boolean {
  return plan.characters.some(character => Boolean(character.voice_id));
}
