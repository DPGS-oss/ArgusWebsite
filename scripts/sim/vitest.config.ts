import { defineConfig } from "vitest/config";
import path from "node:path";

// Simulation runs against the LOCAL Firebase emulators only; never part of `npm test`.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "../..") } },
  test: {
    include: ["scripts/sim/**/*.sim.ts"],
    root: path.resolve(__dirname, "../.."),
    testTimeout: 150 * 60 * 1000,
    hookTimeout: 5 * 60 * 1000,
    environment: "node",
  },
});
