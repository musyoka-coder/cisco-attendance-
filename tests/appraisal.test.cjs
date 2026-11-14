const { test } = require('node:test'),
  assert = require('node:assert/strict');
const {
  performancePairs,
  safeCsv,
  APPRAISAL_MODULES,
} = require('../appraisal-config.js');
test('all appraisal gaps have a dedicated workflow', () => {
  assert.equal(Object.keys(APPRAISAL_MODULES).length, 10);
});
test('progress pairs match learner and topic and normalize score scales', () => {
  const r = (student, topic, phase, score, maximum, date) => ({
    kind: 'assessment',
    student_id: student,
    record_date: date,
    created_at: date,
    status: 'completed',
    details: { topic, phase, score, maximum },
  });
  const result = performancePairs([
    r(1, 'IP', 'baseline', 5, 10, '2026-01-01'),
    r(1, 'IP', 'follow_up', 80, 100, '2026-02-01'),
    r(2, 'IP', 'follow_up', 100, 100, '2026-02-01'),
    r(1, 'DNS', 'practice', 8, 10, '2026-01-01'),
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].change, 30);
});
test('CSV protects formula-like text and quotes', () => {
  assert.equal(
    safeCsv([['=1+1', 'a"b', 'line\nnext']]),
    '"\'=1+1","a""b","line\nnext"',
  );
});
