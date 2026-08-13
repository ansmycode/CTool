import React, { useState, useEffect } from "react";
import { Table, Input } from "antd";
import { useTableScrollY } from "@/ui/CheatMenu/useTableScrollY";

interface Props {
  variables: any;
  changeVariables: (id: number, value: string | number) => Promise<void>;
}
interface Item {
  id: number;
  variablesKey: string;
  variablesValue: string | number;
}

const VariablesTable: React.FC<Props> = ({ variables, changeVariables }) => {
  const { containerRef, scrollY } = useTableScrollY();
  const [listData, setlistData] = useState(variables);
  useEffect(() => {
    setlistData(variables);
  }, [variables]);
  const handleBlur = (id: number, value: number | string) => {
    if (isNaN(Number(value))) {
      changeVariables(id, value);
    } else {
      changeVariables(id, Number(value));
    }
  };

  const columns = [
    {
      title: "id",
      dataIndex: "id",
      ellipsis: true,
      width: 80,
    },
    {
      title: "变量名称",
      dataIndex: "variablesKey",
      ellipsis: true,
    },
    {
      title: "变量值",
      dataIndex: "variablesValue",
      width: 120,
      render: (variablesValue: number, record: Item) => (
        <Input
          defaultValue={variablesValue}
          onChange={(value) => {
            setlistData((prev: any[]) =>
              prev.map((item) =>
                item.id === record.id
                  ? { ...item, variablesValue: value }
                  : item
              )
            );
          }}
          onBlur={(e) => handleBlur(record.id, e.target.value)}
          variant="borderless"
        />
      ),
    },
  ];
  return (
    <div ref={containerRef} className="table-container">
      <Table
        columns={columns}
        dataSource={listData}
        rowKey="id"
        pagination={false}
        scroll={{ y: scrollY }}
        size="small"
      />
    </div>
  );
};

export default VariablesTable;
