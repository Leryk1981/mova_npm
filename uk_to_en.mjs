import fs from "node:fs/promises";
import path from "node:path";
import lexicon from "../lexicon_uk.json" assert { type: "json" };

function mapKeys(obj, dict) {
  if (Array.isArray(obj)) return obj.map(x => mapKeys(x, dict));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const nk = dict[k] || k;
      out[nk] = mapKeys(v, dict);
    }
    return out;
  }
  return obj;
}

async function main() {
  const inFile = process.argv[2];
  if (!inFile) {
    console.error("Використання: node scripts/uk_to_en.mjs <вхідний.json> [вихідний.json]");
    process.exit(1);
  }
  const outFile = process.argv[3] || path.join(
    path.dirname(inFile),
    path.basename(inFile).replace(/(\.json)?$/, ".canonical.json")
  );

  const raw = await fs.readFile(inFile, "utf8");
  const data = JSON.parse(raw);
  const canonical = mapKeys(data, lexicon);
  await fs.writeFile(outFile, JSON.stringify(canonical, null, 2), "utf8");
  console.log("Готово →", outFile);
}
main().catch(e => { console.error(e); process.exit(1); });