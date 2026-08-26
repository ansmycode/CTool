import React from "react";
import { Input, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import "./tableSearch.css";

interface Props {
  value: string;
  placeholder: string;
  filteredCount: number;
  totalCount: number;
  onChange: (value: string) => void;
}

export const TableSearchBar: React.FC<Props> = ({
  value,
  placeholder,
  filteredCount,
  totalCount,
  onChange,
}) => (
  <div className="table-search-bar">
    <Input
      allowClear
      prefix={<SearchOutlined />}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
    <Typography.Text type="secondary">
      当前 {filteredCount} / 共 {totalCount} 项
    </Typography.Text>
  </div>
);
