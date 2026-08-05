import {defineConfig} from "eslint-define-config";
import eslintConfigGoogle from "eslint-config-google";

export default defineConfig([
  // Include eslint-config-google first so our overrides can take precedence
  {
    ...eslintConfigGoogle,
  },
  {
    languageOptions: {
      ecmaVersion: 2020,
      globals: {},
    },
    rules: {
      "no-restricted-globals": ["error", "name", "length"],
      "prefer-arrow-callback": "error",
      "quotes": ["error", "double", {allowTemplateLiterals: true}],
      "max-len": "off",
      "require-jsdoc": "off",
    },
  },
  {
    files: ["**/*.spec.*"],
    env: {
      mocha: true,
    },
    rules: {},
  },
]);
