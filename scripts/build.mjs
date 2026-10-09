#!/usr/bin/env node
/**
 * Scans words/ and writes data/manifest.json for the static engine.
 * Run after adding or editing day folders:  node scripts/build.mjs
 *
 * You only edit files under words/ — never hand-edit data/manifest.json.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORDS_DIR = path.join(ROOT, "words");
const OUT_DIR = path.join(ROOT, "data");
const OUT_FILE = path.join(OUT_DIR, "manifest.json");

const AUDIO_EXT = new Set([
  ".wav",
  ".mp3",
  ".flac",
  ".ogg",
  ".m4a",
  ".aac",
  ".webm",
  ".opus",
]);
const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".heic",
  ".heif",
  ".avif",
]);
const SPECIAL_TXT = new Set(["word.txt", "phonetic.txt", "definition.txt", "connotation.txt"]);

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
}

function toWebPath(...parts) {
  return parts.join("/").replace(/\\/g, "/");
}

function isDateDir(name) {
  return /^\d{8}$/.test(name);
}

function parseExample(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  return {
    es: lines[0] ?? "",
    en: lines[1] ?? "",
  };
}

function loadDefinition(defDir, relBase) {
  const files = fs.readdirSync(defDir, { withFileTypes: true });
  const definition = { definition: "", connotation: "", images: [], examples: [] };

  for (const entry of files) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const full = path.join(defDir, name);
    const ext = path.extname(name).toLowerCase();
    const lower = name.toLowerCase();

    if (lower === "definition.txt") {
      definition.definition = readText(full);
    } else if (lower === "connotation.txt") {
      definition.connotation = readText(full);
    } else if (IMAGE_EXT.has(ext)) {
      definition.images.push(toWebPath(relBase, name));
    } else if (ext === ".txt" && !SPECIAL_TXT.has(lower)) {
      const ex = parseExample(readText(full));
      if (ex) definition.examples.push({ ...ex, source: name });
    }
  }

  definition.images.sort();
  definition.examples.sort((a, b) => a.source.localeCompare(b.source));
  return definition;
}

function loadDay(dayDir, dateId) {
  const files = fs.readdirSync(dayDir, { withFileTypes: true });
  const entry = {
    date: dateId,
    word: "",
    phonetic: "",
    audio: [],
    definitions: [],
  };

  const defDirs = [];

  for (const item of files) {
    const full = path.join(dayDir, item.name);
    if (item.isDirectory() && /^\d+$/.test(item.name)) {
      defDirs.push(item.name);
      continue;
    }
    if (!item.isFile()) continue;

    const lower = item.name.toLowerCase();
    const ext = path.extname(item.name).toLowerCase();

    if (lower === "word.txt") {
      entry.word = readText(full);
    } else if (lower === "phonetic.txt") {
      entry.phonetic = readText(full);
    } else if (AUDIO_EXT.has(ext)) {
      entry.audio.push({
        src: toWebPath("words", dateId, item.name),
        label: path.basename(item.name, ext).replace(/[-_]/g, " "),
      });
    }
  }

  entry.audio.sort((a, b) => a.label.localeCompare(b.label));
  defDirs.sort((a, b) => Number(a) - Number(b));

  for (const defName of defDirs) {
    entry.definitions.push(
      loadDefinition(path.join(dayDir, defName), toWebPath("words", dateId, defName))
    );
  }

  if (!entry.word) {
    console.warn(`Skipping ${dateId}: missing word.txt`);
    return null;
  }
  return entry;
}

function main() {
  if (!fs.existsSync(WORDS_DIR)) {
    console.error("words/ directory not found");
    process.exit(1);
  }

  const dates = fs
    .readdirSync(WORDS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && isDateDir(d.name))
    .map((d) => d.name)
    .sort();

  const entries = {};
  for (const dateId of dates) {
    const loaded = loadDay(path.join(WORDS_DIR, dateId), dateId);
    if (loaded) entries[dateId] = loaded;
  }

  const availableDates = Object.keys(entries).sort();
  const manifest = {
    generatedAt: new Date().toISOString(),
    availableDates,
    entries,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `Wrote ${OUT_FILE} with ${availableDates.length} day(s): ${availableDates.join(", ") || "(none)"}`
  );
}

main();
