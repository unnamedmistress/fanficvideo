import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";

export async function readJSON<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(p, "utf8"));
}

export async function saveURL(url: string, outPath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buf);
  return outPath;
}

export function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function envOr(name: string, defaultValue: string) {
  return process.env[name] ?? defaultValue;
}

export function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
