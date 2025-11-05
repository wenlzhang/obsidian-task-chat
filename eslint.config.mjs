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
  // Apply recommended configs
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Obsidian plugin configs (wrapped properly for flat config)
  {
    plugins: {
      obsidianmd: obsidianmd,
    },
    rules: {
      ...obsidianmd.configs.recommended,
      ...obsidianmd.configs.recommendedWithLocalesEn,
    },
  },
  // Custom rules override
  {
    rules: {
      // Custom rules from old config
      "no-unused-vars": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "no-useless-escape": "warn",
      "no-var": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "no-prototype-builtins": "warn",
      "@typescript-eslint/no-empty-function": "warn",
      "@typescript-eslint/no-this-alias": [
        "warn",
        {
          allowDestructuring: true,
          allowedNames: ["self"],
        },
      ],
      "require-yield": "warn",
      // Obsidian plugin rules (add any you need)
      // "obsidianmd/sample-names": "off",
      // "obsidianmd/prefer-file-manager-trash": "error",
    },
  },
];
