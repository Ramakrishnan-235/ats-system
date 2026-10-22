const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/components/jobs/upload-operation-list.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const jsx = (type, props) => ({ type, props });
const context = { exports: {}, require: () => ({ jsx, jsxs: jsx }) };
vm.runInNewContext(code, context);
const { operationSnapshot, observedDuration, UploadOperationList } = context.exports;
function text(tree) {
  if (tree == null) return '';
  if (Array.isArray(tree)) return tree.map(text).join('');
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
const event = (status, started_at = '2026-10-22T10:00:00Z', finished_at = null, detail = null) => ({ status, started_at, finished_at, detail });

test('queued or legacy tasks never invent parsing, normalization, or model completion', () => {
  for (const task of [{ state: 'PENDING', progress: 35, step: 'Queued' }, { state: 'PROGRESS', progress: 25, step: 'Starting worker' }]) {
    const snapshot = operationSnapshot(task, null);
    assert.equal(snapshot.finished, 0);
    const rendered = text(UploadOperationList({ task, upload: null }));
    assert.doesNotMatch(rendered, /Completed|0\.3s|1\.1s|Running/);
    assert.match(rendered, /Waiting/);
  }
});

test('a fast sequence of real stages remains visible when polling reaches the model call', () => {
  const task = { state: 'PROGRESS', server_time: '2026-10-22T10:01:15Z', stages: {
    pdf_parsing: event('COMPLETED', undefined, '2026-10-22T10:00:02Z'),
    profile_extraction: event('FALLBACK', undefined, '2026-10-22T10:01:00Z', 'LOCAL_EXTRACTION'),
    skill_normalization: event('SKIPPED', null, '2026-10-22T10:01:00Z', 'LOCAL_EXTRACTION'),
    llm_evaluation: event('RUNNING', '2026-10-22T10:01:00Z'),
  } };
  const snapshot = operationSnapshot(task, null);
  assert.equal(snapshot.finished, 3);
  assert.match(snapshot.title, /AI evaluation/);
  const rendered = text(UploadOperationList({ task, upload: null }));
  assert.match(rendered, /Completed · 2\.0s/);
  assert.match(rendered, /Local fallback · 1m 0s/);
  assert.match(rendered, /Skipped/);
  assert.match(rendered, /Running · 15\.0s/);
});

test('durations use observed timestamps, handle zero, and never manufacture skipped timings', () => {
  assert.equal(observedDuration(event('COMPLETED', undefined, '2026-10-22T10:00:00Z')), '0.0s');
  assert.equal(observedDuration(event('SKIPPED', null, '2026-10-22T10:00:00Z')), '');
  assert.equal(observedDuration(event('RUNNING'), 'invalid'), '');
  assert.equal(observedDuration(event('RUNNING'), '2026-10-22T09:00:00Z'), '');
});

test('optional model failures remain unavailable while successful storage is completed', () => {
  const task = { state: 'SUCCESS', stages: {
    llm_evaluation: event('FAILED', undefined, '2026-10-22T10:00:04Z', 'MODEL_UNAVAILABLE'),
    saving_results: event('COMPLETED', undefined, '2026-10-22T10:00:05Z'),
  } };
  const rendered = text(UploadOperationList({ task, upload: null }));
  assert.match(rendered, /Unavailable · 4\.0s/);
  assert.match(rendered, /Completed · 5\.0s/);
  assert.match(rendered, /model did not return a usable result/);
});

test('a cancelled or stale task does not keep advertising its last running fallback operation', () => {
  const task = { state: 'FAILURE', stages: { profile_extraction: event('RUNNING', undefined, null, 'LOCAL_EXTRACTION') } };
  assert.match(operationSnapshot(task, null).title, /Processing stopped/);
  assert.doesNotMatch(text(UploadOperationList({ task, upload: null })), /Running/);
});
