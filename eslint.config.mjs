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
      "no-unused-vars": "on",
      "@typescript-eslint/no-unused-vars": "on",
      "@typescript-eslint/no-explicit-any": "on",
      "@typescript-eslint/no-non-null-assertion": "on",
      "no-useless-escape": "on",
      "no-var": "on",
      "@typescript-eslint/ban-ts-comment": "on",
      "no-prototype-builtins": "on",
      "@typescript-eslint/no-empty-function": "on",
      "@typescript-eslint/no-this-alias": [
        "error",
        {
          allowDestructuring: true,
          allowedNames: ["self"],
        },
      ],
      "require-yield": "off",
      // Obsidian plugin rules (add any you need)
      // "obsidianmd/sample-names": "off",
      // "obsidianmd/prefer-file-manager-trash": "error",
    },
  },
];
