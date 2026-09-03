import { defineConfig, loadEnv } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Plugins
import { visualizer } from "rollup-plugin-visualizer";
import { VitePluginRadar } from 'vite-plugin-radar'
import react from '@vitejs/plugin-react';


function getSnapshotInfo(publicDir: string) {
    try {
        const manifest = JSON.parse(readFileSync(resolve(publicDir, "snapshot-manifest.json"), "utf8"));
        if (manifest.schema_version !== 2 || !manifest.build_id || !manifest.release_id || !manifest.source_tree_hash || !manifest.published_at) {
            throw new Error("deployment manifest fields are incomplete");
        }
        return {
            buildId: manifest.build_id,
            releaseId: manifest.release_id,
            sourceTreeHash: manifest.source_tree_hash,
            publishedAt: manifest.published_at,
        };
    } catch (error) {
        console.warn('[BuildInfo] snapshot manifest unavailable', {
            reason: error instanceof Error ? error.message : String(error),
        });
        return {
            buildId: "local-unprepared",
            releaseId: "local-unprepared",
            sourceTreeHash: "local-unprepared",
            publishedAt: "local-unprepared",
        };
    }
}


// Config
export default defineConfig(({ mode }) => {

    const env = loadEnv(mode, process.cwd());
    const publicDir = resolve(process.env.RAIDGLASS_PUBLIC_DIR || "public");
    const outDir = resolve(process.env.RAIDGLASS_BUILD_DIR || "build");
    const snapshot = getSnapshotInfo(publicDir);

    //**************************************************************************
    return {
        base: "/log/",

        build: {
            target: "es2015",
            outDir,
            emptyOutDir: true,

            rollupOptions: {
                treeshake: true,
                output: {

                    manualChunks(id) {

                        if (id.includes('/node_modules/konva')) {
                            return "vendor__konva";
                        }
                        if (id.includes('/node_modules/react')) {
                            return "vendor__react"
                        }

                        return null
                    }
                }

                //...
            }

        },

        publicDir,

        esbuild: {
            drop: mode == "production" ? ['console', 'debugger'] : [],
        },

        plugins: [
            react(),

            // Add Google Analytics Tracking
            // disabled by default in development mode
            // https://github.com/stafyniaksacha/vite-plugin-radar?tab=readme-ov-file#options
            VitePluginRadar({
                analytics: {
                    id: env.VITE_GOOGLE_ANALYTICS_ID,
                },
            }),

            // rollup-plugin-visualizer
            // needs to be the last plugin in the list
            visualizer({
                open: false,
            }),

        ], // end: plugins

        define: {
            "RAIDGLASS_BUILD_ID": JSON.stringify(snapshot.buildId),
            "RAIDGLASS_RELEASE_ID": JSON.stringify(snapshot.releaseId),
            "RAIDGLASS_SOURCE_TREE_HASH": JSON.stringify(snapshot.sourceTreeHash),
            "RAIDGLASS_PUBLISHED_AT": JSON.stringify(snapshot.publishedAt),
        },

        server: {
            port: 9001,
        }
    }
});
