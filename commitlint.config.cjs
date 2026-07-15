/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Default conventional limit is 100; dependency bumps often need slightly longer subjects.
    'header-max-length': [2, 'always', 120],
  },
};
