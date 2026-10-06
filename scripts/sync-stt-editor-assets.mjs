import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

// Only reads the AddOn. Generated assets are owned by the website.
export const editorSourcePaths = [
  'STT/libs/LibStub/LibStub.lua',
  'STT/libs/LibDeflate/LibDeflate.lua',
  'STT/core/init.lua',
  'STT/core/assets.lua',
  'STT/ui/font.lua',
  'STT/ui/style.lua',
  'STT/ui/ui_transition.lua',
  'STT/ui/smooth_scroll.lua',
  'STT/ui/widget_api.lua',
  'STT/ui/note_editor.lua',
  'STT/ui/ui_tooltip.lua',
  'STT/ui/cell_renderer.lua',
  'STT/core/profile.lua',
  'STT/core/version.lua',
  'STT/core/event_bus.lua',
  'STT/core/lite.lua',
  'STT_Tactics/bootstrap.lua',
  'STT_TacticsEditor/bootstrap.lua',
  'STT_Options/bootstrap.lua',
  'STT_Options/core/frame_skin.lua',
  'STT/core/runtime_settings.lua',
  'STT/core/analysis/pull_identity.lua',
  'STT/core/analysis/analysis_store.lua',
  'STT/core/analysis/analysis_migration.lua',
  'STT/core/analysis/cast_capture.lua',
  'STT/core/analysis/spell_catalog.lua',
  'STT/core/analysis/death_recap_service.lua',
  'STT/core/analysis/analysis_recorder.lua',
  'STT/core/analysis/analysis_sync.lua',
  'STT/core/boss_catalog.lua',
  'STT_Tactics/data/season_catalog_121.lua',
  'STT_Tactics/data/season_data_s1.lua',
  'STT_Tactics/data/season_phase_data_s2.lua',
  'STT_Tactics/defaults.lua',
  'STT_Tactics/core/tactical_ui_config.lua',
  'STT_TacticsEditor/data/season_plans_s1.lua',
  'STT_TacticsEditor/data/season_plans_s2.lua',
  'STT_Tactics/locale/zhCN.lua',
  'STT_TacticsEditor/locale/zhTW.lua',
  'STT_TacticsEditor/locale/enUS.lua',
  'STT_TacticsEditor/locale/zhCN.lua',
  'STT_Tactics/core/spec_aliases.lua',
  'STT_Tactics/core/condition_filter.lua',
  'STT_Tactics/core/stn_template.lua',
  'STT_Tactics/core/inline_modifier.lua',
  'STT_Tactics/core/timeline_syntax.lua',
  'STT_Tactics/core/semantic_plan_difficulty.lua',
  'STT_Tactics/core/plan_store.lua',
  'STT_Tactics/core/plan_resolver.lua',
  'STT_Tactics/core/plan_editor_session.lua',
  'STT_Tactics/core/plan_workbench.lua',
  'STT_Tactics/core/phase_timeline_layout.lua',
  'STT_Tactics/core/plan_diagnostics.lua',
  'STT_Tactics/core/spell_alias_index.lua',
  'STT_Tactics/core/root_schema_migration.lua',
  'STT_Tactics/core/note_sync.lua',
  'STT_Tactics/core/semantic_runtime.lua',
  'STT_Tactics/core/note_parser.lua',
  'STT_Tactics/core/export_import.lua',
  'STT_Tactics/core/phase_detector.lua',
  'STT_Tactics/core/dungeon_phase_adapter.lua',
  'STT_Tactics/core/timeline_runtime_cache.lua',
  'STT_Tactics/core/timeline_runner.lua',
  'STT_Tactics/core/runtime_test_controls.lua',
  'STT_TacticsEditor/core/simple_paste.lua',
  'STT_TacticsEditor/core/raid_spec_reader.lua',
  'STT_TacticsEditor/core/sync_raid.lua',
  'STT_TacticsEditor/core/timeline_text_edit.lua',
  'STT_TacticsEditor/core/keyboard_capture.lua',
  'STT_TacticsEditor/core/semantic_timeline.lua',
  'STT_TacticsEditor/core/semantic_template_reload.lua',
  'STT_TacticsEditor/core/boss_reference.lua',
  'STT_TacticsEditor/core/semantic_timeline_gui.lua',
  'STT_TacticsEditor/core/semantic_timeline_sync_button.lua',
  'STT_TacticsEditor/core/editor_find_replace.lua',
  'STT_TacticsEditor/core/semantic_timeline_gui_editor.lua',
  'STT_TacticsEditor/core/horizontal_timeline_data.lua',
  'STT_TacticsEditor/core/timeline_coords.lua',
  'STT_TacticsEditor/core/recent_skills.lua',
  'STT_TacticsEditor/data/class_spells.lua',
  'STT_TacticsEditor/data/spell_pinyin.lua',
  'STT_TacticsEditor/core/skill_picker_logic.lua',
  'STT_TacticsEditor/core/clipboard.lua',
  'STT_TacticsEditor/core/timeline_edit.lua',
  'STT_TacticsEditor/core/timeline_track_delete.lua',
  'STT_TacticsEditor/core/timeline_personnel_row_editor.lua',
  'STT_TacticsEditor/core/timeline_context_menu.lua',
  'STT_TacticsEditor/core/timeline_event_editor.lua',
  'STT_TacticsEditor/core/skill_drawer.lua',
  'STT_TacticsEditor/core/horizontal_timeline_shortcut_hint.lua',
  'STT_TacticsEditor/core/analysis_overlay.lua',
  'STT_TacticsEditor/core/analysis_panel.lua',
  'STT_TacticsEditor/core/gcd_tracker.lua',
  'STT_TacticsEditor/core/spell_alias_scanner.lua',
  'STT_TacticsEditor/core/spell_alias_suggestion_menu.lua',
  'STT_TacticsEditor/core/selection_box.lua',
  'STT_TacticsEditor/core/horizontal_timeline_gui.lua',
]
const mediaRoot = new URL('../../STT/STT/media/', import.meta.url)
const media = JSON.parse(readFileSync(new URL('../src/lib/stt-editor/media.json', import.meta.url), 'utf8'))
const editorMediaFiles = ['fonts/stt_dragonflight_zhcn.ttf', ...['icons/controls/', 'ui/'].flatMap(dir =>
  readdirSync(new URL(dir, mediaRoot)).filter(file => file.endsWith('.png')).map(file => dir + file)),
  ...readdirSync(new URL('visual_board/raidplan/classes/', mediaRoot)).filter(file => file.endsWith('.png')).map(file => `classes/${file}`),
  ...Object.keys(media.textures).map(id => `textures/${id}.png`)]
const atlasModule = `// Extracted from the local Retail ${media.build} UI atlas tables.\nexport const editorAtlases = ${JSON.stringify(media.atlases, null, 2)} as const\n`
export function readEditorAssets() {
  return editorSourcePaths.map(path => {
    const source = readFileSync(new URL(`../../STT/${path}`, import.meta.url), 'utf8')
    return { path, source, hash: createHash('sha256').update(source).digest('hex') }
  })
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const assets = readEditorAssets()
  const hash = createHash('sha256').update(assets.map(a => `${a.path}:${a.hash}`).join('\n')).digest('hex')
  const sourceRevision=execFileSync('git',['log','-1','--format=%H','--','STT'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8'}).trim()
  const output = '// Generated from read-only STT sources. Do not edit.\n'
    + `export const editorSourceRevision = ${JSON.stringify(sourceRevision)}\n`
    + `export const editorBundleHash = ${JSON.stringify(hash)}\n`
    + `export const editorAssets = ${JSON.stringify(assets)}\n`
  const target = new URL('../src/generated/sttEditorBundle.ts', import.meta.url)
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== output) throw new Error('Editor Lua is out of date; run npm run sync:stt-editor')
    if (readFileSync(new URL('../src/generated/sttEditorMedia.ts', import.meta.url), 'utf8') !== atlasModule) throw new Error('Editor atlas map is out of date; run npm run sync:stt-editor')
    for (const relative of editorMediaFiles) {
      const file = new URL(`../public/stt-editor/${relative}`, import.meta.url)
      if (!existsSync(file)) throw new Error(`Editor media missing: ${relative}`)
      if (relative.startsWith('textures/')) {
        const id = relative.slice('textures/'.length, -'.png'.length)
        const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
        if (hash !== media.textures[id]) throw new Error(`Editor texture changed: ${id}`)
      } else {
        const source = relative.startsWith('classes/')
          ? new URL(`../../STT/STT/media/visual_board/raidplan/classes/${relative.slice('classes/'.length)}`, import.meta.url)
          : new URL(`../../STT/STT/media/${relative}`, import.meta.url)
        if (!readFileSync(file).equals(readFileSync(source))) throw new Error(`Editor media changed: ${relative}`)
      }
    }
  } else {
    mkdirSync(new URL('../src/generated/', import.meta.url), { recursive: true })
    writeFileSync(target, output)
    writeFileSync(new URL('../src/generated/sttEditorMedia.ts', import.meta.url), atlasModule)
    for (const relative of editorMediaFiles) {
      const destination = new URL(`../public/stt-editor/${relative}`, import.meta.url)
      mkdirSync(new URL('.', destination), { recursive: true })
      if (relative.startsWith('textures/')) continue
      const source = relative.startsWith('classes/')
        ? new URL(`../../STT/STT/media/visual_board/raidplan/classes/${relative.slice('classes/'.length)}`, import.meta.url)
        : new URL(`../../STT/STT/media/${relative}`, import.meta.url)
      copyFileSync(source, destination)
    }
  }
  console.log(`STT editor: ${assets.length} unmodified sources, ${hash.slice(0, 12)}`)
}
