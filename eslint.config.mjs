import globals from "globals";
import pluginJs from "@eslint/js";
import prettier from "eslint-config-prettier/flat";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Base configuration: ESLint recommended rules
  pluginJs.configs.recommended,

  // Overrides
  {
    files: ["**/*.js"],
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
    },
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // Disable rules that conflict with Prettier
  prettier
];
