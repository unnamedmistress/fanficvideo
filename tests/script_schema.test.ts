import { describe, expect, it } from "vitest";
import {
  describeSupportedDurations,
  mapToSupportedDuration,
  ScriptValidationError,
  validateScript
} from "../scripts/script_schema.js";

const validPlan = {
  title: "Test",
  characters: [
    {
      name: "Heroine",
      voice_id: "voice"
    }
  ],
  beats: [
    {
      id: "beat1",
      prompt: "Prompt",
      durationSec: 4
    }
  ]
};

describe("validateScript", () => {
  it("returns a normalized plan for valid data", () => {
    const plan = validateScript(validPlan);
    expect(plan.title).toBe("Test");
    expect(plan.characters[0].name).toBe("Heroine");
    expect(plan.beats[0].durationSec).toBe(4);
  });

  it("raises a helpful error when beats are missing", () => {
    expect(() => validateScript({ characters: validPlan.characters, beats: [] })).toThrowError(
      ScriptValidationError
    );
    try {
      validateScript({ characters: validPlan.characters, beats: [] });
    } catch (error) {
      if (error instanceof ScriptValidationError) {
        expect(error.formatIssues()).toContain("beats");
        expect(error.formatIssues()).toContain("Add at least one beat");
      }
    }
  });
});

describe("mapToSupportedDuration", () => {
  it("coerces small durations to 4", () => {
    expect(mapToSupportedDuration(2)).toBe(4);
  });

  it("caps durations at 8", () => {
    expect(mapToSupportedDuration(9)).toBe(8);
  });
});

describe("describeSupportedDurations", () => {
  it("lists supported values", () => {
    expect(describeSupportedDurations()).toContain("4s");
  });
});
