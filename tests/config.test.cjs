const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { publicConfig, configScript } = require('../scripts/config.cjs');
const config = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_test',
};
test('public settings serialize into immutable browser configuration', () => {
  const context = { window: {} };
  vm.runInNewContext(configScript(config), context);
  assert.equal(context.window.APP_CONFIG.SUPABASE_URL, config.SUPABASE_URL);
  assert.ok(Object.isFrozen(context.window.APP_CONFIG));
});
test('missing settings, unsafe URLs and privileged keys fail closed', () => {
  for (const invalid of [
    {},
    { ...config, SUPABASE_ANON_KEY: 'sb_secret_bad' },
    { ...config, SUPABASE_URL: 'http://example.com' },
    { ...config, SUPABASE_URL: 'https://user:pass@example.com' },
  ])
    assert.throws(() => publicConfig(invalid));
  const jwt = (role) =>
    'header.' +
    Buffer.from(JSON.stringify({ role })).toString('base64url') +
    '.signature';
  assert.throws(() =>
    publicConfig({ ...config, SUPABASE_ANON_KEY: jwt('service_role') }),
  );
  assert.equal(
    publicConfig({ ...config, SUPABASE_ANON_KEY: jwt('anon') }).SUPABASE_URL,
    config.SUPABASE_URL,
  );
});
test('configuration cannot terminate an embedded script', () =>
  assert.ok(
    !configScript({
      ...config,
      SUPABASE_ANON_KEY: 'sb_publishable_</script>',
    }).includes('</script>'),
  ));
