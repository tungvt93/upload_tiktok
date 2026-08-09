/**
 * helpers/mock-env.mjs — must be imported FIRST by any test that needs
 * DOUYIN_MOCK=1 (or other Douyin env vars) to be visible to the modules under
 * test.
 *
 * Why this exists: ESM `import` statements are hoisted and evaluated in source
 * order before the importing module's body runs. A bare `process.env.X = ...`
 * line at the top of a test file therefore executes AFTER douyin-client.js /
 * douyin-config.js have already read the environment at load time, silently
 * disabling mock mode. Importing this module as the very first dependency
 * guarantees the flags are set before any Douyin module is evaluated.
 */
process.env.DOUYIN_MOCK = '1';
