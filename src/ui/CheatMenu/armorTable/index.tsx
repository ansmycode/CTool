import React, { useState, useEffect } from "react";
import { Table, InputNumber } from "antd";
import { useTableScrollY } from "@/ui/CheatMenu/useTableScrollY";

interface Props {
  ArmorsData: any;
  handleGainItem: (id: number, count: number, gainType: string) => void;
}
interface Item {
  id: number;
  name: string;
  playerHasCount: number;
}

const ArmorTable: React.FC<Props> = ({ ArmorsData, handleGainItem }) => {
  const { containerRef, scrollY } = useTableScrollY();
  const [listData, setlistData] = useState(ArmorsData);
  useEffect(() => {
    setlistData(ArmorsData);
  }, [ArmorsData]);
  const handleBlur = (id: number, count: number, gainType: string) => {
    try {
      handleGainItem(id, count, gainType);
    } catch (error) {
      throw error;
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 80,
    },
    {
      title: "名称",
      dataIndex: "name",
      ellipsis: true,
    },
    {
      title: "已拥有数量",
      dataIndex: "playerHasCount",
      width: 120,
      render: (count: number, record: Item) => (
        <InputNumber
          max={99}
          min={0}
          value={count}
          precision={0}
          onChange={(value) => {
            setlistData((prev: any[]) =>
              prev.map((item) =>
                item.id === record.id
                  ? { ...item, playerhascount: value }
                  : item
              )
            );
          }}
          onBlur={(e) => handleBlur(record.id, Number(e.target.value), "armor")}
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

export default ArmorTable;
