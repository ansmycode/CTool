import React from "react";
import { Card, Typography, Divider, Space } from "antd";
import FAQ from "@/components/FAQ";
import { authorFaqData } from "@/common/common";
import { GithubOutlined, QqOutlined } from "@ant-design/icons";
import "./index.css";

const { Title, Paragraph, Text, Link } = Typography;

const AuthorInfo: React.FC = () => {
  return (
    <div className="author-container">
      <Card className="author-card">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Title level={4}>作者的话</Title>
          <FAQ data={authorFaqData} />
          <Divider />
          
          <Title level={5}>使用说明</Title>
          <Paragraph>
            基本操作跟某Tool是差不多的
          </Paragraph>
          <Divider />

          <Title level={5}>免责声明</Title>
          <Paragraph type="secondary">
            本工具仅供学习与个人研究使用，请勿用于商业用途或违法用途。
          </Paragraph>
          <Divider />

          <Title level={5}>联系 / 反馈</Title>
          <Paragraph>
            <div className="author-contact">
              <Space direction="vertical" size="small">
                <Space>
                  <QqOutlined />
                  <Text>作者 QQ：</Text>
                  <Text copyable>3344505357</Text>
                </Space>

                <Space>
                  <GithubOutlined />
                  <Text>GitHub：</Text>
                  <Link
                    href="https://github.com/ansmycode/CTool.git"
                    target="_blank"
                  >
                    https://github.com/ansmycode/CTool.git
                  </Link>
                </Space>
              </Space>
            </div>
          </Paragraph>
        </Space>
      </Card>
    </div>
  );
};

export default AuthorInfo;
