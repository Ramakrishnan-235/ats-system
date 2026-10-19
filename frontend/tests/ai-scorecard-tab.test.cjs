const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/candidate/ai-scorecard-tab.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function candidate(overrides = {}) {
  return {
    id: 'candidate-1',
    applied_for_job_id: 'job-1',
    scorecard: {
      overall_match_score: 85,
      match_tier: 'Strong Fit',
      model_version: 'nemotron',
      evaluated_at: '2026-10-18',
      categories: [
        { name: 'Technical Depth', score: 4, max_score: 5, quote: 'Built streaming pipeline' },
        { name: 'System Design', score: 5, max_score: 5, quote: null }
      ],
      risk_flags: ['Some old risk'],
      suggested_improvements: ['Some improvement'],
      suggested_questions: ['Some question?'],
      team_notes: [{ id: '1', content: 'note', author: 'Recruiter', initials: 'R', timestamp: 'Today' }]
    },
    ...overrides,
  };
}

function mount(initialCandidate, api = {}, onSelectCitation) {
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
      const tree = context.exports.AIScorecardTab({ candidate: currentCandidate, onSelectCitation });
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

test('renders overall match score and category breakdowns', () => {
  const app = mount(candidate());
  const renderedText = text(app.render());
  assert.match(renderedText, /85/);
  assert.match(renderedText, /Strong Fit/);
  assert.match(renderedText, /Technical Depth/);
  assert.match(renderedText, /System Design/);
  assert.match(renderedText, /Built streaming pipeline/);
});

test('does NOT render risk flags, areas for improvement, suggested questions, or team notes', () => {
  const app = mount(candidate());
  const renderedText = text(app.render());
  assert.doesNotMatch(renderedText, /RISK FLAGS/);
  assert.doesNotMatch(renderedText, /Some old risk/);
  assert.doesNotMatch(renderedText, /AREAS FOR IMPROVEMENT/);
  assert.doesNotMatch(renderedText, /Some improvement/);
  assert.doesNotMatch(renderedText, /SUGGESTED INTERVIEW QUESTIONS/);
  assert.doesNotMatch(renderedText, /Some question\?/);
  assert.doesNotMatch(renderedText, /TEAM NOTES/);
  assert.doesNotMatch(renderedText, /Post Note/);
  assert.equal(nodes(app.render(), node => node.type === 'textarea').length, 0);
  assert.equal(nodes(app.render(), node => node.type === 'form').length, 0);
});

test('handles citation locate button when quote is present', async () => {
  let selectedCitation = null;
  const citationLocation = { page: 1, text_snippet: 'Built streaming pipeline', bbox: { x: 0, y: 0, width: 10, height: 10 } };
  const app = mount(candidate(), {
    locateCandidateCitation: async () => ({ found: true, location: citationLocation })
  }, (cit) => { selectedCitation = cit; });

  const locateButton = nodes(app.render(), node => node.type === 'button' && text(node).includes('Locate in Resume'))[0];
  assert.ok(locateButton, 'Locate button should be rendered for category with quote');
  await locateButton.props.onClick();
  assert.equal(selectedCitation?.category_name, 'Technical Depth');
});
