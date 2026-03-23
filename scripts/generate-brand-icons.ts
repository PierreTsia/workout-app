/**
 * Rasterizes public/pwa-192x192.svg and og-image.svg into PNGs for favicon, PWA, and OG.
 * Run: npx tsx scripts/generate-brand-icons.ts
 */
import sharp from "sharp"
import { readFileSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const pub = path.join(root, "public")

const iconSvg = readFileSync(path.join(pub, "pwa-192x192.svg"))

async function main() {
  const sizes: [string, number][] = [
    ["favicon-32x32.png", 32],
    ["pwa-192x192.png", 192],
    ["pwa-512x512.png", 512],
    ["apple-touch-icon-180x180.png", 180],
  ]

  for (const [name, size] of sizes) {
    await sharp(iconSvg).resize(size, size).png().toFile(path.join(pub, name))
  }

  // Maskable: smaller mark + padding so adaptive icons don't clip
  const inner = 420
  const pad = (512 - inner) / 2
  await sharp(iconSvg)
    .resize(inner, inner)
    .extend({
      top: Math.floor(pad),
      bottom: Math.ceil(pad),
      left: Math.floor(pad),
      right: Math.ceil(pad),
      background: { r: 15, g: 15, b: 19, alpha: 1 },
    })
    .png()
    .toFile(path.join(pub, "pwa-maskable-512x512.png"))

  const ogSvgPath = path.join(pub, "og-image.svg")
  const ogSvg = readFileSync(ogSvgPath)
  await sharp(ogSvg).png().toFile(path.join(pub, "og-image.png"))

  console.log("Wrote PNGs to public/")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
