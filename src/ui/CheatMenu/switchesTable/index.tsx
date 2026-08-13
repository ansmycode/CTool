import React from "react";
import { Table, Switch } from "antd";
import { useTableScrollY } from "@/ui/CheatMenu/useTableScrollY";

interface Props {
  switches: any;
  changeSwitches: (switchId: number, value: boolean) => void;
}
interface Item {
  id: number;
  switchesKey: string;
  switchesValue: boolean;
}

const SwitchesTable: React.FC<Props> = ({ switches, changeSwitches }) => {
  const { containerRef, scrollY } = useTableScrollY();
  const switchChange = (id: number, value: boolean) => {
    changeSwitches(id, value);
  };

  const columns = [
    {
      title: "id",
      dataIndex: "id",
      ellipsis: true,
      width: 80,
    },
    {
      title: "开关名称",
      dataIndex: "switchesKey",
      ellipsis: true,
    },
    {
      title: "打开/关闭",
      dataIndex: "switchesValue",
      width: 120,
      render: (switchesValue: boolean, record: Item) => (
        <Switch
          checkedChildren="开"
          unCheckedChildren="关"
          checked={switchesValue}
          onChange={() => switchChange(record.id, !switchesValue)}
        />
      ),
    },
  ];
  return (
    <div ref={containerRef} className="table-container">
      <Table
        columns={columns}
        dataSource={switches}
        rowKey="id"
        pagination={false}
        scroll={{ y: scrollY }}
        size="small"
      />
    </div>
  );
};

export default SwitchesTable;
