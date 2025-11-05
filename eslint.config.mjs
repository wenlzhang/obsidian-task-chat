import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  ...obsidianmd.configs.recommended,
  {
    rules: {
      // turn off a rule from the recommended set
      // "obsidianmd/sample-names": "off",
      // add a rule not in the recommended set and set its severity
      // "obsidianmd/prefer-file-manager-trash": "error",
    },
  },
  tseslint.configs.recommended,
];
