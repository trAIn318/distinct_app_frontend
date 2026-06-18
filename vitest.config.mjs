import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // El proyecto escribe JSX dentro de archivos .js (estilo Next.js). esbuild trata
  // .js como JS plano por defecto; forzamos el loader jsx para los .js de src/.
  esbuild: { loader: "jsx", include: /src\/.*\.js$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { ".js": "jsx" } } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"],
    // Evita escanear worktrees aislados (.worktrees/) — duplicarían los tests.
    exclude: [...configDefaults.exclude, "**/.worktrees/**"],
  },
});
