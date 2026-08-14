import React, { useState, useEffect } from "react";
import { Button, Tooltip, Modal, notification, Typography } from "antd";
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
  | "builting" // 内嵌中
  | "done" // 完成
  | "error"; // 出错

const TranslateTool: React.FC<Props> = ({ gameInfo, sendTranslationData }) => {
  const [api, contextHolder] = notification.useNotification();
  const [builtState, setBuiltState] = useState<BuiltState>("warning");
  const [builtModalShow, setBuiltModalShow] = useState<boolean>(false);
  const [extractModalShow, setExtractModalShow] = useState<boolean>(false);
  const [extractLoading, setExtractLoading] = useState<boolean>(false);
  const [extractText, setExtractText] = useState<any[]>([]);

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
    await window.electronAPI.builtInTranslation({
      gamePath: gameInfo.gamePath,
      engine: gameInfo.engine,
    });
    // const res = await window.electronAPI.test();
    // console.log(res);
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
        <Button size="small" onClick={() => setBuiltModalShow(true)}>
          自动内嵌文本
        </Button>
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
        title="⚠️ 风险提示"
        open={builtModalShow}
        footer={[
          <Button key="cancel" onClick={() => setBuiltModalShow(false)}>
            关闭
          </Button>,
          <Button
            key="ok"
            type="primary"
            danger
            disabled={builtState !== "warning"}
            onClick={handlebuiltIn}
          >
            我已知晓风险，继续
          </Button>,
        ]}
        closable={false} // 不允许手动关
      ></Modal>
    </div>
  );
};

export default TranslateTool;
