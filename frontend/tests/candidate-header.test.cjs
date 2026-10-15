const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/components/candidate/candidate-header.tsx'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const jsx = (type, props) => ({ type, props });
const context = {
  exports: {},
  require: name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/link') return { default: 'a' };
    if (name === 'lucide-react') return { ArrowLeft: 'icon', ArrowRight: 'icon' };
    if (name === '@/components/ui/button') return { Button: 'button' };
    throw new Error(`Unexpected import: ${name}`);
  },
};
vm.runInNewContext(code, context);

function buttons(tree) {
  if (tree == null || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(buttons);
  return [...(tree.type === 'button' ? [tree] : []), ...buttons(tree.props?.children)];
}

function render(stage, onStageChange) {
  return buttons(context.exports.CandidateHeader({ candidate: { stage }, onStageChange }));
}

test('Advance Stage follows every candidate pipeline transition without skipping', () => {
  const sequence = ['New', 'Screening', 'Recruiter Review', 'Interview', 'Offer', 'Hired'];
  for (let index = 0; index < sequence.length - 1; index++) {
    const changes = [];
    const advance = render(sequence[index], stage => changes.push(stage))[1];
    assert.equal(advance.props.disabled, false);
    advance.props.onClick();
    assert.deepEqual(changes, [sequence[index + 1]]);
  }
});

test('terminal, unknown, and missing stages cannot advance or restart the pipeline', () => {
  for (const stage of ['Hired', 'Rejected', 'Withdrawn', 'Custom Stage', 'Interviewing', 'Offered', 'Negotiation', '', undefined]) {
    const changes = [];
    const advance = render(stage, next => changes.push(next))[1];
    assert.equal(advance.props.disabled, true);
    advance.props.onClick();
    assert.deepEqual(changes, []);
  }
});

test('Reject still emits the accepted Rejected stage', () => {
  const changes = [];
  render('Screening', stage => changes.push(stage))[0].props.onClick();
  assert.deepEqual(changes, ['Rejected']);
});

test('Advance Stage is disabled when no update callback is available', () => {
  const advance = render('Screening')[1];
  assert.equal(advance.props.disabled, true);
  assert.doesNotThrow(() => advance.props.onClick());
});
