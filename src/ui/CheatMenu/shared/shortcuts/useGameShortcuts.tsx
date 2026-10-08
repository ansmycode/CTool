import { useCallback, useEffect, useRef, useState } from 'react';
import { notification } from 'antd';
import { getShortcutRestrictionReason } from '@/game/shortcutPolicy';
import type { GameShortcutAction, GameShortcutActionId, GameShortcutPolicy } from '@/game/types';
import type { ShortcutBindings, ShortcutRegistrationResults } from './types';

export default function useGameShortcuts({ engine, sessionId, ready, actions, policy, execute }: {
  engine: 'mvmz' | 'wolf'; sessionId: string; ready: boolean;
  actions: GameShortcutAction[]; policy: GameShortcutPolicy;
  execute: (actionId: GameShortcutActionId) => Promise<void>;
}) {
  // Retain the existing MV/MZ storage keys; Wolf has independent settings.
  const suffix = engine === 'wolf' ? ':wolf' : '';
  const bindingsKey = `ctool:shortcut-bindings:v1${suffix}`;
  const enabledKey = `ctool:shortcuts-enabled:v1${suffix}`;
  const [bindings, setBindings] = useState<ShortcutBindings>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(bindingsKey) ?? '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  });
  const [enabled, setEnabled] = useState(() => localStorage.getItem(enabledKey) !== 'false');
  const [registrationResults, setRegistrationResults] = useState<ShortcutRegistrationResults>({});
  const running = useRef(new Set<GameShortcutActionId>());
  const [api, contextHolder] = notification.useNotification();

  useEffect(() => {
    localStorage.setItem(bindingsKey, JSON.stringify(bindings));
    localStorage.setItem(enabledKey, String(enabled));
    const allowed = new Set(actions.filter(action => action.category === '开关' || action.category === '触发').map(action => action.id));
    const blocked: ShortcutRegistrationResults = {};
    const active = enabled && ready ? Object.entries(bindings).flatMap(([id, accelerator]) => {
      const actionId = id as GameShortcutActionId;
      if (!allowed.has(actionId) || typeof accelerator !== 'string' || !accelerator) return [];
      if (getShortcutRestrictionReason(policy, accelerator)) { blocked[actionId] = false; return []; }
      return [{ actionId, accelerator }];
    }) : [];
    let current = true;
    void window.electronAPI.updateGlobalShortcuts(active).then(results => {
      if (!current) return;
      const next = enabled && ready ? { ...blocked, ...results } : {};
      setRegistrationResults(next);
      const failed = actions.filter(action => next[action.id] === false);
      if (failed.length) api.warning({ message: '部分快捷键未能启用', description: `${failed.map(action => action.name).join('、')}：可能是引擎保留键或已被其他软件占用。` });
    }).catch(() => {
      if (!current) return;
      setRegistrationResults({});
      api.error({ message: '快捷键注册失败', description: '无法更新全局快捷键，请重新设置或重启工具。' });
    });
    return () => { current = false; };
  }, [actions, api, bindings, bindingsKey, enabled, enabledKey, policy, ready, sessionId]);

  useEffect(() => () => {
    void window.electronAPI.updateGlobalShortcuts([]).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    let current = true;
    const unsubscribe = window.electronAPI.onReceiveMessage('shortcut-triggered', async (_event, actionId: GameShortcutActionId) => {
      if (!current || !enabled || !ready || running.current.has(actionId)) return;
      const action = actions.find(action => action.id === actionId && (action.category === '开关' || action.category === '触发'));
      if (!action || !bindings[actionId] || registrationResults[actionId] !== true) return;
      running.current.add(actionId);
      try {
        await execute(actionId);
        if (current) api.success({ message: `${action.name}已执行`, duration: 1.5 });
      } catch (error) {
        if (current) api.error({ message: `${action.name}执行失败`, description: error instanceof Error ? error.message : '未知错误' });
      } finally { running.current.delete(actionId); }
    });
    return () => { current = false; unsubscribe(); };
  }, [actions, api, bindings, enabled, execute, ready, registrationResults, sessionId]);

  const setBinding = useCallback((actionId: GameShortcutActionId, accelerator: string | null) => {
    if (!actions.some(action => action.id === actionId && (action.category === '开关' || action.category === '触发'))) return;
    setBindings(current => {
      const next = { ...current };
      if (accelerator) next[actionId] = accelerator;
      else delete next[actionId];
      return next;
    });
  }, [actions]);
  return { bindings, registrationResults, enabled, setEnabled, setBinding, contextHolder };
}
