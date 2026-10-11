import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // Relative asset paths so the static build works from any sub-path (or file://).
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  fmt: {
    ignorePatterns: ["dist", "harness/*.py"],
  },
  test: {
    include: ["src/**/*.test.ts", "data/**/*.test.ts"],
    environment: "node",
  },
  run: {
    tasks: {
      "data:validate": {
        command: "node scripts/validate-data.ts",
        input: ["data/**", "src/schema.ts", "scripts/validate-data.ts"],
      },
      "app:build": {
        command: "tsc && vp build",
        dependsOn: ["data:validate"],
        output: ["dist/**"],
      },
    },
  },
  lint: {
    plugins: ["oxc", "typescript", "unicorn", "react"],
    categories: {
      correctness: "error",
    },
    env: {
      builtin: true,
    },
    ignorePatterns: ["dist", "node_modules"],
    overrides: [
      {
        files: ["**/*.{ts,tsx}"],
        rules: {
          "typescript/no-explicit-any": "error",
          "react/rules-of-hooks": "error",
          "react/exhaustive-deps": "warn",
          "react/only-export-components": ["error", { allowConstantExport: true }],
        },
        env: {
          browser: true,
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
  },
  plugins: [react(), tailwindcss()],
});
