module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist/**',
    'build/**',
    'node_modules/**',
    '.release-backups/**',
    '.ai/memory/**',
    'build.zip',
    '.eslintrc.cjs',
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  overrides: [
    {
      files: ['api/**/*.js', 'server/**/*.js', 'server-shared/**/*.js', 'scripts/**/*.js', 'vite.config.js'],
      env: { node: true, browser: false },
    },
  ],
  rules: {
    'react-refresh/only-export-components': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'no-unused-vars': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
};
