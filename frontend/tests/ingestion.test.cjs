const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/lib/ingestion.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function load(api = {}) {
  const context = { exports: {}, require: () => api, crypto: webcrypto, TextDecoder, Uint8Array, setTimeout, clearTimeout };
  vm.runInNewContext(code, context);
  return context.exports;
}
test('PDF validation hashes actual bytes and rejects unsupported, empty, oversized and disguised files', async () => {
  const api = load();
  const valid = new File(['%PDF-1.4\nsynthetic'], 'resume.pdf');
  assert.equal(await api.resumeHash(valid), require('node:crypto').createHash('sha256').update('%PDF-1.4\nsynthetic').digest('hex'));
  await assert.rejects(api.resumeHash(new File(['%PDF-'], 'resume.docx')), /Only PDF/);
  await assert.rejects(api.resumeHash(new File([], 'empty.pdf')), /non-empty/);
  await assert.rejects(api.resumeHash(new File(['plain text'], 'disguised.pdf')), /not a valid PDF/);
  await assert.rejects(api.resumeHash({ name: 'large.pdf', size: api.MAX_RESUME_BYTES + 1 }), /10 MB/);
});
test('accepted or pending tasks cannot produce a completed profile', async () => {
  const api = load({ fetchCandidate: () => assert.fail('must not fetch before success') });
  for (const state of ['PENDING', 'PROGRESS', 'FAILURE']) await assert.rejects(api.completedProfile({ state, result: { candidate_id: 'candidate' } }), /not confirmed/);
  await assert.rejects(api.completedProfile({ state: 'SUCCESS' }), /not confirmed/);
});
test('success verifies a persisted profile and keeps evaluation failure separate', async () => {
  const saved = { id: 'candidate', processing_status: 'COMPLETED', core_skills: ['Python'] };
  const api = load({ fetchCandidate: async id => { assert.equal(id, saved.id); return saved; } });
  assert.equal(await api.completedProfile({ state: 'SUCCESS', result: { candidate_id: 'candidate', evaluation_status: 'FAILED' } }), saved);
});
test('missing, mismatched, failed, or unfinished saved profiles never become completed', async () => {
  for (const candidate of [null, { id: 'other' }, { id: 'candidate', processing_status: 'PENDING' }, { id: 'candidate', processing_status: 'FAILED' }]) {
    const api = load({ fetchCandidate: async () => candidate });
    await assert.rejects(api.completedProfile({ state: 'SUCCESS', result: { candidate_id: 'candidate' } }), /not ready/);
  }
  const api = load({ fetchCandidate: async () => { throw new Error('Connection lost'); } });
  await assert.rejects(api.completedProfile({ state: 'SUCCESS', result: { candidate_id: 'candidate' } }), /Connection lost/);
});
test('monitor uses real task state and propagates network failures', async () => {
  const seen = [];
  const api = load({ fetchUploadTask: async (id, signal) => { assert.equal(id, 'task'); assert.ok(signal); return { state: 'FAILURE', error: 'OCR failed' }; } });
  await api.monitorIngestion('task', new AbortController().signal, task => seen.push(task));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].state, 'FAILURE');
  const offline = load({ fetchUploadTask: async () => { throw new Error('Offline'); } });
  await assert.rejects(offline.monitorIngestion('task', new AbortController().signal, () => assert.fail()), /Offline/);
});
test('a stopped monitor makes no status request', async () => {
  const api = load({ fetchUploadTask: () => assert.fail('aborted monitor must not poll') });
  const controller = new AbortController(); controller.abort();
  await api.monitorIngestion('task', controller.signal, () => assert.fail());
});
