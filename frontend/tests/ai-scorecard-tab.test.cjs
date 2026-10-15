const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/candidate/ai-scorecard-tab.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const note = (id, content) => ({ id, content, author: 'Recruiter', initials: 'R', timestamp: 'Today' });
function candidate(notes = [], overrides = {}) {
  return {
    id: 'candidate-1', applied_for_job_id: 'job-1',
    scorecard: { overall_match_score: null, categories: [], risk_flags: [], suggested_improvements: [], suggested_questions: [], team_notes: notes },
    ...overrides,
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function mount(initialCandidate, api = {}) {
  const state = [];
  const dependencies = [];
  const cleanups = [];
  let currentCandidate = initialCandidate;
  let cursor = 0;
  let dirty = false;
  let effects = [];
  const react = {
    Fragment: 'fragment',
    useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => {
        const next = typeof value === 'function' ? value(state[index]) : value;
        if (!Object.is(state[index], next)) dirty = true;
        state[index] = next;
      }];
    },
    useRef: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useEffect: (effect, deps) => {
      const index = cursor++;
      if (!dependencies[index] || deps.some((value, i) => !Object.is(value, dependencies[index][i]))) {
        dependencies[index] = deps;
        effects.push(() => { cleanups[index]?.(); cleanups[index] = effect(); });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const symbols = new Proxy({}, { get: (_, name) => String(name) });
  const context = { exports: {}, require: name => {
    if (name === 'react') return { ...react, default: react };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/api') return { getErrorMessage: error => error.message, ...api };
    return symbols;
  } };
  vm.runInNewContext(code, context);
  function render(next = currentCandidate) {
    currentCandidate = next;
    for (let attempt = 0; attempt < 10; attempt++) {
      cursor = 0; dirty = false; effects = [];
      const tree = context.exports.AIScorecardTab({ candidate: currentCandidate });
      effects.forEach(effect => effect());
      if (!dirty) return tree;
    }
    throw new Error('Component did not settle');
  }
  return { render };
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
const input = app => nodes(app.render(), node => node.type === 'textarea')[0];
const draft = (app, value) => input(app).props.onChange({ target: { value } });
const submit = app => nodes(app.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
const postButton = app => nodes(app.render(), node => node.props?.type === 'submit')[0];
const region = (app, label) => nodes(app.render(), node => node.props?.['aria-label'] === label);

test('note failure is handled, displays the error, and preserves the draft for retry', async () => {
  const app = mount(candidate(), { addCandidateNote: async () => { throw new Error('Cannot save note'); } });
  draft(app, 'Keep this draft');
  await assert.doesNotReject(submit(app));
  assert.equal(nodes(app.render(), node => node.props?.role === 'alert').map(text).join(''), 'Cannot save note');
  assert.equal(input(app).props.value, 'Keep this draft');
  assert.equal(postButton(app).props.disabled, false);
});

test('successful notes append once and clear the draft', async () => {
  const app = mount(candidate([note('old', 'Existing note')]), {
    addCandidateNote: async (id, content) => { assert.equal(id, 'candidate-1'); return note('new', content); },
  });
  draft(app, 'Saved note');
  await submit(app);
  assert.match(text(app.render()), /Existing note/);
  assert.match(text(app.render()), /Saved note/);
  assert.equal(input(app).props.value, '');
});

test('new server notes replace the old list while an in-progress draft is preserved', () => {
  const initial = candidate([note('old', 'Stale note')]);
  const app = mount(initial);
  draft(app, 'Unsaved draft');
  app.render({ ...initial, scorecard: { ...initial.scorecard, team_notes: [note('fresh', 'Fresh server note')] } });
  assert.doesNotMatch(text(app.render()), /Stale note/);
  assert.match(text(app.render()), /Fresh server note/);
  assert.equal(input(app).props.value, 'Unsaved draft');
});

test('application changes refresh notes and clear the previous draft and error', async () => {
  const initial = candidate([note('old', 'Old application note')]);
  const app = mount(initial, { addCandidateNote: async () => { throw new Error('Old error'); } });
  draft(app, 'Old draft');
  await submit(app);
  const next = candidate([note('other', 'New application note')], { applied_for_job_id: 'job-2' });
  app.render(next);
  assert.doesNotMatch(text(app.render()), /Old application note|Old error/);
  assert.match(text(app.render()), /New application note/);
  assert.equal(input(app).props.value, '');
});

test('late success or failure from a previous candidate cannot alter the current notes or draft', async () => {
  for (const outcome of ['success', 'failure']) {
    const request = deferred();
    const app = mount(candidate(), { addCandidateNote: () => request.promise });
    draft(app, 'Previous candidate draft');
    const sending = submit(app);
    app.render(candidate([note('current', 'Current candidate note')], { id: 'candidate-2' }));
    draft(app, 'Current candidate draft');
    if (outcome === 'success') request.resolve(note('late', 'Late old note'));
    else request.reject(new Error('Late old error'));
    await sending;
    assert.doesNotMatch(text(app.render()), /Late old note|Late old error/);
    assert.match(text(app.render()), /Current candidate note/);
    assert.equal(input(app).props.value, 'Current candidate draft');
    assert.equal(input(app).props.disabled, false);
  }
});

test('late completion on an old application does not unlock a new application request', async () => {
  const old = deferred(); const current = deferred(); let calls = 0;
  const app = mount(candidate(), { addCandidateNote: () => ++calls === 1 ? old.promise : current.promise });
  draft(app, 'Old request');
  const first = submit(app);
  app.render(candidate([], { applied_for_job_id: 'job-2' }));
  draft(app, 'Current request');
  const second = submit(app);
  old.resolve(note('old', 'Old application response'));
  await first;
  assert.equal(postButton(app).props.disabled, true);
  current.resolve(note('current', 'Current request'));
  await second;
  assert.equal(input(app).props.disabled, false);
  assert.doesNotMatch(text(app.render()), /Old application response/);
});

test('a server refresh during posting cannot duplicate the saved note', async () => {
  const request = deferred();
  const saved = note('saved', 'Unique saved note');
  const app = mount(candidate(), { addCandidateNote: () => request.promise });
  draft(app, saved.content);
  const sending = submit(app);
  app.render(candidate([saved]));
  request.resolve(saved);
  await sending;
  assert.equal(text(app.render()).split(saved.content).length - 1, 1);
});

test('improvements and interview questions render independently under correct labels', () => {
  const data = candidate();
  data.scorecard.suggested_improvements = ['Explain distributed systems experience'];
  data.scorecard.suggested_questions = ['How would you handle retries?'];
  const app = mount(data);
  assert.match(text(region(app, 'Areas for improvement')), /Explain distributed systems experience/);
  assert.doesNotMatch(text(region(app, 'Areas for improvement')), /How would you handle retries/);
  assert.match(text(region(app, 'Suggested interview questions')), /How would you handle retries/);
});

test('questions alone are not labelled as improvements; empty sections are omitted', () => {
  const data = candidate();
  data.scorecard.suggested_questions = ['Describe your testing strategy'];
  const app = mount(data);
  assert.equal(region(app, 'Areas for improvement').length, 0);
  assert.match(text(region(app, 'Suggested interview questions')), /Describe your testing strategy/);
  app.render(candidate());
  assert.equal(region(app, 'Suggested interview questions').length, 0);
  assert.equal(region(app, 'Areas for improvement').length, 0);
});
