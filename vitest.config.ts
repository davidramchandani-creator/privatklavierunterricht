import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest-Konfiguration.
 *
 * Wichtig ist vor allem der Alias `@/` → `src/`, damit Testdateien dieselben
 * Importpfade verwenden können wie der Anwendungscode (Next.js löst den Alias
 * über tsconfig auf, Vitest nicht automatisch).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
