import React from "react";
import { Alert, Card, Divider, Space, Typography } from "antd";
import { GithubOutlined, QqOutlined } from "@ant-design/icons";
import FAQ from "@/components/FAQ";
import { authorFaqData } from "@/common/common";
import "./index.css";

const { Title, Paragraph, Text, Link } = Typography;

const AuthorInfo: React.FC = () => {
  return (
    <div className="author-container">
      <Card className="author-card">
        <Alert
          className="author-download-warning"
          type="warning"
          message="CTool 是免费工具，请勿付费购买"
          description="不要信任来历不明的下载源、网盘重新打包版或第三方修改版。目前请以官方 GitHub 仓库中的代码和说明为准。"
        />

        <div className="author-heading">
          <Title level={4}>作者的话</Title>
          <Paragraph type="secondary">
            使用前建议先阅读下面的说明。点击标题即可展开对应内容。
          </Paragraph>
        </div>

        <FAQ data={authorFaqData} />

        <Divider />

        <div className="author-support">
          <Title level={5}>喜欢项目？请给作者点一个 Star</Title>
          <Paragraph>
            如果项目对你有帮助，欢迎在 GitHub 点一个 Star。反馈问题和分享项目也同样是在帮助 CTool 持续完善。
          </Paragraph>
        </div>

        <div className="author-contact">
          <Space size="large" wrap>
            <Space>
              <QqOutlined />
              <Text>QQ：</Text>
              <Text copyable>3344505357</Text>
            </Space>
            <Space>
              <GithubOutlined />
              <Text>GitHub：</Text>
              <Link href="https://github.com/ansmycode/CTool" target="_blank">
                github.com/ansmycode/CTool
              </Link>
            </Space>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default AuthorInfo;
