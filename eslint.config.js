const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const parser = require('@typescript-eslint/parser');

module.exports = [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: parser,
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      ...typescriptEslint.configs['recommended'].rules,
      // no-string-throw: don't throw string literals
      'no-throw-literal': 'warn',
      // no-unused-expression
      'no-unused-expressions': 'warn',
      // no-duplicate-variable
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'warn',
      // curly: require braces for all control flow
      'curly': 'warn',
      // semicolon: always
      'semi': ['warn', 'always'],
      // triple-equals
      'eqeqeq': 'warn',
    },
  },
];
