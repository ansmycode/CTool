import React, { useState, useEffect } from "react";
import { Table, InputNumber } from "antd";

interface Props {
  ItemsData: any;
  handleGainItem: (id: number, count: number, gainType: string) => void;
}
interface Item {
  id: number;
  name: string;
  playerHasCount: number;
}

const ItemTable: React.FC<Props> = ({ ItemsData, handleGainItem }) => {
  const [listData, setlistData] = useState(ItemsData);
  useEffect(() => {
    setlistData(ItemsData);
  }, [ItemsData]);
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
          defaultValue={count}
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
          onBlur={(e) => handleBlur(record.id, Number(e.target.value), "item")}
          variant="borderless"
        />
      ),
    },
  ];
  return (
    <div>
      <Table
        columns={columns}
        dataSource={listData}
        rowKey="id"
        pagination={false}
        scroll={{ y: "31rem" }} // 设置高度，启用虚拟滚动
        size="small"
      />
    </div>
  );
};

export default ItemTable;
