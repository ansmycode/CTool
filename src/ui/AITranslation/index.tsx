import React, { useMemo, useState } from "react";
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import type {
  AIProviderId,
  AITranslationFileSelection,
  AITranslationFormValues,
} from "@/types/AITranslation";
import { AI_PROVIDER_PRESETS, LANGUAGE_OPTIONS } from "./providerPresets";
import "./index.css";

type InteractionMessage = {
  type: "info" | "success" | "warning" | "error";
  text: string;
} | null;

const isLocalAddress = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

const AITranslation: React.FC = () => {
  const [form] = Form.useForm<AITranslationFormValues>();
  const [provider, setProvider] = useState<AIProviderId>("openai");
  const [selectedFile, setSelectedFile] =
    useState<AITranslationFileSelection | null>(null);
  const [isSelectingFile, setIsSelectingFile] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [message, setMessage] = useState<InteractionMessage>(null);
  const values = Form.useWatch([], form);

  const preset = useMemo(
    () => AI_PROVIDER_PRESETS.find((item) => item.value === provider)!,
    [provider],
  );

  const hasRequiredValues = Boolean(
    selectedFile?.filePath &&
      values?.baseUrl?.trim() &&
      values?.apiKey?.trim() &&
      values?.model?.trim() &&
      values?.sourceLanguage &&
      values?.targetLanguage &&
      values.sourceLanguage !== values.targetLanguage,
  );

  const handleProviderChange = (providerId: AIProviderId) => {
    const nextPreset = AI_PROVIDER_PRESETS.find(
      (item) => item.value === providerId,
    )!;
    setProvider(providerId);
    setMessage(null);
    form.setFieldsValue({
      baseUrl: nextPreset.baseUrl,
      model: nextPreset.models[0]?.value ?? "",
      apiKey: "",
    });
    setMessage({
      type: "warning",
      text: "服务商已切换，请重新输入 API Key 以确认发送目标。",
    });
  };

  const handleBaseUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (form.getFieldValue("apiKey")) {
      form.setFieldValue("apiKey", "");
      setMessage({
        type: "warning",
        text: "API 地址已修改，请重新输入 API Key 以确认发送目标。",
      });
    }
    form.setFieldValue("baseUrl", event.target.value);
  };

  const handleChooseFile = async () => {
    setIsSelectingFile(true);
    setMessage(null);
    try {
      const result = await window.electronAPI.selectAITranslationJson();
      if (result) setSelectedFile(result);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "选择文件失败。",
      });
    } finally {
      setIsSelectingFile(false);
    }
  };

  const validateConfiguration = async () => {
    await form.validateFields();
    if (!selectedFile) throw new Error("请先选择原始 JSON 文件。");
  };

  const handleTestConnection = async () => {
    try {
      await validateConfiguration();
      setIsTestingConnection(true);
      setMessage({ type: "info", text: "正在连接 AI 服务…" });
      const config = form.getFieldsValue(true) as AITranslationFormValues;
      const result = await window.electronAPI.testAITranslationConnection(config);
      setMessage({
        type: "success",
        text: `连接成功：${result.provider === "deepseek" ? "DeepSeek" : "OpenAI"} / ${result.model}`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "请检查当前配置。",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleStartTranslation = async () => {
    try {
      await validateConfiguration();
      setIsTranslating(true);
      setMessage({ type: "info", text: "正在分批翻译，成功批次会立即保存到工作文件…" });
      const config = form.getFieldsValue(true) as AITranslationFormValues;
      const preparation = await window.electronAPI.startAITranslation(
        selectedFile!.filePath,
        config,
      );
      setSelectedFile(preparation);
      setMessage({
        type: preparation.isComplete ? "success" : "info",
        text: preparation.isComplete
          ? `工作文件已全部完成，已生成纯净翻译 JSON：${preparation.outputFilePath}`
          : `本轮处理结束。已翻译 ${preparation.summary.translated} 条，跳过 ${preparation.summary.skipped} 条，仍有 ${preparation.summary.error + preparation.summary.untranslated} 条待处理。进度已保存在工作文件中。`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "请检查当前配置。",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <Card
      className="ai-translation-card"
      title={
        <div className="ai-translation-title">
          <Typography.Text strong>AI 翻译配置</Typography.Text>
          <Typography.Text type="secondary" className="ai-translation-subtitle">
            将已提取的 JSON 文本翻译为指定语言
          </Typography.Text>
        </div>
      }
    >
      <Form<AITranslationFormValues>
        form={form}
        layout="vertical"
        disabled={isTranslating}
        initialValues={{
          provider: "openai",
          baseUrl: AI_PROVIDER_PRESETS[0].baseUrl,
          model: AI_PROVIDER_PRESETS[0].models[0]?.value,
          sourceLanguage: "日语",
          targetLanguage: "简体中文",
        }}
      >
        <Form.Item label="原始 JSON" className="ai-file-field">
          <Space.Compact block>
            <Input
              size="small"
              readOnly
              value={selectedFile?.filePath ?? ""}
              placeholder="请选择 CTool 已提取的 JSON 文件"
              aria-label="原始 JSON 文件路径"
            />
            <Button
              size="small"
              loading={isSelectingFile}
              disabled={isTranslating || isTestingConnection}
              onClick={handleChooseFile}
            >
              选择文件
            </Button>
          </Space.Compact>
          <Typography.Text type="secondary" className="ai-field-help">
            工作文件和最终译文将自动保存在原始 JSON 所在目录。
          </Typography.Text>
        </Form.Item>

        <Row gutter={[16, 0]}>
          <Col span={8}>
            <Form.Item label="服务商" name="provider" rules={[{ required: true }]}>
              <Select
                size="small"
                options={AI_PROVIDER_PRESETS.map(({ value, label, disabled }) => ({
                  value,
                  label: disabled ? `${label}（暂未接入）` : label,
                  disabled,
                }))}
                onChange={handleProviderChange}
              />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item
              label="API 地址"
              name="baseUrl"
              rules={[
                { required: true, message: "请输入 API 地址" },
                {
                  validator: async (_, value: string) => {
                    if (!value) return;
                    try {
                      const url = new URL(value);
                      if (url.protocol !== "https:" && !isLocalAddress(url.hostname)) {
                        throw new Error("非本地 API 地址必须使用 HTTPS");
                      }
                    } catch (error) {
                      throw new Error(
                        error instanceof Error && error.message.includes("HTTPS")
                          ? error.message
                          : "请输入有效的 API 地址",
                      );
                    }
                  },
                },
              ]}
            >
              <Input
                size="small"
                placeholder={provider === "custom" ? "请输入兼容接口地址" : "API 地址"}
                autoComplete="off"
                onChange={handleBaseUrlChange}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item
              label="API Key"
              name="apiKey"
              rules={[{ required: true, message: "请输入 API Key" }]}
            >
              <Input.Password
                size="small"
                placeholder="仅在本次运行期间使用"
                autoComplete="new-password"
                onChange={() => setMessage(null)}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="模型"
              name="model"
              rules={[{ required: true, message: "请选择或输入模型 ID" }]}
            >
              <AutoComplete
                size="small"
                placeholder="请选择或输入模型 ID"
                options={preset.models}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="源语言" name="sourceLanguage" rules={[{ required: true }]}>
              <Select size="small" showSearch optionFilterProp="label" options={LANGUAGE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="目标语言"
              name="targetLanguage"
              dependencies={["sourceLanguage"]}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator: async (_, value) => {
                    if (value === getFieldValue("sourceLanguage")) {
                      throw new Error("源语言和目标语言不能相同");
                    }
                  },
                }),
              ]}
            >
              <Select size="small" showSearch optionFilterProp="label" options={LANGUAGE_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        {selectedFile?.hasUnfinishedWork && !message && (
          <Alert
            className="ai-interaction-message"
            type="warning"
            showIcon
            message="检测到未完成的翻译进度，将自动继续。"
          />
        )}
        {selectedFile?.hasWorkFile &&
          !selectedFile.hasUnfinishedWork &&
          !message && (
            <Alert
              className="ai-interaction-message"
              type="success"
              showIcon
              message="检测到已完成的工作文件，可重新核对并导出纯净翻译 JSON。"
            />
          )}
        {message && (
          <Alert
            className="ai-interaction-message"
            type={message.type}
            showIcon
            message={message.text}
          />
        )}
        {!selectedFile?.hasWorkFile && !message && (
          <Alert
            className="ai-security-note"
            type="info"
            showIcon
            message="API Key 不会保存到配置文件，关闭 CTool 后将自动清除。"
          />
        )}

        <div className="ai-translation-actions">
          <Typography.Text type="secondary">
            {hasRequiredValues ? "配置已填写，可进行下一步。" : "请先选择文件并完成配置。"}
          </Typography.Text>
          <Space>
            <Button
              size="small"
              disabled={!hasRequiredValues || isTranslating}
              loading={isTestingConnection}
              onClick={handleTestConnection}
            >
              测试连接
            </Button>
            <Button
              size="small"
              type="primary"
              disabled={!hasRequiredValues || isTestingConnection}
              loading={isTranslating}
              onClick={handleStartTranslation}
            >
              {selectedFile?.hasUnfinishedWork
                ? "继续翻译"
                : selectedFile?.hasWorkFile
                  ? "重新导出"
                  : "开始翻译"}
            </Button>
          </Space>
        </div>
      </Form>
    </Card>
  );
};

export default AITranslation;
