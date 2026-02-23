import React from "react";
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

interface LoadingOverlayProps {
  visible: boolean;
  text?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  text = "文本初始化中...",
}) => {
  if (!visible) return null;

  // 自定义旋转图标
  const antIcon = <LoadingOutlined style={{ fontSize: 32 }} spin />;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)", // 半透明遮罩
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999, // 保证在最上层
      }}
    >
      <Spin indicator={antIcon} tip={text} />
    </div>
  );
};

export default LoadingOverlay;