import { defineConfig } from "vite";

export default defineConfig({
  // The bundle is served from views/3d/integrated/, so the terrain worker's URL
  // must resolve next to it rather than from the site root.
  base: "./",
  publicDir: "../../assets/3d/scenarios",
  build: {
    emptyOutDir: true,
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: () => "hex-three.js",
    },
    outDir: "dist",
    rollupOptions: {
      output: {
        assetFileNames: "[name][extname]",
      },
    },
  },
});
