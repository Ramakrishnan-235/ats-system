const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/candidate/ai-screening-decision.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function candidate(decision = 'ACCEPT', overrides = {}) {
  return { id: 'candidate-1', applied_for_job_id: 'job-1', applied_for_job: 'Rust engineer',
    stage: 'Screening', processing_status: 'COMPLETED', scorecard: {
      evaluation_status: 'COMPLETED', overall_match_score: 30,
      screening_decision: decision, decision_explanation: 'Production Rust ownership meets the essential job requirements.',
      model_version: 'configured-model', evaluated_at: '2026-10-22T10:00:00Z',
    }, ...overrides };
}

function mount(value, api = {}) {
  const state = [], cleanups = [];
  let cursor = 0, updated;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useEffect(effect) {
      const index = cursor++;
      if (!(index in state)) { state[index] = true; cleanups.push(effect()); }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const context = { exports: {}, AbortController, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'lucide-react') return { Sparkles: 'icon' };
    if (name === '@/lib/api') return { getErrorMessage: error => error.message, ...api };
    throw new Error(`Unexpected import ${name}`);
  } };
  vm.runInNewContext(code, context);
  return {
    render() {
      cursor = 0;
      return context.exports.AIScreeningDecision({ candidate: value, onScorecardUpdated: card => { updated = card; } });
    },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); },
    get updated() { return updated; },
  };
}

function text(tree) {
  if (tree == null) return '';
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
function nodes(tree, predicate) {
  if (tree == null || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const button = app => nodes(app.render(), node => node.type === 'button')[0];

for (const [decision, label, why] of [
  ['ACCEPT', 'Accept for screening', 'Why the LLM recommends acceptance'],
  ['REJECT', 'Reject for this job', 'Why the LLM recommends rejection'],
  ['REVIEW', 'Needs review', 'Why the LLM requests review'],
]) {
  test(`shows saved LLM ${decision} and explanation with provenance`, () => {
    const rendered = text(mount(candidate(decision)).render());
    for (const expected of [label, why, 'Production Rust ownership', 'Rust engineer', 'configured-model', '2026-10-22T10:00:00Z']) assert.ok(rendered.includes(expected));
  });
}

test('never infers a decision from a high score or the recruiter stage', () => {
  const value = candidate(null);
  value.stage = 'Rejected'; value.scorecard.overall_match_score = 99;
  const app = mount(value);
  assert.match(text(app.render()), /No LLM explanation was saved/);
  assert.doesNotMatch(text(app.render()), /Why the LLM recommends|Accept for screening|Reject for this job/);
  assert.equal(button(app), undefined);
});

test('failed evaluations and unassigned resumes show honest empty states', () => {
  const failed = candidate(); failed.scorecard.evaluation_status = 'FAILED';
  assert.match(text(mount(failed).render()), /No AI decision was made/);
  const unassigned = mount(candidate(null, { applied_for_job_id: undefined }));
  assert.match(text(unassigned.render()), /Assign this candidate to a job/);
  assert.equal(button(unassigned), undefined);
});

test('generates through the existing LLM evaluation and reloads the saved job scorecard', async () => {
  const calls = [];
  const saved = candidate('REJECT').scorecard;
  const app = mount(candidate(null), {
    evaluateCandidateForJob: async (job, id, options) => { calls.push([job, id]); assert.ok(options.signal); },
    fetchCandidateScorecard: async (id, job) => { calls.push([id, job]); return saved; },
  });
  await button(app).props.onClick();
  assert.deepEqual(calls, [['job-1', 'candidate-1'], ['candidate-1', 'job-1']]);
  assert.equal(app.updated, saved);
});

test('provider failure shows an error and never substitutes an acceptance or rejection', async () => {
  const app = mount(candidate(null), { evaluateCandidateForJob: async () => { throw new Error('LLM unavailable'); } });
  await button(app).props.onClick();
  assert.match(text(app.render()), /LLM unavailable/);
  assert.equal(app.updated, undefined);
  assert.equal(button(app).props.disabled, false);
});

test('switching candidate or application cancels in-flight work and drops late results', async () => {
  let finish, signal, reads = 0;
  const app = mount(candidate(null), {
    evaluateCandidateForJob: (_, __, options) => { signal = options.signal; return new Promise(resolve => { finish = resolve; }); },
    fetchCandidateScorecard: async () => { reads++; return candidate().scorecard; },
  });
  const running = button(app).props.onClick();
  assert.equal(button(app).props.disabled, true);
  app.unmount();
  assert.equal(signal.aborted, true);
  finish();
  await running;
  assert.equal(app.updated, undefined);
  assert.equal(reads, 0);
});
