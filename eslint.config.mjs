import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "docs/**/*.js",
      "*.config.{js,mjs}",
      "version-*.mjs",
      "jest.config.js"
    ],
  },

  // Config for JavaScript files (no TypeScript project needed)
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      sourceType: "module",
    },
  },

  // Config for TypeScript files (with project reference)
  {
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: {
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
  },

  // Apply base recommended configs
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Apply Obsidian plugin - manual config for flat config compatibility
  {
    plugins: {
      obsidianmd: obsidianmd,
    },
    rules: {
      ...obsidianmd.configs.recommended,
      ...obsidianmd.configs.recommendedWithLocalesEn,
    },
  },

  // Custom rules override - match Obsidian plugin review requirements
  {
    rules: {
      // === Optional warnings - unused variables ===
      // Ignore variables/parameters starting with underscore (conventional unused marker)
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],

      // === Required errors - TypeScript strict rules ===
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", {
        allowNumber: true,
        allowBoolean: true,
        allowAny: false,
        allowNullish: false,
        allowNever: false,
      }],

      // === Required errors - JavaScript strict rules ===
      "no-prototype-builtins": "error",
      "no-useless-escape": "error",
      "no-console": ["error", {
        allow: ["warn", "error", "debug"]
      }],

      // === Keep as warnings (non-critical) ===
      "@typescript-eslint/no-non-null-assertion": "warn",
      "no-var": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-function": "warn",
      "@typescript-eslint/no-this-alias": ["warn", {
        allowDestructuring: true,
        allowedNames: ["self"],
      }],
      "require-yield": "warn",
    },
  },
];
