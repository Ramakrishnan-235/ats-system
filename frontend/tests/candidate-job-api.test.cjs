const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/lib/api.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function load(responder) {
  const calls = [];
  const context = { exports: {}, process: { env: {} }, Headers, URLSearchParams, FormData, AbortSignal, DOMException, crypto: require('node:crypto').webcrypto, Event, setTimeout, clearTimeout,
    fetch: async (url, options) => { calls.push({ url, options }); const value = await responder(url, options); return value instanceof Response ? value : new Response(JSON.stringify(value), { status: 200 }); } };
  vm.runInNewContext(code, context);
  return { api: context.exports, calls };
}
test('new resume submits name, role, job, and stable request identity together', async () => {
  const { api, calls } = load(() => ({ task_id: 'task', candidate_id: 'candidate' }));
  await api.uploadResumeFile(new File(['%PDF-'], 'resume.pdf'), 'job', undefined, { name: ' Synthetic Applicant ', headline: ' Backend Engineer ', idempotencyKey: 'request' });
  assert.equal(calls[0].options.body.get('name'), 'Synthetic Applicant');
  assert.equal(calls[0].options.body.get('headline'), 'Backend Engineer');
  assert.equal(calls[0].options.body.get('job_id'), 'job');
  assert.equal(calls[0].options.headers.get('Idempotency-Key'), 'request');
});
test('candidate scoring queues only the requested application and accepts a persisted zero score', async () => {
  const { api, calls } = load(url => url.endsWith('/evaluate') ? { job_id: 'job', task_ids: ['task'] } : url.includes('/tasks/') ? { state: 'SUCCESS', result: { candidate_id: 'candidate', evaluation_status: 'COMPLETED', match_score: 0 } } : [{ id: 'candidate', jobId: 'job', matchScore: 0 }]);
  const saved = await api.evaluateCandidateForJob('job', 'candidate');
  assert.equal(calls[0].url, '/core-api/api/v1/jobs/job/candidates/candidate/evaluate');
  assert.equal(saved[0].matchScore, 0);
  assert.equal(calls.some(call => call.url.includes('/match/evaluate-job')), false);
});
test('wrong candidate, skipped evaluation, missing score and wrong job task are rejected', async () => {
  for (const result of [{ candidate_id: 'other', evaluation_status: 'COMPLETED', match_score: 80 }, { candidate_id: 'candidate', evaluation_status: 'SKIPPED', match_score: null }, { candidate_id: 'candidate', evaluation_status: 'COMPLETED' }]) {
    const { api } = load(url => url.endsWith('/evaluate') ? { job_id: 'job', task_ids: ['task'] } : { state: 'SUCCESS', result });
    await assert.rejects(api.evaluateCandidateForJob('job', 'candidate'), /completed AI score/);
  }
  const { api } = load(() => ({ job_id: 'another-job', task_ids: ['task'] }));
  await assert.rejects(api.evaluateCandidateForJob('job', 'candidate'), /did not confirm/);
});
test('failed task and unpersisted job score never become UI success', async () => {
  const failed = load(url => url.endsWith('/evaluate') ? { job_id: 'job', task_ids: ['task'] } : { state: 'FAILURE', error: 'Model unavailable' });
  await assert.rejects(failed.api.evaluateCandidateForJob('job', 'candidate'), /Model unavailable/);
  const missing = load(url => url.endsWith('/evaluate') ? { job_id: 'job', task_ids: ['task'] } : url.includes('/tasks/') ? { state: 'SUCCESS', result: { candidate_id: 'candidate', evaluation_status: 'COMPLETED', match_score: 70 } } : [{ id: 'candidate', jobId: 'other', matchScore: 70 }]);
  await assert.rejects(missing.api.evaluateCandidateForJob('job', 'candidate'), /has not been saved/);
});
test('transient status errors retry reads without queuing another evaluation', async () => {
  let taskReads = 0;
  const { api, calls } = load(url => url.endsWith('/evaluate') ? { job_id: 'job', task_ids: ['task'] } : url.includes('/tasks/') ? ++taskReads === 1 ? new Response(JSON.stringify({ detail: 'Temporarily unavailable' }), { status: 503 }) : { state: 'SUCCESS', result: { candidate_id: 'candidate', evaluation_status: 'COMPLETED', match_score: 60 } } : [{ id: 'candidate', jobId: 'job', matchScore: 60 }]);
  const saved = await api.evaluateCandidateForJob('job', 'candidate', { pollIntervalMs: 1 });
  assert.equal(saved[0].matchScore, 60);
  assert.equal(taskReads, 2);
  assert.equal(calls.filter(call => call.url.endsWith('/evaluate')).length, 1);
});
