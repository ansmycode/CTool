import React from "react";
import { Button, Input, message, Tag, Typography } from "antd";
import type {
  GameShortcutAction,
  GameShortcutActionId,
} from "@/game/types";
import type {
  ShortcutBindings,
  ShortcutRegistrationResults,
} from "./types";
import "./index.css";

interface Props {
  actions: GameShortcutAction[];
  bindings: ShortcutBindings;
  registrationResults: ShortcutRegistrationResults;
  onBindingChange: (
    actionId: GameShortcutActionId,
    accelerator: string | null,
  ) => void;
}

const modifierKeys = new Set(["Control", "Alt", "Shift", "Meta"]);
const namedKeys: Record<string, string> = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  " ": "Space",
  Escape: "Escape",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
};

function keyboardEventToAccelerator(event: React.KeyboardEvent): string | null {
  if (modifierKeys.has(event.key)) return null;

  let key = namedKeys[event.key];
  if (!key && /^F(?:[1-9]|1\d|2[0-4])$/.test(event.key)) {
    key = event.key;
  }
  if (!key && /^[a-z0-9]$/i.test(event.key)) {
    key = event.key.toUpperCase();
  }
  if (!key) return null;

  const modifiers = [
    event.ctrlKey ? "CommandOrControl" : null,
    event.altKey ? "Alt" : null,
    event.shiftKey ? "Shift" : null,
    event.metaKey ? "Super" : null,
  ].filter(Boolean);

  if (modifiers.length === 0 && !key.startsWith("F")) return null;
  return [...modifiers, key].join("+");
}

function displayAccelerator(accelerator?: string): string {
  return accelerator?.replace("CommandOrControl", "Ctrl") ?? "";
}

const ShortcutSettings: React.FC<Props> = ({
  actions,
  bindings,
  registrationResults,
  onBindingChange,
}) => {
  const capture = (
    event: React.KeyboardEvent,
    actionId: GameShortcutActionId,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const accelerator = keyboardEventToAccelerator(event);
    if (!accelerator) {
      if (!modifierKeys.has(event.key)) {
        message.warning("请使用 F1–F24，或包含 Ctrl / Alt / Shift 的组合键");
      }
      return;
    }

    const duplicate = Object.entries(bindings).find(
      ([id, value]) => id !== actionId && value === accelerator,
    );
    if (duplicate) {
      message.warning("该快捷键已被其他功能使用");
      return;
    }
    onBindingChange(actionId, accelerator);
  };

  return (
    <div className="shortcut-page">
      <header className="tool-page-header">
        <div>
          <Typography.Title level={3}>快捷键配置</Typography.Title>
          <Typography.Text type="secondary">
            快捷键全局生效，在游戏窗口中也可直接触发
          </Typography.Text>
        </div>
      </header>

      <div className="shortcut-hint">
        点击快捷键输入框后按下组合键。为避免干扰正常输入，仅支持 F1–F24
        或带 Ctrl、Alt、Shift 的组合键。
      </div>

      <div className="shortcut-list">
        {actions.map((action) => {
          const binding = bindings[action.id];
          const registrationResult = registrationResults[action.id];
          return (
            <div className="shortcut-row" key={action.id}>
              <div className="shortcut-copy">
                <div className="shortcut-title-line">
                  <Typography.Text strong>{action.name}</Typography.Text>
                  <Tag color={action.category === "开关" ? "blue" : "gold"}>
                    {action.category}
                  </Tag>
                </div>
                <Typography.Text type="secondary">
                  {action.description}
                </Typography.Text>
              </div>

              <div className="shortcut-engines">
                {action.supportedEngines.map((engine) => (
                  <Tag key={engine}>{engine}</Tag>
                ))}
              </div>

              <div className="shortcut-editor">
                <Input
                  value={displayAccelerator(binding)}
                  placeholder="点击后按键"
                  readOnly
                  status={binding && registrationResult === false ? "error" : ""}
                  onKeyDown={(event) => capture(event, action.id)}
                />
                <Button
                  disabled={!binding}
                  onClick={() => onBindingChange(action.id, null)}
                >
                  清除
                </Button>
                {binding && registrationResult === false && (
                  <Typography.Text className="shortcut-error" type="danger">
                    注册失败或被占用
                  </Typography.Text>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShortcutSettings;
