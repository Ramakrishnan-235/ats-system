const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const presets = [
  { title: 'Python Developer', department: 'Software Engineering', description: 'Build Python APIs', skills: ['Python', 'SQL'], domain: 'Engineering' },
  { title: 'Product Designer', department: 'Design', description: 'Design useful products', skills: ['Figma'], domain: 'Design' },
];

// Run the actual component handlers, retaining hook state across prop changes.
function mount(file, exportName, api, initialProps = {}) {
  const state = [];
  const dependencies = [];
  const timers = [];
  const navigations = [];
  let props = initialProps;
  let cursor = 0;
  let dirty = false;
  let effects = [];
  const react = {
    useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => {
        const next = typeof value === 'function' ? value(state[index]) : value;
        if (!Object.is(state[index], next)) dirty = true;
        state[index] = next;
      }];
    },
    useEffect: (effect, deps) => {
      const index = cursor++;
      if (!dependencies[index] || deps.some((value, i) => !Object.is(value, dependencies[index][i]))) {
        dependencies[index] = deps;
        effects.push(effect);
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const symbols = new Proxy({}, { get: (_, key) => String(key) });
  const context = {
    exports: {}, setTimeout: callback => timers.push(callback),
    require: name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/navigation') return { useRouter: () => ({ push: url => navigations.push(url) }) };
      if (name === '@/lib/api') return { getErrorMessage: error => error.message, ...api };
      if (name === '@/lib/job-role-presets') return { JOB_ROLE_PRESETS: presets, JOB_ROLE_DOMAINS: ['Engineering', 'Design'] };
      if (name === '@/components/jobs/job-filters') return { DEPARTMENTS: [{ id: 'Software Engineering' }, { id: 'Design' }] };
      return symbols;
    },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, context);
  function render(nextProps = props) {
    props = nextProps;
    for (let attempt = 0; attempt < 10; attempt++) {
      cursor = 0; dirty = false; effects = [];
      const tree = context.exports[exportName](props);
      effects.forEach(effect => effect());
      if (!dirty) return tree;
    }
    throw new Error('Component did not settle');
  }
  return { render, timers, navigations };
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
const field = (app, id) => nodes(app.render(), node => node.props?.id === id)[0];
const submit = app => nodes(app.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
const publish = app => nodes(app.render(), node => node.type === 'button' && text(node).includes('Publish Requisition'))[0].props.onClick();
const modal = (api, props = {}) => mount('components/jobs/create-job-modal.tsx', 'CreateJobModal', api, { open: true, onOpenChange() {}, ...props });

test('studio publishes the edited skill chips and navigates only after successful creation', async () => {
  let payload;
  const app = mount('app/jobs/new/page.tsx', 'default', { createJobRequisition: async input => { payload = input; } });
  const chip = nodes(app.render(), node => node.type === 'span' && Array.isArray(node.props.children) && text(node.props.children[0]) === 'eBPF Trace Tooling')[0];
  nodes(chip, node => node.type === 'button')[0].props.onClick();
  nodes(app.render(), node => node.type === 'button' && text(node).includes('Add Preferred Skill'))[0].props.onClick();
  const input = nodes(app.render(), node => node.type === 'input' && node.props.placeholder === 'Skill name...')[0];
  input.props.onChange({ target: { value: ' PostgreSQL ' } });
  nodes(app.render(), node => node.type === 'input' && node.props.placeholder === 'Skill name...')[0].props.onKeyDown({ key: 'Enter' });
  await publish(app);
  assert.deepEqual(Array.from(payload.required_skills), ['Rust (Systems FFI)', 'Multi-cloud Terraform', 'PostgreSQL']);
  assert.match(text(app.render()), /Requisition Published/);
  assert.deepEqual(app.navigations, []);
  app.timers.forEach(callback => callback());
  assert.deepEqual(app.navigations, ['/jobs']);
});

test('studio failure displays the server error, preserves edits, and never redirects', async () => {
  const app = mount('app/jobs/new/page.tsx', 'default', { createJobRequisition: async () => { throw new Error('Backend unavailable'); } });
  await publish(app);
  assert.equal(nodes(app.render(), node => node.props?.role === 'alert').map(text).join(''), 'Backend unavailable');
  assert.doesNotMatch(text(app.render()), /Requisition Published/);
  app.timers.forEach(callback => callback());
  assert.deepEqual(app.navigations, []);
  assert.equal(nodes(app.render(), node => node.type === 'button' && text(node).includes('Publish Requisition'))[0].props.disabled, false);
});

test('modal follows changed preset props, keeps edits on ordinary renders, and clears custom drafts', () => {
  const app = modal({}, { preset: presets[0] });
  assert.equal(field(app, 'job-title').props.value, presets[0].title);
  field(app, 'job-title').props.onChange({ target: { value: 'Edited title' } });
  assert.equal(field(app, 'job-title').props.value, 'Edited title');
  app.render({ open: true, preset: presets[1], onOpenChange() {} });
  assert.equal(field(app, 'job-title').props.value, presets[1].title);
  assert.equal(field(app, 'job-department').props.value, presets[1].department);
  assert.equal(field(app, 'job-description').props.value, presets[1].description);
  assert.match(text(app.render()), /Figma/);
  assert.doesNotMatch(text(app.render()), /PythonSQL/);
  app.render({ open: true, onOpenChange() {} });
  assert.equal(field(app, 'job-title').props.value, '');
  assert.equal(field(app, 'job-description').props.value, '');
  field(app, 'job-role-preset').props.onChange({ target: { value: presets[0].title } });
  field(app, 'job-role-preset').props.onChange({ target: { value: '' } });
  assert.equal(field(app, 'job-title').props.value, '');
});

test('reopening the modal starts a fresh draft from the current preset', () => {
  const props = { preset: presets[0], onOpenChange() {} };
  const app = modal({}, props);
  field(app, 'job-title').props.onChange({ target: { value: 'Old draft' } });
  app.render({ ...props, open: false });
  app.render({ ...props, open: true });
  assert.equal(field(app, 'job-title').props.value, presets[0].title);
});

test('modal submits preset edits and explicitly matches the saved job before closing', async () => {
  const calls = [];
  const saved = { id: 'job-1', title: 'Edited title', job_description: 'Saved description' };
  const app = modal({
    createJobRequisition: async input => { calls.push(['create', input]); return saved; },
    evaluateJobMatching: async input => { calls.push(['match', input]); },
  }, { preset: presets[0], onJobCreated: job => calls.push(['created', job]), onOpenChange: open => calls.push(['open', open]) });
  field(app, 'job-title').props.onChange({ target: { value: 'Edited title' } });
  await submit(app);
  assert.deepEqual(calls.map(call => call[0]), ['create', 'created', 'match', 'open']);
  assert.equal(calls[0][1].title, 'Edited title');
  assert.deepEqual(Array.from(calls[0][1].required_skills), ['Python', 'SQL']);
  assert.equal('run_ai_match' in calls[0][1], false);
  assert.equal(calls[2][1].job_id, saved.id);
  assert.equal(calls[2][1].job_description, saved.job_description);
  assert.equal(calls[3][1], false);
});

test('creation failure keeps the modal open and does not start matching', async () => {
  const app = modal({
    createJobRequisition: async () => { throw new Error('Invalid job'); },
    evaluateJobMatching: () => assert.fail('must not match an unsaved job'),
  }, { onOpenChange: () => assert.fail('must not close on failure') });
  await submit(app);
  assert.match(text(app.render()), /Invalid job/);
});

test('matching failure retries the saved job without duplicate creation or callbacks', async () => {
  let creates = 0; let matches = 0; let createdCallbacks = 0; let closed = false;
  const app = modal({
    createJobRequisition: async () => { creates++; return { id: 'saved-job', title: 'Saved job', job_description: 'Description' }; },
    evaluateJobMatching: async () => { if (++matches === 1) throw new Error('AI unavailable'); },
  }, { onJobCreated: () => createdCallbacks++, onOpenChange: () => { closed = true; } });
  await submit(app);
  assert.equal(closed, false);
  assert.match(text(app.render()), /Job created, but matching failed: AI unavailable/);
  assert.equal(nodes(app.render(), node => node.type === 'fieldset')[0].props.disabled, true);
  await submit(app);
  assert.equal(creates, 1);
  assert.equal(matches, 2);
  assert.equal(createdCallbacks, 1);
  assert.equal(closed, true);
});

test('disabling AI matching saves and closes without sending candidate data for evaluation', async () => {
  let closed = false;
  const app = modal({
    createJobRequisition: async () => ({ id: 'job-1' }),
    evaluateJobMatching: () => assert.fail('matching is disabled'),
  }, { onOpenChange: () => { closed = true; } });
  field(app, 'ai-match-toggle').props.onCheckedChange(false);
  await submit(app);
  assert.equal(closed, true);
});
