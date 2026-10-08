import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function compile(path) {
  return ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/^import .*;\r?\n/gm, '').replace(/export default /g, '').replace(/export function /g, 'function ');
}
const adapterCode = compile('../../src/game/adapters/wolf.ts');
function adapterFixture() {
  const requests = []; let value = false, available = true;
  const window = { electronAPI: { wolfRuntime: async (session, data) => {
    requests.push([session, data]);
    if (data.operation === 'runtime') return { status: 'available', noclip: { value, available, reason: 'not-supported' } };
    value = data.value; return { status: 'written', value };
  } } };
  const create = new Function('window', 'createWolfTextTranslation', 'createWolfCollections', 'withVariableNames', 'runtimeError', `${adapterCode}; return createWolfAdapter;`)
    (window, () => undefined, () => undefined, runtime => runtime, reason => reason);
  return { create, requests, setValue: next => { value = next; }, setAvailable: next => { available = next; } };
}
test('Wolf exposes only toggleThrough and reads current state on every shortcut', async () => {
  const f = adapterFixture(), adapter = f.create('session-a');
  assert.deepEqual([...adapter.shortcutActions], ['toggleThrough']);
  await adapter.executeShortcutAction('toggleThrough');
  f.setValue(false); // The game changes the switch independently of the tool.
  await adapter.executeShortcutAction('toggleThrough');
  assert.deepEqual(f.requests, [
    ['session-a', { operation: 'runtime' }], ['session-a', { operation: 'noclip', value: true }],
    ['session-a', { operation: 'runtime' }], ['session-a', { operation: 'noclip', value: true }],
  ]);
});
test('unavailable Wolf controls, numeric/unknown actions and missing sessions never write', async () => {
  const f = adapterFixture(), adapter = f.create('session-a'); f.setAvailable(false);
  await assert.rejects(adapter.executeShortcutAction('toggleThrough'), /not-supported/);
  for (const action of ['speed', 'gold', 'setVariable', 'achieveVictory']) await assert.rejects(adapter.executeShortcutAction(action), /不支持/);
  await assert.rejects(f.create().executeShortcutAction('toggleThrough'), /不支持/);
  assert.equal(f.requests.length, 1);
});

const hookCode = compile('../../src/ui/CheatMenu/shared/shortcuts/useGameShortcuts.tsx');
const tick = () => new Promise(resolve => setImmediate(resolve));
function hookFixture(storage = new Map()) {
  const slots = [], updates = [], handlers = new Set(), notices = [];
  let cursor = 0, pending = [];
  const useState = initial => {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
  };
  const useRef = initial => { const i = cursor++; return slots[i] ??= { current: initial }; };
  const useEffect = (fn, deps) => {
    const i = cursor++, prev = slots[i];
    if (!prev || deps.some((dep, j) => !Object.is(dep, prev.deps[j]))) pending.push({ i, fn, deps, cleanup: prev?.cleanup });
  };
  const useCallback = fn => { cursor++; return fn; };
  const window = { electronAPI: {
    updateGlobalShortcuts: async bindings => { updates.push(bindings); return Object.fromEntries(bindings.map(binding => [binding.actionId, true])); },
    onReceiveMessage: (_, handler) => { handlers.add(handler); return () => handlers.delete(handler); },
  } };
  const api = Object.fromEntries(['warning', 'error', 'success'].map(key => [key, notice => notices.push([key, notice])]));
  const hook = new Function('useState', 'useRef', 'useEffect', 'useCallback', 'notification', 'getShortcutRestrictionReason', 'window', 'localStorage', `${hookCode}; return useGameShortcuts;`)
    (useState, useRef, useEffect, useCallback, { useNotification: () => [api, null] }, (policy, key) => policy.blockedKeysWithoutCtrlOrAlt[key], window,
      { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
  return { updates, notices, render(props) {
    cursor = 0; pending = []; const result = hook(props);
    for (const effect of pending) effect.cleanup?.();
    for (const effect of pending) slots[effect.i] = { deps: effect.deps, cleanup: effect.fn() };
    return result;
  }, trigger: action => Promise.all([...handlers].map(handler => handler(null, action))),
  unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}
function config(execute = async () => {}) {
  return { engine: 'wolf', sessionId: 'session-a', ready: true,
    actions: [{ id: 'toggleThrough', category: '开关', name: '穿墙' }],
    policy: { blockedKeysWithoutCtrlOrAlt: {} }, execute };
}
test('Wolf bindings are separate from legacy MV/MZ bindings and exclude non-switch actions', async () => {
  const storage = new Map([
    ['ctool:shortcut-bindings:v1', JSON.stringify({ toggleThrough: 'F6' })],
    ['ctool:shortcut-bindings:v1:wolf', JSON.stringify({ toggleThrough: 'F7', speed: 'F8', achieveVictory: 'F9' })],
  ]);
  const f = hookFixture(storage), props = config(); f.render(props); await tick();
  assert.deepEqual(f.updates[0], [{ actionId: 'toggleThrough', accelerator: 'F7' }]);
  assert.equal(JSON.parse(storage.get('ctool:shortcut-bindings:v1')).toggleThrough, 'F6');
  const mv = hookFixture(storage); mv.render({ ...props, engine: 'mvmz' }); await tick();
  assert.deepEqual(mv.updates[0], [{ actionId: 'toggleThrough', accelerator: 'F6' }]);
});
test('not-ready, disabled and unmounted sessions unregister shortcuts while retaining settings', async () => {
  const storage = new Map([['ctool:shortcut-bindings:v1:wolf', '{"toggleThrough":"F7"}']]);
  const f = hookFixture(storage), props = config(); let result = f.render({ ...props, ready: false }); await tick();
  assert.deepEqual(f.updates.at(-1), []);
  result = f.render(props); await tick(); result.setEnabled(false); f.render(props); await tick();
  assert.deepEqual(f.updates.at(-1), []);
  f.unmount(); await tick(); assert.deepEqual(f.updates.at(-1), []);
  assert.equal(JSON.parse(storage.get('ctool:shortcut-bindings:v1:wolf')).toggleThrough, 'F7');
});
test('shortcut presses suppress overlapping execution and ignore actions outside the catalog', async () => {
  let complete, calls = 0;
  const f = hookFixture(new Map([['ctool:shortcut-bindings:v1:wolf', '{"toggleThrough":"F7"}']]));
  const props = config(() => { calls++; return new Promise(resolve => { complete = resolve; }); });
  f.render(props); await tick(); f.render(props);
  const first = f.trigger('toggleThrough'); await f.trigger('toggleThrough'); await f.trigger('speed');
  assert.equal(calls, 1); complete(); await first;
});
test('session change leaves the new registration active and errors are reported without retries', async () => {
  const f = hookFixture(new Map([['ctool:shortcut-bindings:v1:wolf', '{"toggleThrough":"F7"}']]));
  const props = config(async () => { throw new Error('DLL lost'); });
  f.render(props); await tick(); f.render({ ...props, sessionId: 'session-b' }); await tick();
  assert.deepEqual(f.updates.at(-1), [{ actionId: 'toggleThrough', accelerator: 'F7' }]);
  f.render({ ...props, sessionId: 'session-b' }); await f.trigger('toggleThrough');
  assert.equal(f.notices.filter(([type]) => type === 'error').length, 1);
});
