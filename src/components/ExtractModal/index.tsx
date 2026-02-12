import { useEffect, useState } from "react";
import {
  Modal,
  Table,
  Button,
  Input,
  Space,
  message,
} from "antd";
import { SaveOutlined } from "@ant-design/icons";
// import type { FilterRules } from "@/types/Game";
import "./index.css";
type ExtractedText = {
  id: number;
  original: string;
  filtered: string;
};

type FilterModalProps = {
  visible: boolean;
  onClose: () => void;
  getGameText?: () => Promise<void>;
  extractText: any[];
  gameInfo: any;
};

export default function FilterModal({
  visible,
  onClose,
  extractText,
  gameInfo,
}: FilterModalProps) {
  const [data, setData] = useState<ExtractedText[]>(extractText);
  // const [form] = Form.useForm();

  // useEffect(() => {
  //   if (visible) {
  //     // 默认规则
  //     form.setFieldsValue({
  //       invalid: true,
  //       command: true,
  //       merge: false,
  //       regexList: "",
  //     });
  //   }
  // }, [visible]);

  useEffect(() => {
    setData(extractText);
  }, [extractText]);
  const handleSave = async () => {
    try {
      const _textArr = data.map((item) => item.filtered);
      await window.electronAPI.saveTranslateFile({
        textArr: _textArr,
        gameInfo: gameInfo,
      });
      message.success("保存成功");
      // onClose();
    } catch (e) {
      message.error("保存失败：" + (e as Error).message);
    }
  };

  // const ruleChange = async () => {
  //   try {
  //     const values = await form.validateFields();
  //     const rules: FilterRules = {
  //       invalid: values.invalid || false,
  //       command: values.command || false,
  //       merge: values.merge || false,
  //       regexList: values.regexList
  //         ? values.regexList
  //             .split("\n")
  //             .map((r: string) => r.trim())
  //             .filter(Boolean)
  //         : [],
  //     };

  //     getGameText(rules);
  //   } catch (e) {
  //     console.error(e);
  //   }
  // };

  const remToPx = (rem: number) =>
    rem * parseFloat(getComputedStyle(document.documentElement).fontSize);

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="文本预览"
      width="98%"
      centered
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button onClick={handleSave} icon={<SaveOutlined />} type="primary">
            保存并写入
          </Button>
        </Space>
      }
    >
      <div
      // style={{
      //   display: "flex",
      //   flexDirection: "column",
      //   height: "70vh", // 占视口 70% 高度
      //   padding: "8px",
      // }}
      >
        {/* 过滤规则表单 */}
        {/* <Form form={form} layout="vertical" className="filter-form">
          <Space>
            <Form.Item name="invalid" valuePropName="checked" noStyle>
              <Checkbox onChange={ruleChange}>基本过滤</Checkbox>
            </Form.Item>
            <Form.Item name="command" valuePropName="checked" noStyle>
              <Checkbox onChange={ruleChange}>去除指令符</Checkbox>
            </Form.Item>
            <Form.Item name="merge" valuePropName="checked" noStyle>
              <Checkbox onChange={ruleChange}>整句拼接</Checkbox>
            </Form.Item>
          </Space>
        </Form> */}

        {/* 文本表格 */}
        <Table
          rowKey="id"
          dataSource={data}
          pagination={false}
          size="middle"
          scroll={{ y: remToPx(25) }}
          virtual
          columns={[
            {
              title: "原文本",
              dataIndex: "original",
              key: "original",
              width: "50%",
              render: (text: string) => (
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {text.replace(/\n/g, "\\n")}
                </div>
              ),
            },
            {
              title: "过滤后（可编辑）",
              dataIndex: "filtered",
              key: "filtered",
              width: "50%",
              render: (text: string, record: ExtractedText) => (
                <Input
                  value={text.replace(/\n/g, "\\n")}
                  onChange={(e) => {
                    const val = e.target.value;
                    setData((prev) =>
                      prev.map((r) =>
                        r.id === record.id ? { ...r, filtered: val } : r
                      )
                    );
                  }}
                />
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
}
