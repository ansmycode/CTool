import React from "react";
import { Button, Input, message, Modal, Switch, Tag, Typography } from "antd";
import {
  getShortcutRestrictionReason,
  isRiskyGlobalShortcut,
} from "@/game/shortcutPolicy";
import type {
  GameShortcutAction,
  GameShortcutActionId,
  GameShortcutPolicy,
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
  enabled: boolean;
  policy: GameShortcutPolicy;
  onEnabledChange: (enabled: boolean) => void;
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

const characterKeys: Record<string, string> = {
  "+": "Plus",
  "-": "-",
  "=": "=",
  ",": ",",
  ".": ".",
  "/": "/",
  ";": ";",
  "'": "'",
  "[": "[",
  "]": "]",
  "\\": "\\",
  "`": "`",
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
  if (!key) key = characterKeys[event.key];
  if (!key) return null;

  const modifiers = [
    event.ctrlKey ? "CommandOrControl" : null,
    event.altKey ? "Alt" : null,
    event.shiftKey ? "Shift" : null,
    event.metaKey ? "Super" : null,
  ].filter(Boolean);

  return [...modifiers, key].join("+");
}

function displayAccelerator(accelerator?: string): string {
  return accelerator?.replace("CommandOrControl", "Ctrl") ?? "";
}

const ShortcutSettings: React.FC<Props> = ({
  actions,
  bindings,
  registrationResults,
  enabled,
  policy,
  onEnabledChange,
  onBindingChange,
}) => {
  const [modal, modalContextHolder] = Modal.useModal();

  const saveBinding = (
    actionId: GameShortcutActionId,
    accelerator: string,
  ) => {
    onBindingChange(actionId, accelerator);
    message.success(`快捷键 ${displayAccelerator(accelerator)} 已保存`);
  };

  const capture = (
    event: React.KeyboardEvent,
    actionId: GameShortcutActionId,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      (event.currentTarget as HTMLInputElement).blur();
      message.info("已取消快捷键录入");
      return;
    }
    if (
      (event.key === "Backspace" || event.key === "Delete") &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey &&
      !event.metaKey
    ) {
      onBindingChange(actionId, null);
      message.success("快捷键已清除");
      return;
    }

    const accelerator = keyboardEventToAccelerator(event);
    if (!accelerator) {
      if (!modifierKeys.has(event.key)) {
        message.error("当前按键无法识别为全局快捷键，请更换按键");
      }
      return;
    }

    const restrictionReason = getShortcutRestrictionReason(
      policy,
      accelerator,
    );
    if (restrictionReason) {
      message.error(restrictionReason);
      return;
    }

    const duplicate = Object.entries(bindings).find(
      ([id, value]) => id !== actionId && value === accelerator,
    );
    if (duplicate) {
      const duplicateAction = actions.find(({ id }) => id === duplicate[0]);
      message.error(
        `该快捷键已用于“${duplicateAction?.name ?? duplicate[0]}”`,
      );
      return;
    }

    if (isRiskyGlobalShortcut(accelerator)) {
      modal.confirm({
        title: "这个快捷键容易误触",
        content: `${displayAccelerator(accelerator)} 是全局快捷键，可能占用游戏原有按键，也可能在输入文字或操作游戏时误触。是否仍然使用？`,
        okText: "仍然使用",
        cancelText: "重新设置",
        onOk: () => saveBinding(actionId, accelerator),
      });
      return;
    }

    saveBinding(actionId, accelerator);
  };

  return (
    <div className="shortcut-page">
      {modalContextHolder}
      <header className="tool-page-header">
        <div>
          <Typography.Title level={3}>快捷键配置</Typography.Title>
          <Typography.Text type="secondary">
            快捷键全局生效，在游戏窗口中也可直接触发
          </Typography.Text>
        </div>
        <div className="shortcut-master-switch">
          <Typography.Text>{enabled ? "快捷键已启用" : "快捷键已关闭"}</Typography.Text>
          <Switch
            checked={enabled}
            checkedChildren="启用"
            unCheckedChildren="关闭"
            onChange={onEnabledChange}
          />
        </div>
      </header>

      <div className={`shortcut-hint${enabled ? "" : " is-disabled"}`}>
        快捷键全局生效，可能占用游戏或其他软件的原有按键。建议使用 Ctrl、Alt
        参与的组合键；单键等高风险设置会要求二次确认。MV/MZ 的裸 F5
        会触发游戏重载，因此禁止设置。关闭总开关会注销快捷键，但不会删除配置。
      </div>

      <div className="shortcut-list">
        {actions.map((action) => {
          const binding = bindings[action.id];
          const registrationResult = registrationResults[action.id];
          const risky = binding ? isRiskyGlobalShortcut(binding) : false;
          const restrictionReason = binding
            ? getShortcutRestrictionReason(policy, binding)
            : null;
          return (
            <div className="shortcut-row" key={action.id}>
              <div className="shortcut-copy">
                <div className="shortcut-title-line">
                  <Typography.Text strong>{action.name}</Typography.Text>
                  <Tag color={action.category === "开关" ? "blue" : "gold"}>
                    {action.category}
                  </Tag>
                  {risky && <Tag color="red">容易误触</Tag>}
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
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  disabled={!binding}
                  onClick={() => onBindingChange(action.id, null)}
                >
                  清除
                </Button>
                {binding && registrationResult === false && (
                  <Typography.Text className="shortcut-error" type="danger">
                    {restrictionReason ??
                      "注册失败：可能被系统、游戏或其他软件占用"}
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
