const js = require('@eslint/js');
const globals = require('globals');
module.exports = [
  { ignores: ['vendor/**', 'dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  { files: ['**/*.js', '**/*.cjs'], languageOptions: { sourceType: 'script', globals: {...globals.browser, ...globals.node} }, rules: { 'no-unused-vars': ['error', {argsIgnorePattern:'^_', varsIgnorePattern:'^_', caughtErrors:'none'}] } },
  {files:['appraisal.js'],languageOptions:{globals:{APPRAISAL_MODULES:'readonly',STATUS_LABELS:'readonly',performancePairs:'readonly',safeCsv:'readonly'}}},
  {files:['learner-import.js'],languageOptions:{globals:{"CORAM_DEO": "writable", "MILIMANI": "writable", "WEEKS": "writable", "XLSX": "writable", "academicYear": "writable", "autoSaveTimer": "writable", "centerView": "writable", "centreIdByName": "writable", "challengeItems": "writable", "currentCenter": "writable", "currentDay": "writable", "currentWeek": "writable", "databaseReady": "writable", "findCurrentIndex": "writable", "getWeeksWithDays": "writable", "importPreview": "writable", "loadCentresAndStudents": "writable", "loadData": "writable", "renderAll": "writable", "renderDashboard": "writable", "renderReports": "writable", "renderUptime": "writable", "reports": "writable", "saveAll": "writable", "sb": "writable", "selectedForBulk": "writable", "sessionIdCache": "writable", "store": "writable", "studentIdByName": "writable"}}}
];
