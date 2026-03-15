import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/register.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020"
});
