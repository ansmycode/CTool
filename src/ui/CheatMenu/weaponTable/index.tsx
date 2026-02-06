import React, { useState, useEffect } from "react";
import { Table, InputNumber } from "antd";

interface Props {
  WeaponsData: any;
  handleGainItem: (id: number, count: number, gainType: string) => void;
}
interface Item {
  id: number;
  name: string;
  playerHasCount: number;
}

const WeaponTable: React.FC<Props> = ({ WeaponsData, handleGainItem }) => {
  const [listData, setlistData] = useState(WeaponsData);
  useEffect(() => {
    setlistData(WeaponsData);
  }, [WeaponsData]);
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
          min={0}
          defaultValue={count}
          precision={0}
          max={99}
          onChange={(value) => {
            setlistData((prev: any[]) =>
              prev.map((item) =>
                item.id === record.id
                  ? { ...item, playerhascount: value }
                  : item
              )
            );
          }}
          onBlur={(e) =>
            handleBlur(record.id, Number(e.target.value), "weapon")
          }
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

export default WeaponTable;
