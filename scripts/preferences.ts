import fs from "fs/promises";
import path from "path";

export type RunwayModelPreference = "veo3.1" | "veo3.1_fast" | "veo3";
export type AspectRatioPreference = "1280:720" | "720:1280" | "1080:1920" | "1920:1080";

export interface UserPreferences {
  defaultModel: RunwayModelPreference;
  lastRatio: AspectRatioPreference;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultModel: "veo3.1_fast",
  lastRatio: "1920:1080"
};

const PREFERENCES_PATH = path.resolve("data/user-preferences.json");

function isModelPreference(value: unknown): value is RunwayModelPreference {
  return value === "veo3.1" || value === "veo3.1_fast" || value === "veo3";
}

function isRatioPreference(value: unknown): value is AspectRatioPreference {
  return value === "1280:720" || value === "720:1280" || value === "1080:1920" || value === "1920:1080";
}

export async function loadPreferences(): Promise<UserPreferences> {
  try {
    const raw = await fs.readFile(PREFERENCES_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      defaultModel: isModelPreference(parsed.defaultModel) ? parsed.defaultModel : DEFAULT_PREFERENCES.defaultModel,
      lastRatio: isRatioPreference(parsed.lastRatio) ? parsed.lastRatio : DEFAULT_PREFERENCES.lastRatio
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_PREFERENCES;
    }
    throw error;
  }
}

export async function savePreferences(preferences: UserPreferences): Promise<void> {
  const merged: UserPreferences = {
    defaultModel: isModelPreference(preferences.defaultModel)
      ? preferences.defaultModel
      : DEFAULT_PREFERENCES.defaultModel,
    lastRatio: isRatioPreference(preferences.lastRatio) ? preferences.lastRatio : DEFAULT_PREFERENCES.lastRatio
  };
  await fs.mkdir(path.dirname(PREFERENCES_PATH), { recursive: true });
  await fs.writeFile(PREFERENCES_PATH, JSON.stringify(merged, null, 2));
}
