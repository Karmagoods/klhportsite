import {defineConfig} from 'eslint-define-config';
import eslintConfigGoogle from 'eslint-config-google';

export default defineConfig([
  {
    languageOptions: {
      ecmaVersion: 2018,
      globals: {},
    },
    rules: {
      'no-restricted-globals': ['error', 'name', 'length'],
      'prefer-arrow-callback': 'error',
      'quotes': ['error', 'double', {allowTemplateLiterals: true}],
    },
  },
  // Overrides are now part of the array
  {
    files: ['**/*.spec.*'],
    env: {
      mocha: true,
    },
    rules: {},
  },
  // Include eslint-config-google directly in the array
  {
    ...eslintConfigGoogle,
  },
]);
