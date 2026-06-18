import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["session/index.ts"],
  outDir: "dist/session",
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["p2p-lockstep-kit-network"],
  target: "es2020"
});
