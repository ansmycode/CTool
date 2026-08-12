import React, { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Tooltip,
  Typography,
} from "antd";
import "./index.css";

type ProviderId = "openai" | "deepseek" | "kimi" | "custom";

interface ProviderOption {
  value: ProviderId;
  label: string;
  baseUrl: string;
}

const PROVIDERS: ProviderOption[] = [
  {
    value: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
  },
  {
    value: "kimi",
    label: "Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
  },
  {
    value: "custom",
    label: "自定义",
    baseUrl: "",
  },
];

const LANGUAGE_OPTIONS = [
  "简体中文",
  "繁体中文",
  "英语",
  "日语",
  "韩语",
  "法语",
  "德语",
  "西班牙语",
].map((language) => ({ value: language, label: language }));

const AITranslation: React.FC = () => {
  const [form] = Form.useForm();
  const [provider, setProvider] = useState<ProviderId>("openai");

  const handleProviderChange = (providerId: ProviderId) => {
    const preset = PROVIDERS.find((item) => item.value === providerId);
    setProvider(providerId);
    form.setFieldsValue({
      baseUrl: preset?.baseUrl ?? "",
      model: undefined,
    });
  };

  return (
    <Card
      className="ai-translation-card"
      title={
        <div className="ai-translation-title">
          <span className="ai-translation-title-mark">AI</span>
          <span>
            <Typography.Text strong>AI 翻译</Typography.Text>
            <Typography.Text type="secondary" className="ai-translation-subtitle">
              将已提取的 JSON 文本翻译为指定语言
            </Typography.Text>
          </span>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          provider: "openai",
          baseUrl: PROVIDERS[0].baseUrl,
          sourceLanguage: "日语",
          targetLanguage: "简体中文",
        }}
      >
        <Form.Item label="原始 JSON" className="ai-file-field">
          <Space.Compact block>
            <Input
              readOnly
              placeholder="请选择 CTool 已提取的 JSON 文件"
              aria-label="原始 JSON 文件路径"
            />
            <Tooltip title="文件选择将在下一步接入">
              <span>
                <Button disabled>选择文件</Button>
              </span>
            </Tooltip>
          </Space.Compact>
          <Typography.Text type="secondary" className="ai-field-help">
            工作文件和最终译文将自动保存在原始 JSON 所在目录。
          </Typography.Text>
        </Form.Item>

        <Row gutter={[16, 0]}>
          <Col xs={24} md={8}>
            <Form.Item label="服务商" name="provider">
              <Select
                options={PROVIDERS.map(({ value, label }) => ({ value, label }))}
                onChange={handleProviderChange}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={16}>
            <Form.Item label="API 地址" name="baseUrl">
              <Input
                placeholder={provider === "custom" ? "请输入兼容接口地址" : "API 地址"}
                autoComplete="off"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}>
            <Form.Item label="API Key" name="apiKey">
              <Input.Password
                placeholder="仅在本次运行期间使用"
                autoComplete="new-password"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="模型" name="model">
              <Select
                disabled
                placeholder="待确定并测试首批模型"
                notFoundContent="首批测试模型尚未确定"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}>
            <Form.Item label="源语言" name="sourceLanguage">
              <Select
                showSearch
                optionFilterProp="label"
                options={LANGUAGE_OPTIONS}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="目标语言" name="targetLanguage">
              <Select
                showSearch
                optionFilterProp="label"
                options={LANGUAGE_OPTIONS}
              />
            </Form.Item>
          </Col>
        </Row>

        <Alert
          className="ai-security-note"
          type="info"
          showIcon
          message="API Key 不会保存到配置文件，关闭 CTool 后将自动清除。"
        />

        <div className="ai-translation-actions">
          <Typography.Text type="secondary">
            请先选择原始 JSON，并完成 AI 配置。
          </Typography.Text>
          <Space>
            <Tooltip title="连接测试将在下一步接入">
              <span>
                <Button disabled>测试连接</Button>
              </span>
            </Tooltip>
            <Tooltip title="翻译逻辑将在后续步骤接入">
              <span>
                <Button type="primary" disabled>
                  开始翻译
                </Button>
              </span>
            </Tooltip>
          </Space>
        </div>
      </Form>
    </Card>
  );
};

export default AITranslation;
