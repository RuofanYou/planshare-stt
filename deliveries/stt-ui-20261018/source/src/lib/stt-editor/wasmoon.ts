import type {EditorRuntimeHandle} from './runtime'
import type {displayText} from './display-text'

interface WasmoonInputs {
  assets: readonly {path: string; source: string}[]
  prelude: string
  bridge: string
  atlases: unknown
  hash: string
  displayText: typeof displayText
  encodeLuaString: (value: string) => Uint8Array
  decodeLuaString: (value: Uint8Array) => string
}

interface WasmoonAdapterModule {
  WasmoonEditorRuntime: {
    create(options: WasmoonInputs & {wasmUri: string}): Promise<EditorRuntimeHandle>
  }
}

// Pinned official UMD/WASM and the reviewed adapter are served from public/.
// They are not rewritten by Vite; no CDN, npm dependency, or script injection.
// The content-versioned path prevents mixing old and new adapter releases.
export async function createWasmoonRuntime(inputs: WasmoonInputs): Promise<EditorRuntimeHandle> {
  const runtimeBase = String(import.meta.env.VITE_STT_RUNTIME_BASE_URL || import.meta.env.BASE_URL).replace(/\/?$/, "/")
  const root = new URL(`${runtimeBase}stt-editor/runtime/wasmoon-1.16.0-a02489855cc3/`, document.baseURI)
  if (root.origin !== window.location.origin) throw new Error('STT runtime assets must be same-origin')
  const scriptUri = new URL('wasmoon-1.16.0.js', root).href
  const adapterUri = new URL('wasmoon-editor-adapter.mjs', root).href
  await import(/* @vite-ignore */ scriptUri)
  const {WasmoonEditorRuntime} = await import(/* @vite-ignore */ adapterUri) as WasmoonAdapterModule
  return WasmoonEditorRuntime.create({
    ...inputs,
    wasmUri: new URL('wasmoon-glue.wasm', root).href,
  })
}
