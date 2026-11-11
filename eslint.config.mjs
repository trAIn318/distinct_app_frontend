import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // `no-undef` no viene activo en core-web-vitals. Sin el, una variable
  // borrada que sigue usada (p.ej. `href={payUrl}` tras cambiar el CTA) no la
  // caza ni el lint ni el build —las rutas dinamicas no se prerenderizan— y
  // revienta en produccion con un 500. Se activa con los globals de navegador,
  // Node y los de los tests (vitest corre con `globals: true`).
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
        React: "readonly",
      },
    },
    rules: { "no-undef": "error" },
  },
]);

export default eslintConfig;
