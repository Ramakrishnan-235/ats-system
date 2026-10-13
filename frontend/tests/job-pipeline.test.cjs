const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/lib/job-pipeline.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { jobPipelineColumns, nextApplicationStage } = context.exports;

test('job board separates applied and screening and preserves every backend stage', () => {
  const candidates = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Qualified', 'Review Required', 'Rejected', 'Custom Stage'].map((stage, id) => ({ id: String(id), stage }));
  const columns = jobPipelineColumns(candidates);
  assert.equal(columns.find(col => col.stage === 'Interview').label, 'Tech Interview');
  for (const candidate of candidates) {
    const matches = columns.flatMap(col => col.items).filter(item => item.id === candidate.id);
    assert.equal(matches.length, 1);
    assert.equal(columns.find(col => col.stage === candidate.stage).items[0], candidate);
  }
  assert.equal(jobPipelineColumns([]).length, 5);
});

test('stage advancement reaches hired without advancing terminal or unknown stages', () => {
  assert.equal(nextApplicationStage('Applied'), 'Screening');
  assert.equal(nextApplicationStage('Screening'), 'Interview');
  assert.equal(nextApplicationStage('Interview'), 'Qualified');
  assert.equal(nextApplicationStage('Offer'), 'Hired');
  for (const stage of ['Hired', 'Rejected', 'Withdrawn', 'Unknown']) assert.equal(nextApplicationStage(stage), undefined);
});
