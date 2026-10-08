import { useMemo, useState } from 'react';
import WolfBaseFeaturesPage from '@/ui/CheatMenu/wolf/base/WolfBaseFeaturesPage';
import type { GameSessionSnapshot } from '@/types/GameSession';
import type { GameDatabaseAccess } from '@/game/database';
import type { GameRuntimeAccess, WolfRuntimeStatus } from '@/game/runtime';

const database: GameDatabaseAccess = {
  read: async () => ({ status: 'unavailable', reason: 'preview' }),
  selectGoldSource: async () => {},
};

/** Isolated UI fixture: never connects to a game or Electron IPC. */
export default function WolfBaseFeaturesPreview() {
  const unavailable = new URLSearchParams(window.location.search).has('unavailable');
  const [gold, setGold] = useState(12800);
  const [speed, setSpeed] = useState(1);
  const [noclip, setNoclip] = useState(false);
  const runtime = useMemo<GameRuntimeAccess>(() => ({
    status: async (): Promise<WolfRuntimeStatus> => ({
      status: 'available', speed: { available: !unavailable, reason: 'pattern_not_found', value: speed },
      noclip: { available: !unavailable, reason: 'pattern_not_found', value: noclip },
      variables: { available: false, reason: 'preview' },
    }),
    groups: async () => ({ status: 'available', groups: [] }),
    page: async group => ({ status: 'available', group, total: 0, rows: [] }),
    setVariable: async () => {},
    setSpeed: async value => { setSpeed(value); },
    setNoclip: async value => { setNoclip(value); },
  }), [speed, noclip, unavailable]);
  const session: GameSessionSnapshot = {
    sessionId: 'wolf-ui-preview', revision: 1, state: 'ready', processState: 'running', capabilities: [], message: '开发预览',
    runtimeAvailable: true, goldWritable: !unavailable,
    game: { title: '开发预览', gamePath: '', engine: 'wolf', version: '预览', supported: true },
    telemetry: { gold: unavailable ? { status: 'unavailable', reason: 'preview' } : {
      status: 'available', value: gold, observedAt: 0,
      source: { kind: 1, table: 0, row: 0, field: 0, label: '预览', evidence: '', mode: 'auto' },
    } },
  };
  return <WolfBaseFeaturesPage session={session} access={database} runtime={runtime} active onWrite={async value => setGold(value)} />;
}
