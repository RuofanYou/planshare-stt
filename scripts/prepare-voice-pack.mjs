import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const planShareRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(planShareRoot, '..', 'ExtendProject', 'STT-VoicePack', 'final_dist', 'STT-微软tts补充语音包.exe')
const outputRoot = resolve(planShareRoot, 'public', 'downloads')
const expectedSize = 64_049_580
const partSize = 20_000_000

console.info(JSON.stringify({ chain: 'voice-pack-build', stage: 'started', expectedSize, partSize }))
const sourceStat = await stat(source)
if (sourceStat.size !== expectedSize) throw new Error(`voice pack size changed: ${sourceStat.size}`)

await mkdir(outputRoot, { recursive: true })
const partCount = Math.ceil(expectedSize / partSize)
for (let index = 0; index < partCount; index += 1) {
  const suffix = String.fromCharCode(97 + index)
  const target = resolve(outputRoot, `stt-microsoft-tts-supplement.part-aa${suffix}`)
  const start = index * partSize
  const end = Math.min(expectedSize, start + partSize) - 1
  await pipeline(createReadStream(source, { start, end }), createWriteStream(target))
}

console.info(JSON.stringify({
  chain: 'voice-pack-build',
  stage: 'completed',
  sourceBytes: sourceStat.size,
  partCount,
}))
