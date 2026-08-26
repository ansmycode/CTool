import React from "react";
import { InputNumber, Table } from "antd";
import { TableSearchBar } from "@/ui/CheatMenu/TableSearchBar";
import { useTableDraftValues } from "@/ui/CheatMenu/useTableDraftValues";
import { useTableSearch } from "@/ui/CheatMenu/useTableSearch";
import { useTableScrollY } from "@/ui/CheatMenu/useTableScrollY";

interface Props {
  WeaponsData: Item[] | undefined;
  handleGainItem: (id: number, count: number, gainType: string) => void;
}

interface Item {
  id: number;
  name: string;
  playerHasCount: number;
}

const getSearchValues = (item: Item) => [item.id, item.name];

const WeaponTable: React.FC<Props> = ({ WeaponsData, handleGainItem }) => {
  const { containerRef, scrollY } = useTableScrollY();
  const { getDraftValue, setDraftValue } =
    useTableDraftValues<number | null>(WeaponsData);
  const search = useTableSearch(WeaponsData, getSearchValues);

  const columns = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "名称", dataIndex: "name", ellipsis: true },
    {
      title: "已拥有数量",
      dataIndex: "playerHasCount",
      width: 120,
      render: (count: number, record: Item) => (
        <InputNumber
          max={99}
          min={0}
          value={getDraftValue(record.id, count)}
          precision={0}
          onChange={(value) => setDraftValue(record.id, value)}
          onBlur={(event) =>
            handleGainItem(record.id, Number(event.target.value), "weapon")
          }
          variant="borderless"
        />
      ),
    },
  ];

  return (
    <div className="game-table-page">
      <TableSearchBar
        value={search.query}
        placeholder="搜索武器 ID 或名称"
        filteredCount={search.filteredCount}
        totalCount={search.totalCount}
        onChange={search.setQuery}
      />
      <div ref={containerRef} className="table-container">
        <Table
          virtual
          columns={columns}
          dataSource={search.filteredData}
          rowKey="id"
          pagination={false}
          scroll={{ x: 720, y: scrollY }}
          size="small"
        />
      </div>
    </div>
  );
};

export default WeaponTable;
