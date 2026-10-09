import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Alert, Tabs } from "antd";
import LoadingOverlay from "@/components/LoadingOverlay";
import { useGameFeatures } from "@/game/useGameFeatures";
import type { GameCollection } from "@/game/database";
import type { GameSessionSnapshot } from "@/types/GameSession";
import WolfBaseFeaturesPage from "./base/WolfBaseFeaturesPage";
import CollectionBrowser from "./inventory/CollectionBrowser";
import WolfVariablesPage from "./variables/WolfVariablesPage";
import WolfTranslationPage from "./translation/WolfTranslationPage";
import "../index.css";
import ShortcutSettings from '../shared/shortcuts';
import useGameShortcuts from '../shared/shortcuts/useGameShortcuts';

const DatabaseBrowser = import.meta.env.DEV
  ? lazy(() => import("@/ui/Main/DatabaseBrowser"))
  : null;

interface WolfCheatMenuProps {
  session: GameSessionSnapshot;
  gameInfo: any;
}

const isDatabaseStartingError = (error: unknown) =>
  /database_not_ready|数据库尚未初始化/.test(
    String(error instanceof Error ? error.message : error),
  );

/** Wolf owns its own loading and refresh lifecycle; it has no MV/MZ feature tabs. */
export default function WolfCheatMenu({ session, gameInfo }: WolfCheatMenuProps) {
  const [activeKey, setActiveKey] = useState("runtime");
  const [groups, setGroups] = useState<GameCollection[]>([]);
  const [collectionError, setCollectionError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [runtimeRefreshToken, setRuntimeRefreshToken] = useState(0);
  const [initialization, setInitialization] = useState<
    { sessionId?: string; state: "loading" | "ready" | "failed" }
  >({ state: "loading" });
  const { database, collections, runtime, textTranslation, setRuntimeGold, shortcutActions, shortcutPolicy, executeShortcutAction } = useGameFeatures(
    gameInfo.engine,
    session.sessionId,
    session.capabilities,
  );
  const shortcuts = useGameShortcuts({ engine: 'wolf', sessionId: session.sessionId,
    ready: !!session.runtimeAvailable && session.processState === 'running',
    actions: shortcutActions, policy: shortcutPolicy, execute: async actionId => {
      await executeShortcutAction(actionId);
      setRuntimeRefreshToken(token => token + 1);
    } });
  const databaseReady = !!session.databaseReadOnly;
  const initializing =
    databaseReady &&
    (initialization.sessionId !== session.sessionId ||
      initialization.state === "loading");

  useEffect(() => {
    if (!collections || !databaseReady) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setGroups([]);
    setCollectionError("");
    setInitialization({ sessionId: session.sessionId, state: "loading" });

    const load = async () => {
      try {
        const nextGroups = await collections.list();
        if (!active) return;
        setGroups(nextGroups);
        setInitialization({ sessionId: session.sessionId, state: "ready" });
        void window.electronAPI.refreshGameTelemetry(session.sessionId);
      } catch (error) {
        if (!active) return;
        if (isDatabaseStartingError(error)) {
          timer = setTimeout(load, 500);
          return;
        }
        setCollectionError(
          String(error instanceof Error ? error.message : error),
        );
        setInitialization({ sessionId: session.sessionId, state: "failed" });
      }
    };

    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [collections, databaseReady, session.sessionId]);

  const refreshRuntime = useCallback(() => {
    if (!databaseReady || !session.sessionId) return;
    void window.electronAPI.refreshGameTelemetry(session.sessionId);
    if (activeKey.startsWith("collection:"))
      setRefreshToken((current) => current + 1);
  }, [activeKey, databaseReady, session.sessionId]);

  useEffect(() => {
    if (!databaseReady) return;
    window.addEventListener("focus", refreshRuntime);
    return () => window.removeEventListener("focus", refreshRuntime);
  }, [databaseReady, refreshRuntime]);

  useEffect(() => {
    refreshRuntime();
  }, [activeKey, refreshRuntime]);

  const items = [
    ...(database
      ? [
          {
            key: "runtime",
            label: "基础功能",
            className: "tab-pane-fullheight",
            children: (
              <WolfBaseFeaturesPage
                session={session}
                access={database}
                onWrite={setRuntimeGold}
                runtime={runtime}
                active={activeKey === "runtime"}
                refreshToken={runtimeRefreshToken}
              />
            ),
          },
        ]
      : []),
    ...(runtime ? [{ key: "variables", label: "数值变量", className: "tab-pane-fullheight",
      children: <WolfVariablesPage key={session.sessionId} access={runtime} active={activeKey === "variables"} enabled={!!session.runtimeAvailable} />,
    }] : []),
    ...groups.map((group) => ({
      key: `collection:${group.key}`,
      label: group.label,
      className: "tab-pane-fullheight",
      children: collections ? (
        <CollectionBrowser
          access={collections}
          group={group}
          active={activeKey === `collection:${group.key}`}
          writeEnabled={!!session.inventoryWritable}
          refreshToken={refreshToken}
        />
      ) : null,
    })),
    {
      key: "translation",
      label: "翻译",
      className: "tab-pane-fullheight",
      children: <WolfTranslationPage key={session.sessionId} access={textTranslation} restore={session.translationRestore} />,
    },
    ...(import.meta.env.DEV && database && DatabaseBrowser
      ? [
          {
            key: "database",
            label: "数据库调试（DEV）",
            className: "tab-pane-fullheight",
            children: (
              <Suspense fallback={null}>
                <div className="runtime-page">
                  <DatabaseBrowser access={database} />
                </div>
              </Suspense>
            ),
          },
        ]
      : []),
    { key: 'shortcuts', label: '快捷键', className: 'tab-pane-fullheight', children: <ShortcutSettings
      actions={shortcutActions} bindings={shortcuts.bindings} registrationResults={shortcuts.registrationResults}
      enabled={shortcuts.enabled} policy={shortcutPolicy} onEnabledChange={shortcuts.setEnabled} onBindingChange={shortcuts.setBinding} /> },
  ];

  return (
    <div className="cheat-menu">
      {shortcuts.contextHolder}
      {collectionError && (
        <div className="wolf-collection-error">
          物品识别失败：{collectionError}（重新连接游戏后重试）
        </div>
      )}
      <LoadingOverlay
        visible={activeKey !== "translation" && (!databaseReady || initializing) && !session.runtimeAvailable}
        text="正在初始化游戏数据库与物品资料…"
      />
      {activeKey !== "translation" && initializing && session.runtimeAvailable && <Alert type="info" message="正在加载物品资料，基础功能与数值变量可独立使用。" />}
      <Tabs
        className="cheat-menu-tabs"
        activeKey={activeKey}
        items={items}
        onChange={setActiveKey}
        type="card"
      />
    </div>
  );
}
