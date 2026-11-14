const { spawn } = require('node:child_process');
const { serve } = require('./serve.cjs');
(async () => {
  const server = await serve('dist', 0);
  try {
    const exit = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['tests/browser.cjs'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          TEST_BASE_URL: 'http://127.0.0.1:' + server.address().port,
        },
      });
      child.once('error', reject);
      child.once('exit', (code) => resolve(code ?? 1));
    });
    process.exitCode = exit;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
