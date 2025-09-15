import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const canonicalKeys = JSON.parse(readFileSync(resolve(root, "build/canonical_keys.json"), "utf8"));
const lexicon = JSON.parse(readFileSync(resolve(root, "lexicon_uk.json"), "utf8"));

const lexiconValues = new Set(Object.values(lexicon));
const missing = canonicalKeys.filter(k => !lexiconValues.has(k));

if (missing.length) {
  console.error("❌ Лексикон не покриває наступні канонічні ключі:\n- " + missing.join("\n- "));
  process.exit(1);
}
console.log("✅ Лексикон покриває всі канонічні ключі.");