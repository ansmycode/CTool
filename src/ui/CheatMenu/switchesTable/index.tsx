import React from "react";
import { Switch, Table } from "antd";
import { TableSearchBar } from "@/ui/CheatMenu/TableSearchBar";
import { useTableDraftValues } from "@/ui/CheatMenu/useTableDraftValues";
import { useTableSearch } from "@/ui/CheatMenu/useTableSearch";
import { useTableScrollY } from "@/ui/CheatMenu/useTableScrollY";

interface Props {
  switches: Item[] | undefined;
  changeSwitches: (switchId: number, value: boolean) => void;
}

interface Item {
  id: number;
  switchesKey: string;
  switchesValue: boolean;
}

const getSearchValues = (item: Item) => [
  item.id,
  item.switchesKey,
  item.switchesValue ? "开 true" : "关 false",
];

const SwitchesTable: React.FC<Props> = ({ switches, changeSwitches }) => {
  const { containerRef, scrollY } = useTableScrollY();
  const { getDraftValue, setDraftValue } =
    useTableDraftValues<boolean>(switches);
  const search = useTableSearch(switches, getSearchValues);

  const columns = [
    { title: "id", dataIndex: "id", ellipsis: true, width: 80 },
    { title: "开关名称", dataIndex: "switchesKey", ellipsis: true },
    {
      title: "打开/关闭",
      dataIndex: "switchesValue",
      width: 120,
      render: (switchesValue: boolean, record: Item) => (
        <Switch
          checkedChildren="开"
          unCheckedChildren="关"
          checked={getDraftValue(record.id, switchesValue)}
          onChange={(checked) => {
            setDraftValue(record.id, checked);
            changeSwitches(record.id, checked);
          }}
        />
      ),
    },
  ];

  return (
    <div className="game-table-page">
      <TableSearchBar
        value={search.query}
        placeholder="搜索开关 ID、名称或状态"
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

export default SwitchesTable;
