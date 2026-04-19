import js from "@eslint/js";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        fetch: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];

