// Generates the app favicon set: a white dimpled golf ball on the brand
// orange (#f97316) background. Produces a scalable SVG master plus rasterized
// PNG/ICO assets used by browsers and PWA installs.
//
// Usage: node scripts/generate-favicons.mjs
//
// Outputs (into ./public):
//   favicon.svg          vector master (referenced as the modern favicon)
//   favicon.ico          16/32/48 multi-size icon (PNG-embedded ICO)
//   apple-touch-icon.png 180x180 (iOS home screen)
//   logo192.png          192x192 (PWA manifest)
//   logo512.png          512x512 (PWA manifest)

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const ORANGE = '#f97316'
const SIZE = 512
const CENTER_X = 256
const CENTER_Y = 248
const BALL_RADIUS = 158

/** Build a hex-packed grid of dimples clipped to the golf ball. */
function dimples() {
  const circles = []
  const spacing = 30
  const r = 9
  for (let row = 0; row * (spacing * 0.86) < SIZE; row += 1) {
    const cy = 40 + row * (spacing * 0.86)
    const offset = row % 2 === 0 ? 0 : spacing / 2
    for (let col = 0; col * spacing < SIZE; col += 1) {
      const cx = 30 + offset + col * spacing
      // Keep dimples inside the ball (clip-path also enforces this, but
      // trimming keeps the SVG smaller and avoids edge artifacts).
      const dist = Math.hypot(cx - CENTER_X, cy - CENTER_Y)
      if (dist > BALL_RADIUS - 14) continue
      // Fade dimples slightly toward the lit (top-left) side for depth.
      const opacity = 0.32 + 0.18 * (dist / BALL_RADIUS)
      circles.push(
        `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="#aeb6bf" opacity="${opacity.toFixed(2)}"/>`,
      )
    }
  }
  return circles.join('')
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Golf ball on an orange background">
  <defs>
    <radialGradient id="ball" cx="38%" cy="30%" r="78%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="62%" stop-color="#f1f3f5"/>
      <stop offset="100%" stop-color="#cfd4da"/>
    </radialGradient>
    <radialGradient id="bg" cx="32%" cy="26%" r="92%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="58%" stop-color="${ORANGE}"/>
      <stop offset="100%" stop-color="#ea670c"/>
    </radialGradient>
    <clipPath id="ballClip"><circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${BALL_RADIUS}"/></clipPath>
  </defs>

  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>

  <!-- contact shadow under the ball -->
  <ellipse cx="${CENTER_X}" cy="438" rx="150" ry="30" fill="#7a3206" opacity="0.30"/>

  <!-- ball body -->
  <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${BALL_RADIUS}" fill="url(#ball)"/>

  <!-- dimples -->
  <g clip-path="url(#ballClip)">${dimples()}</g>

  <!-- soft shading on the lower-right for volume -->
  <circle clip-path="url(#ballClip)" cx="330" cy="330" r="150" fill="#9aa1a9" opacity="0.16"/>
  <!-- top-left specular highlight -->
  <ellipse clip-path="url(#ballClip)" cx="198" cy="186" rx="58" ry="42" fill="#ffffff" opacity="0.55"/>

  <!-- crisp rim -->
  <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${BALL_RADIUS}" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="2"/>
</svg>
`

/** Minimal PNG-embedded ICO encoder. */
function buildIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)

  const entries = []
  let offset = 6 + images.length * 16
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width (0 => 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // palette count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(data.length, 8) // image data size
    entry.writeUInt32LE(offset, 12) // data offset
    offset += data.length
    entries.push(entry)
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

async function png(size) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
}

async function main() {
  await mkdir(publicDir, { recursive: true })
  await writeFile(join(publicDir, 'favicon.svg'), svg, 'utf8')

  const [p16, p32, p48, p180, p192, p512] = await Promise.all(
    [16, 32, 48, 180, 192, 512].map(png),
  )

  await writeFile(
    join(publicDir, 'favicon.ico'),
    buildIco([
      { size: 16, data: p16 },
      { size: 32, data: p32 },
      { size: 48, data: p48 },
    ]),
  )
  await writeFile(join(publicDir, 'apple-touch-icon.png'), p180)
  await writeFile(join(publicDir, 'logo192.png'), p192)
  await writeFile(join(publicDir, 'logo512.png'), p512)

  console.log('Generated favicon.svg, favicon.ico, apple-touch-icon.png, logo192.png, logo512.png')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
