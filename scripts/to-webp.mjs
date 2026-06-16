// Convierte los PNG pesados de public/img a .webp (calidad 82) junto al original.
// No borra los PNG: permite revertir referencias si hiciera falta.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const DIR = "public/img";
const LIMIT_BYTES = 300 * 1024; // solo los > 300 KB

async function run() {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".png"));
  for (const f of files) {
    const src = join(DIR, f);
    if (statSync(src).size < LIMIT_BYTES) continue;
    const out = src.replace(/\.png$/, ".webp");
    await sharp(src).webp({ quality: 82 }).toFile(out);
    console.log(`✓ ${f} → ${f.replace(/\.png$/, ".webp")}`);
  }
}
run();
