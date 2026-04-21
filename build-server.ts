import * as esbuild from "esbuild";

esbuild.build({
  entryPoints: ["server.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: "dist/server.cjs",
  external: [
    "express",
    "vite",
    "dotenv",
    "yahoo-finance2",
    "@google/genai"
  ]
}).catch(() => process.exit(1));
