const fs = require('node:fs');
const { configScript } = require('./config.cjs');
if (fs.existsSync('.env')) process.loadEnvFile('.env');
// Validate before touching the previous successful output.
const config = configScript(process.env);
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');
for (const file of ['index.html', 'learner-import.js', 'appraisal.html', 'appraisal.js', 'appraisal-config.js', 'appraisal.css', 'survey.html', 'survey.js']) fs.copyFileSync(file, 'dist/' + file);
fs.cpSync('vendor', 'dist/vendor', { recursive: true });
fs.writeFileSync('dist/config.js', config);
console.log('Static register, appraisal and survey pages built.');
