import { defineConfig } from "vite";

export default defineConfig({
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
