const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/components/layout/api-session.tsx'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const savedSession = { user: { tenant_id: 'real-workspace' }, workspaces: [] };
class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// Exercise component transitions without a browser or additional test dependencies.
function mount(env = {}, overrides = {}) {
  const state = [];
  let cursor = 0;
  let mounted = false;
  const effects = [];
  const listeners = new Map();
  const api = {
    ApiError, legacyBackend: false, requiresApiKey: false,
    fetchSession: async () => { throw new ApiError('Unauthorized', 401); },
    fetchAuthConfig: async () => ({ registration_enabled: true }),
    signIn: async () => {}, registerWorkspace: async () => {}, signOut: async () => {},
    setSessionApiKey: () => {}, getErrorMessage: error => error.message,
    ...overrides,
  };
  const react = {
    createContext: value => ({ value, Provider: 'provider' }),
    useContext: context => context.value,
    useState: initial => {
      const index = cursor++;
      if (!mounted) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    },
    useEffect: effect => { if (!mounted) effects.push(effect); },
  };
  const jsx = (type, props) => ({ type, props });
  const context = {
    exports: {}, process: { env },
    window: {
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => listeners.delete(name),
    },
    require: name => name === 'react' ? react : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : api,
  };
  vm.runInNewContext(code, context);
  function render() {
    cursor = 0;
    const tree = context.exports.ApiSession({ children: 'protected content' });
    if (!mounted) {
      mounted = true;
      effects.forEach(effect => effect());
    }
    return tree;
  }
  const initial = render();
  return {
    initial, render, api, listeners,
    defaultSession: context.exports.useSession().session,
    settle: () => new Promise(resolve => setImmediate(resolve)),
  };
}

function nodes(tree, type) {
  if (tree == null || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}

test('unset, false, and non-literal true values require sign-in after an anonymous session check', async () => {
  for (const value of [undefined, 'false', 'TRUE', '1']) {
    const app = mount({ NEXT_PUBLIC_DISABLE_LOGIN: value });
    assert.equal(app.defaultSession, null);
    assert.equal(nodes(app.initial, 'provider').length, 0);
    assert.match(app.initial.props.children, /Loading/);
    await app.settle();
    assert.equal(nodes(app.render(), 'form').length, 1);
    assert.equal(nodes(app.render(), 'provider').length, 0);
  }
});

test('existing sessions resume and expiration returns to sign-in', async () => {
  const app = mount({}, { fetchSession: async () => savedSession });
  await app.settle();
  assert.equal(app.render().props.value.session, savedSession);
  app.listeners.get('ats-session-expired')();
  assert.equal(nodes(app.render(), 'form').length, 1);
  assert.match(nodes(app.render(), 'p').find(node => node.props.role === 'alert').props.children, /expired/);
});

test('backend connection failures show the login form with an error', async () => {
  const app = mount({}, { fetchSession: async () => { throw new Error('Cannot reach backend'); } });
  await app.settle();
  assert.equal(nodes(app.render(), 'form').length, 1);
  assert.match(nodes(app.render(), 'p').find(node => node.props.role === 'alert').props.children, /Cannot reach backend/);
});

test('sign-in and registration require a confirmed session; sign-out closes the gate', async () => {
  for (const registering of [false, true]) {
    let connected = false;
    let called = '';
    const app = mount({}, {
      fetchSession: async () => { if (connected) return savedSession; throw new ApiError('Unauthorized', 401); },
      signIn: async () => { called = 'login'; connected = true; },
      registerWorkspace: async () => { called = 'register'; connected = true; },
    });
    await app.settle();
    if (registering) nodes(app.render(), 'button').find(node => node.props.type === 'button').props.onClick();
    await nodes(app.render(), 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.equal(called, registering ? 'register' : 'login');
    const tree = app.render();
    assert.equal(tree.props.value.session, savedSession);
    await tree.props.value.disconnect();
    assert.equal(nodes(app.render(), 'form').length, 1);
  }
});

test('failed or unconfirmed sign-in never grants a synthetic session', async () => {
  for (const failure of ['credentials', 'missing-session']) {
    let submitted = false;
    const app = mount({}, {
      signIn: async () => { submitted = true; if (failure === 'credentials') throw new Error('Invalid credentials'); },
      fetchSession: async () => { if (submitted) return null; throw new ApiError('Unauthorized', 401); },
    });
    await app.settle();
    await nodes(app.render(), 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.equal(nodes(app.render(), 'provider').length, 0);
    assert.equal(nodes(app.render(), 'form').length, 1);
    assert.equal(nodes(app.render(), 'p').some(node => node.props.role === 'alert'), true);
  }
});

test('literal true opts into preview and ignores session expiration', async () => {
  const app = mount({ NEXT_PUBLIC_DISABLE_LOGIN: 'true' });
  assert.equal(app.initial.props.value.session.user.tenant_id, 'ws-halden-corp');
  await app.settle();
  app.listeners.get('ats-session-expired')();
  assert.equal(app.render().props.value.session.user.tenant_id, 'ws-halden-corp');
});

test('registration respects backend configuration and legacy API-key gating remains available', async () => {
  const app = mount({}, { fetchAuthConfig: async () => ({ registration_enabled: false }) });
  await app.settle();
  assert.equal(nodes(app.render(), 'button').filter(node => node.props.type === 'button').length, 0);
  let key;
  const legacy = mount({}, { legacyBackend: true, requiresApiKey: true, setSessionApiKey: value => { key = value; } });
  nodes(legacy.render(), 'input')[0].props.onChange({ target: { value: 'user-key' } });
  await nodes(legacy.render(), 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(key, 'user-key');
  assert.equal(legacy.render().type, 'provider');
  assert.equal(legacy.render().props.value.session, null);
  await legacy.render().props.value.disconnect();
  assert.equal(nodes(legacy.render(), 'form').length, 1);
});
