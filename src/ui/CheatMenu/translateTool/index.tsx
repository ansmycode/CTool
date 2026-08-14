import React, { useState, useEffect } from "react";
import {
  Alert,
  Button,
  Modal,
  notification,
  Select,
  Space,
  Tooltip,
  Typography,
} from "antd";
import ExtractModal from "@/components/ExtractModal";
import AITranslation from "@/ui/AITranslation";
import "./index.css";

interface Props {
  gameInfo: any;
  sendTranslationData(translated: any): Promise<void>;
}
type BuiltState =
  | "warning" // 初始 警告
  | "backup" // 开始备份
  | "backupend" // 备份完成
  | "restore" // 开始还原
  | "restoreend" // 还原完成
  | "builting" // 内嵌中
  | "done" // 完成
  | "error"; // 出错

const TranslateTool: React.FC<Props> = ({ gameInfo, sendTranslationData }) => {
  const [api, contextHolder] = notification.useNotification();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [builtState, setBuiltState] = useState<BuiltState>("warning");
  const [builtModalShow, setBuiltModalShow] = useState<boolean>(false);
  const [extractModalShow, setExtractModalShow] = useState<boolean>(false);
  const [extractLoading, setExtractLoading] = useState<boolean>(false);
  const [extractText, setExtractText] = useState<any[]>([]);
  const [backups, setBackups] = useState<BuiltInBackupInfo[]>([]);
  const [backupDirectory, setBackupDirectory] = useState("");
  const [selectedBackupPath, setSelectedBackupPath] = useState<string>();
  const [currentBackupPath, setCurrentBackupPath] = useState<string | null>(null);
  const [backupListLoading, setBackupListLoading] = useState(false);

  const gameBackupInfo = {
    gamePath: gameInfo.gamePath as string,
    engine: gameInfo.engine as string,
  };
  const builtBusy = ["backup", "restore", "builting"].includes(builtState);

  useEffect(() => {
    if (builtState === "done") {
      const timer = setTimeout(() => clearStates("built"), 2000);
      return () => clearTimeout(timer);
    }
  }, [builtState]);

  const handleExtractText = () => {
    setExtractLoading(true);
    if (extractText.length === 0) {
      getGameText();
    }
    setExtractLoading(false);
    setExtractModalShow(true);
  };

  const handlebuiltIn = async () => {
    try {
      const result = await window.electronAPI.builtInTranslation({
        ...gameBackupInfo,
        currentBackupPath,
      });
      if (result?.status === "success") {
        api.success({ message: "内嵌翻译完成", description: result.message });
      }
    } catch (error) {
      api.error({
        message: "内嵌翻译失败",
        description: error instanceof Error ? error.message : "未知错误",
      });
      setBuiltState("error");
    }
  };

  const refreshBackups = async () => {
    setBackupListLoading(true);
    try {
      const result = await window.electronAPI.listBuiltInBackups(gameBackupInfo);
      setBackups(result.backups);
      setBackupDirectory(result.backupDirectory);
      setSelectedBackupPath((current) =>
        result.backups.some((item) => item.filePath === current)
          ? current
          : result.backups[0]?.filePath,
      );
    } catch (error) {
      api.error({
        message: "无法读取备份列表",
        description: error instanceof Error ? error.message : "未知错误",
      });
    } finally {
      setBackupListLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const result = await window.electronAPI.createBuiltInBackup(gameBackupInfo);
      setCurrentBackupPath(result.backup.filePath);
      setSelectedBackupPath(result.backup.filePath);
      api.success({
        message: "游戏数据已备份",
        description: result.backup.fileName,
      });
      await refreshBackups();
    } catch (error) {
      setBuiltState("error");
      api.error({
        message: "备份失败",
        description: error instanceof Error ? error.message : "未知错误",
      });
    }
  };

  const handleRestoreBackup = () => {
    const selected = backups.find((item) => item.filePath === selectedBackupPath);
    if (!selected) return;
    modalApi.confirm({
      title: "确认还原游戏数据？",
      content: `将使用 ${selected.displayTime} 的备份覆盖当前游戏数据。还原后请重新启动游戏。`,
      okText: "确认还原",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await window.electronAPI.restoreBuiltInBackup(
            gameBackupInfo,
            selected.filePath,
          );
          setCurrentBackupPath(null);
          api.success({ message: "备份已还原", description: selected.fileName });
          await refreshBackups();
        } catch (error) {
          setBuiltState("error");
          api.error({
            message: "还原失败",
            description: error instanceof Error ? error.message : "未知错误",
          });
          throw error;
        }
      },
    });
  };

  const handleOpenBackupDirectory = async () => {
    const result = await window.electronAPI.openPathInFileManager(backupDirectory);
    if (!result.success) {
      api.error({ message: "无法打开备份文件夹", description: result.message });
    }
  };

  const onLoadTranslated = async () => {
    const result: any = await window.electronAPI.loadJson();
    // if (!result) {
    //   api.error({
    //     message: "错误",
    //     description: "未读取到有效文本,请检查你选择的json文件是否有效",
    //   });
    //   return;
    // }
    const res: any = await sendTranslationData(result);
    if (res.success) {
      api.info({
        message: "消息提示",
        description: "已结束加载,请自行确认是否生效",
      });
    } else {
      api.error({
        message: "错误",
        description: `报错信息:${res.error}`,
      });
    }
  };

  const clearStates = (type: string) => {
    if (type === "built") {
      setBuiltState("warning");
      setBuiltModalShow(false);
    } else if (type === "extract") {
    }
  };

  const handleExtractClose = () => {
    setExtractModalShow(false);
  };

  const getGameText = async () => {
    try {
      const newData: any = await window.electronAPI.applyFilters({
        gameInfo,
      });
      if (newData) setExtractText(newData);
    } catch (e) {
      console.error("错误:" + e);
    }
  };

  useEffect(() => {
    return window.electronAPI.onBuiltInStatus((res) => {
      if (!res) return;
      setBuiltState(res.status);
    });
  }, []);

  return (
    <div className="translate-tool">
      {contextHolder}
      <header className="tool-page-header translate-tool-header">
        <div>
          <Typography.Title level={3}>翻译工具</Typography.Title>
          <Typography.Text type="secondary">
            提取、加载或内嵌游戏文本，并使用 AI 生成译文
          </Typography.Text>
        </div>
      </header>
      <div className="translate-tool-actions">
        <Button size="small" onClick={onLoadTranslated}>
          加载翻译文件
        </Button>
        <Tooltip title="注意:未对游戏插件中的文本做兼容">
          <Button
            size="small"
            onClick={handleExtractText}
            loading={extractLoading}
          >
            提取文本
          </Button>
        </Tooltip>
        <Tooltip title="该功能兼容性尚未完善，暂时不可用">
          <Button size="small" disabled>
            自动内嵌文本（暂不可用）
          </Button>
        </Tooltip>
      </div>
      <AITranslation />
      <ExtractModal
        visible={extractModalShow}
        extractText={extractText}
        onClose={handleExtractClose}
        getGameText={getGameText}
        gameInfo={gameInfo}
      ></ExtractModal>
      <Modal
        title="内嵌翻译"
        open={builtModalShow}
        width={680}
        footer={[
          <Button
            key="backup"
            loading={builtState === "backup"}
            disabled={builtBusy}
            onClick={handleCreateBackup}
          >
            备份游戏数据
          </Button>,
          <Button
            key="restore"
            loading={builtState === "restore"}
            disabled={builtBusy || !selectedBackupPath}
            onClick={handleRestoreBackup}
          >
            还原备份
          </Button>,
          <Button
            key="cancel"
            disabled={builtBusy}
            onClick={() => setBuiltModalShow(false)}
          >
            关闭
          </Button>,
          <Button
            key="ok"
            type="primary"
            danger
            loading={builtState === "builting"}
            disabled={builtBusy}
            onClick={handlebuiltIn}
          >
            确认内嵌翻译
          </Button>,
        ]}
        closable={!builtBusy}
        maskClosable={!builtBusy}
        onCancel={() => setBuiltModalShow(false)}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="内嵌会直接修改游戏数据文件，请先确认游戏和存档已经妥善保存。"
          />
          <div>
            <Typography.Text strong>本次备份：</Typography.Text>
            <Typography.Text type={currentBackupPath ? "success" : "secondary"}>
              {currentBackupPath
                ? currentBackupPath.split(/[\\/]/).pop()
                : "尚未备份；确认内嵌时将自动备份"}
            </Typography.Text>
          </div>
          <div>
            <Typography.Text strong>备份位置：</Typography.Text>
            <Typography.Link
              disabled={!backupDirectory}
              onClick={handleOpenBackupDirectory}
              title="点击打开备份文件夹"
            >
              {backupDirectory || "正在读取…"}
            </Typography.Link>
          </div>
          <div>
            <Typography.Text strong>选择还原版本</Typography.Text>
            <Select
              style={{ width: "100%", marginTop: 6 }}
              loading={backupListLoading}
              value={selectedBackupPath}
              placeholder="当前游戏还没有可用备份"
              onChange={setSelectedBackupPath}
              options={backups.map((item, index) => ({
                value: item.filePath,
                label: `${item.displayTime}${index === 0 ? "（最新）" : ""}${item.legacy ? "（旧目录）" : ""}`,
              }))}
            />
          </div>
          {builtState === "backup" && <Typography.Text>正在备份游戏数据…</Typography.Text>}
          {builtState === "restore" && <Typography.Text>正在还原游戏数据…</Typography.Text>}
          {builtState === "builting" && <Typography.Text>正在写入翻译文本…</Typography.Text>}
        </Space>
      </Modal>
      {modalContextHolder}
    </div>
  );
};

export default TranslateTool;
