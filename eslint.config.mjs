import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  // Ignore patterns
  {
    ignores: ["node_modules/**", "build/**"],
  },

  // Base config for all files
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
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
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],

      // === Required errors - TypeScript strict rules ===
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", {
        allowNumber: true,
        allowBoolean: true,
        allowAny: false,
        allowNullish: false,
      }],

      // === Required errors - JavaScript strict rules ===
      "no-prototype-builtins": "error",
      "no-useless-escape": "error",
      "no-console": ["error", {
        allow: ["warn", "error", "debug"]
      }],

      // === Obsidian plugin rules - all set to error ===
      // Commands
      "obsidianmd/commands/no-command-in-command-id": "error",
      "obsidianmd/commands/no-command-in-command-name": "error",
      "obsidianmd/commands/no-default-hotkeys": "error",
      "obsidianmd/commands/no-plugin-id-in-command-id": "error",
      "obsidianmd/commands/no-plugin-name-in-command-name": "error",

      // Core Obsidian patterns
      "obsidianmd/detach-leaves": "error",
      "obsidianmd/hardcoded-config-path": "error",
      "obsidianmd/no-forbidden-elements": "error",
      "obsidianmd/no-plugin-as-component": "error",
      "obsidianmd/no-sample-code": "error",
      "obsidianmd/no-static-styles-assignment": "error",
      "obsidianmd/no-tfile-tfolder-cast": "error",
      "obsidianmd/no-view-references-in-plugin": "error",
      "obsidianmd/object-assign": "error",
      "obsidianmd/platform": "error",
      "obsidianmd/prefer-abstract-input-suggest": "error",
      "obsidianmd/prefer-file-manager-trash-file": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/sample-names": "error",

      // Settings tab
      "obsidianmd/settings-tab/no-manual-html-headings": "error",
      "obsidianmd/settings-tab/no-problematic-settings-headings": "error",

      // UI text
      "obsidianmd/ui/sentence-case": ["error", {
        allowAutoFix: true,
        enforceCamelCaseLower: false,
      }],
      "obsidianmd/ui/sentence-case-json": "error",
      "obsidianmd/ui/sentence-case-locale-module": "error",

      // Validation
      "obsidianmd/validate-license": "error",
      "obsidianmd/validate-manifest": "error",
      "obsidianmd/vault/iterate": "error",

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
