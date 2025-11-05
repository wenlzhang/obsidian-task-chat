import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  ...js.configs.recommended,
  ...tseslint.configs.recommended,
  ...obsidianmd.configs.recommended,
  ...obsidianmd.configs.recommendedWithLocalesEn,
  {
    rules: {
      // turn off a rule from the recommended set
      // "obsidianmd/sample-names": "off",
      // add a rule not in the recommended set and set its severity
      // "obsidianmd/prefer-file-manager-trash": "error",
    },
  },
];
