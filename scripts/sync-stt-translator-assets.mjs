import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PLANSHARE_ROOT = resolve(SCRIPT_DIR, '..')
const REPO_ROOT = resolve(PLANSHARE_ROOT, '..', '..')
const STT_ROOT = join(REPO_ROOT, 'ShengTangTools')
const OUT_FILE = join(PLANSHARE_ROOT, 'src/generated/sttTranslatorBundle.ts')

const ASSET_FILES = [
  'libs/LibStub/LibStub.lua',
  'libs/LibSerialize/LibSerialize.lua',
  'libs/LibDeflate/LibDeflate.lua',
  'data/phase_anchors_s14.lua',
  'core/condition_filter.lua',
  'core/stn_template.lua',
  'core/inline_modifier.lua',
  'core/timeline_syntax.lua',
  'core/tactic_translator.lua',
  'core/tactic_translator_nsrt.lua',
  'core/tactic_translator_tr.lua',
  'core/tactic_translator_mrt.lua',
  'core/tactic_exporter_tr.lua',
]

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function readAssets() {
  return ASSET_FILES.map((relPath) => {
    const fullPath = join(STT_ROOT, relPath)
    const source = readFileSync(fullPath, 'utf8')
    return {
      path: relPath,
      hash: sha256(source),
      source,
    }
  })
}

function buildOutput(assets) {
  const manifest = assets.map(({ path, hash, source }) => ({
    path,
    hash,
    bytes: Buffer.byteLength(source, 'utf8'),
  }))
  const bundleHash = sha256(manifest.map((item) => `${item.path}:${item.hash}`).join('\n'))

  return `/* eslint-disable */\n` +
    `// 本文件由 scripts/sync-stt-translator-assets.mjs 生成。\n` +
    `// 不要手写修改；STT 源码仍是翻译规则的唯一权威。\n\n` +
    `export interface SttTranslatorAsset {\n` +
    `  path: string\n` +
    `  hash: string\n` +
    `  source: string\n` +
    `}\n\n` +
    `export const sttTranslatorManifest = ${JSON.stringify(manifest, null, 2)} as const\n\n` +
    `export const sttTranslatorBundleHash = ${JSON.stringify(bundleHash)} as const\n\n` +
    `export const sttTranslatorAssets: SttTranslatorAsset[] = ${JSON.stringify(assets, null, 2)}\n`
}

const output = buildOutput(readAssets())
const checkOnly = process.argv.includes('--check')

if (checkOnly) {
  if (!existsSync(OUT_FILE)) {
    console.error(`STT translator bundle missing: ${OUT_FILE}`)
    process.exit(1)
  }
  const current = readFileSync(OUT_FILE, 'utf8')
  if (current !== output) {
    console.error('STT translator bundle is out of date. Run npm run sync:stt-translator.')
    process.exit(1)
  }
  console.log('STT translator bundle is up to date.')
} else {
  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, output)
  console.log(`Synced ${ASSET_FILES.length} STT translator assets -> ${OUT_FILE}`)
}
