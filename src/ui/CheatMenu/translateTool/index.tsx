import React, { useState, useEffect } from "react";
import { Button, Space, Tooltip, Modal, notification } from "antd";
import ExtractModal from "@/components/ExtractModal";
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
        gameInfo
      });
      if (newData) setExtractText(newData);
    } catch (e) {
      console.error("错误:" + e);
    }
  };

  window.electronAPI.onBuiltInStatus((res) => {
    if (!res) return;
    setBuiltState(res.status);
  });

  return (
    <div>
      {contextHolder}
      <Space>
        <Button type="primary" onClick={onLoadTranslated}>
          加载翻译文件
        </Button>
        <Tooltip title="内置了基本的无效文本过滤,尽可能减低无效文本带来的性能消耗(实际上根本消耗不了什么性能)">
          <Button
            onClick={handleExtractText}
            type="primary"
            loading={extractLoading}
          >
            提取文本
          </Button>
        </Tooltip>
        <Button type="primary" onClick={() => setBuiltModalShow(true)}>
          自动内嵌文本
        </Button>
      </Space>
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
