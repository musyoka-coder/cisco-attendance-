const fs = require('node:fs');
function publicConfig(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      'Set SUPABASE_URL and SUPABASE_ANON_KEY in .env or the build environment.',
    );
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/'
  )
    throw new Error('SUPABASE_URL must be an HTTPS origin.');
  let permitted = key.startsWith('sb_publishable_');
  if (!permitted) {
    try {
      permitted =
        JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
          .role === 'anon';
    } catch {
      /* Invalid keys are rejected below. */
    }
  }
  if (!permitted)
    throw new Error(
      'Only publishable or legacy anon keys may be shipped to the browser. Never use a secret/service-role key.',
    );
  return { SUPABASE_URL: parsed.origin, SUPABASE_ANON_KEY: key };
}
function configScript(env) {
  return (
    'window.APP_CONFIG = Object.freeze(' +
    JSON.stringify(publicConfig(env)).replace(/</g, '\\u003c') +
    ');\n'
  );
}
function writeConfig(destination) {
  fs.writeFileSync(destination, configScript(process.env));
}
module.exports = { publicConfig, configScript, writeConfig };
