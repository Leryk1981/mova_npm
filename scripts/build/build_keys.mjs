import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const SCHEMAS = [
  "schemas/core/envelope.3.3.schema.json",
  "schemas/core/route.1.0.schema.json",
  "schemas/definitions/policies.schema.json",
];

function collect(obj, bag = new Set()) {
  if (Array.isArray(obj)) obj.forEach(x => collect(x, bag));
  else if (obj && typeof obj === "object") {
    if (obj.properties && typeof obj.properties === "object") {
      Object.keys(obj.properties).forEach(k => bag.add(k));
    }
    if (Array.isArray(obj.required)) obj.required.forEach(k => bag.add(k));
    // рекурсія
    Object.values(obj).forEach(v => collect(v, bag));
  }
  return bag;
}

const all = new Set();
for (const rel of SCHEMAS) {
  const schema = JSON.parse(readFileSync(resolve(root, rel), "utf8"));
  collect(schema, all);
}

console.log(JSON.stringify([...all].sort(), null, 2));