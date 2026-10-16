const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function mount(page, api = {}) {
  const values = [], deps = [], cleanups = [];
  let cursor = 0, effects = [], dirty = false;
  const navigations = [], downloads = [];
  let exportedBlob;
  const react = {
    Fragment: 'fragment',
    useState: initial => {
      const index = cursor++;
      if (!(index in values)) values[index] = initial;
      return [values[index], value => {
        const next = typeof value === 'function' ? value(values[index]) : value;
        if (!Object.is(values[index], next)) dirty = true;
        values[index] = next;
      }];
    },
    useMemo: fn => fn(),
    useEffect: (fn, nextDeps) => {
      const index = cursor++;
      if (!deps[index] || nextDeps.some((value, i) => !Object.is(value, deps[index][i]))) {
        deps[index] = nextDeps;
        effects.push(() => { cleanups[index]?.(); cleanups[index] = fn(); });
      }
    },
  };
  const symbols = new Proxy({}, { get: (_, key) => String(key) });
  const jsx = (type, props) => ({ type, props });
  const router = { push: value => navigations.push(value) };
  const context = {
    exports: {}, setTimeout() {}, Blob,
    URL: { createObjectURL: blob => { exportedBlob = blob; return 'blob:test'; }, revokeObjectURL() {} },
    document: { createElement: () => ({ click() { downloads.push(this.download); } }) },
    require: name => {
      if (name === 'react') return { ...react, default: react };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/navigation') return { useRouter: () => router };
      if (name === '@/lib/api') return { getErrorMessage: error => error.message, ...api };
      return symbols;
    },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, `../src/app/${page}/page.tsx`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, context);
  function render() {
    for (let attempt = 0; attempt < 10; attempt++) {
      cursor = 0; effects = []; dirty = false;
      const tree = context.exports.default();
      effects.forEach(effect => effect());
      if (!dirty) return tree;
    }
    throw new Error('Render did not settle');
  }
  return {
    render, navigations, downloads, exportedBlob: () => exportedBlob,
    async settle() { render(); await new Promise(resolve => setImmediate(resolve)); return render(); },
  };
}
function nodes(tree, predicate) {
  if (tree == null || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function text(tree) {
  if (tree == null) return '';
  if (Array.isArray(tree)) return tree.map(text).join('');
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
const find = (app, predicate) => nodes(app.render(), predicate);
const control = (app, label) => find(app, node => node.props?.['aria-label'] === label)[0];
const button = (app, label) => find(app, node => node.type === 'button' && text(node) === label)[0];
const skill = (id = 'skill-1') => ({ id, canonical_name: 'Backend Skill', category: 'tool', aliases: ['real-alias'], status: 'pending', source: 'manual', updated_at: '2026-10-15' });
const event = (id = 'event-1') => ({ id, timestamp: '2026-10-15T12:00:00Z', actor_id: null, actor_role: 'system', action: 'CREATE_SKILL', resource_type: 'taxonomy', resource_id: 'skill-1', decision: 'ALLOWED', details: '' });
const candidate = (id, name) => ({ id, name, stage: 'Screening', applied_for_job_id: `job-${id}`, core_skills: [], scorecard: { overall_match_score: null } });

test('taxonomy loads saved records, filters on the server, and paginates', async () => {
  const calls = [];
  const app = mount('taxonomy', { fetchTaxonomySkills: async params => { calls.push(params); return { items: [skill()], total: 60, version: 'saved-v1' }; } });
  assert.match(text(app.render()), /Loading skills/);
  await app.settle();
  assert.match(text(app.render()), /Backend Skill/);
  assert.doesNotMatch(text(app.render()), /Kubernetes Cluster|218|HASH:/);
  button(app, 'Next').props.onClick();
  await app.settle();
  assert.equal(calls.at(-1).page, 2);
  control(app, 'Search skills').props.onChange({ target: { value: 'Python' } });
  await app.settle();
  assert.equal(calls.at(-1).search, 'Python');
  assert.equal(calls.at(-1).page, 1);
  control(app, 'Filter skill status').props.onChange({ target: { value: 'pending' } });
  await app.settle();
  assert.equal(calls.at(-1).status, 'pending');
});

test('taxonomy creation reports failure without closing or announcing success; retry saves through API', async () => {
  let failing = true, payload, stored = [];
  const app = mount('taxonomy', {
    fetchTaxonomySkills: async () => ({ items: stored, total: stored.length, version: 'v1' }),
    createTaxonomySkill: async input => { payload = input; if (failing) throw new Error('Skill rejected'); const saved = { ...skill(), canonical_name: input.canonical_name }; stored = [saved]; return saved; },
  });
  await app.settle();
  button(app, 'New skill').props.onClick();
  const inputs = find(app, node => node.type === 'input');
  inputs.find(node => node.props.maxLength === 100).props.onChange({ target: { value: ' New Skill ' } });
  inputs.at(-1).props.onChange({ target: { value: ' alias-a, alias-b ' } });
  const create = () => find(app, node => node.type === 'form').at(-1).props.onSubmit({ preventDefault() {} });
  await create();
  assert.match(text(app.render()), /Skill rejected/);
  assert.equal(find(app, node => node.type === 'Dialog')[0].props.open, true);
  assert.doesNotMatch(text(app.render()), /Saved New Skill/);
  failing = false;
  await create();
  await app.settle();
  assert.equal(payload.canonical_name, 'New Skill');
  assert.deepEqual(Array.from(payload.aliases), ['alias-a', 'alias-b']);
  assert.equal(find(app, node => node.type === 'Dialog')[0].props.open, false);
  assert.match(text(app.render()), /Saved New Skill/);
});

test('taxonomy empty and failed loads never show seeded competencies', async () => {
  for (const failure of [false, true]) {
    const app = mount('taxonomy', { fetchTaxonomySkills: async () => { if (failure) throw new Error('Taxonomy unavailable'); return { items: [], total: 0, version: 'v1' }; } });
    await app.settle();
    assert.match(text(app.render()), failure ? /Taxonomy unavailable/ : /No skills match/);
    assert.doesNotMatch(text(app.render()), /Kubernetes Cluster|Golang Microservices/);
  }
});

test('taxonomy review and aliases call persisted mutation endpoints', async () => {
  let stored = skill(); const calls = [];
  const app = mount('taxonomy', {
    fetchTaxonomySkills: async () => ({ items: [stored], total: 1, version: 'v1' }),
    approveTaxonomySkill: async id => { calls.push(['approve', id]); return stored = { ...stored, status: 'approved' }; },
    rejectTaxonomySkill: async id => { calls.push(['reject', id]); return stored = { ...stored, status: 'rejected' }; },
    addAliasToTaxonomySkill: async (id, alias) => { calls.push(['alias', id, alias]); return stored = { ...stored, aliases: [...stored.aliases, alias] }; },
  });
  await app.settle(); await button(app, 'Approve').props.onClick(); await app.settle();
  await button(app, 'Reject').props.onClick(); await app.settle();
  control(app, 'New alias').props.onChange({ target: { value: 'saved-alias' } });
  find(app, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  await app.settle();
  assert.deepEqual(calls, [['approve', 'skill-1'], ['reject', 'skill-1'], ['alias', 'skill-1', 'saved-alias']]);
});

test('audit history uses saved events, backend filters, and exports actual displayed data', async () => {
  const calls = [];
  const app = mount('audit-log', { fetchAuditLogs: async params => { calls.push(params); return [event(), { ...event('event-2'), action: 'DENIED_ACTION', decision: 'DENIED' }]; } });
  await app.settle();
  assert.match(text(app.render()), /CREATE_SKILL/);
  assert.doesNotMatch(text(app.render()), /SHA-256 Verified|WORM|14,291|Elena Varga/);
  control(app, 'Filter audit action').props.onChange({ target: { value: 'CREATE_SKILL' } });
  find(app, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  await app.settle();
  assert.equal(calls.at(-1).action, 'CREATE_SKILL');
  control(app, 'Search loaded audit events').props.onChange({ target: { value: 'DENIED_ACTION' } });
  button(app, 'Export displayed events').props.onClick();
  const csv = await app.exportedBlob().text();
  assert.match(csv, /event-2/);
  assert.doesNotMatch(csv, /event-1/);
  assert.deepEqual(app.downloads, ['audit-events.csv']);
});

test('audit permission errors and empty history are distinct and never show demo events', async () => {
  for (const failure of [false, true]) {
    const app = mount('audit-log', { fetchAuditLogs: async () => { if (failure) throw new Error('Access denied'); return []; } });
    await app.settle();
    assert.match(text(app.render()), failure ? /Access denied/ : /No audit events match/);
    assert.equal(button(app, 'Export displayed events').props.disabled, true);
    assert.doesNotMatch(text(app.render()), /TX-99081|194.72.18.2/);
  }
});

test('bulk stage updates persist per application; partial failure keeps failed rows selected', async () => {
  const records = [candidate('one', 'First Candidate'), candidate('two', 'Second Candidate')];
  const calls = [];
  const api = {
    fetchCandidates: async () => records,
    fetchJobs: async () => [],
    updateCandidateStage: async (id, stage, job) => { calls.push([id, stage, job]); if (id === 'two') throw new Error('Permission denied'); records[0] = { ...records[0], stage }; return { stage }; },
  };
  const app = mount('candidates', api);
  await app.settle();
  assert.doesNotMatch(text(app.render()), /Elena Varga|Tomas Novak/);
  find(app, node => node.props?.type === 'checkbox')[0].props.onChange();
  const move = find(app, node => node.type === 'DropdownMenuItem' && text(node) === 'Interview')[0];
  await move.props.onClick();
  assert.deepEqual(calls, [['one', 'Interview', 'job-one'], ['two', 'Interview', 'job-two']]);
  assert.match(text(app.render()), /1 of 2 updated.*Permission denied/);
  const checks = find(app, node => node.props?.type === 'checkbox');
  assert.equal(checks[1].props.checked, false);
  assert.equal(checks[2].props.checked, true);
  assert.equal(records[0].stage, 'Interview');
  assert.equal(records[1].stage, 'Screening');
  const reload = mount('candidates', api); await reload.settle();
  assert.match(text(reload.render()), /Interview/);
});

test('candidate ingestion uses the upload flow; unsupported ownership never claims a save', async () => {
  const app = mount('candidates', { fetchCandidates: async () => [candidate('one', 'Only Saved Candidate')], fetchJobs: async () => [] });
  await app.settle();
  assert.equal(button(app, 'Assign Owner (unavailable)').props.disabled, true);
  const add = find(app, node => node.type === 'button' && text(node).includes('Add Candidate'))[0];
  add.props.onClick();
  assert.equal(find(app, node => node.type === 'AddCandidateModal')[0].props.open, true);
  assert.equal(find(app, node => node.props?.type === 'checkbox').length, 2);
  assert.doesNotMatch(text(app.render()), /Candidate .* added to roster/);
});

test('candidate load failures are visible', async () => {
  const app = mount('candidates', { fetchCandidates: async () => { throw new Error('Directory unavailable'); }, fetchJobs: async () => [] });
  await app.settle();
  assert.match(text(app.render()), /Directory unavailable/);
});
