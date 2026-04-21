import * as esbuild from "esbuild";

esbuild.build({
  entryPoints: ["server.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "dist/server.js",
  external: [
    "express",
    "vite",
    "dotenv",
    "yahoo-finance2",
    "@google/genai"
  ]
}).catch(() => process.exit(1));
