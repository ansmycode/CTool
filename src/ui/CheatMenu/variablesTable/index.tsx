import React from "react";
import { Input, Table } from "antd";
import { useGameFeature } from "@/game/GameFeatureContext";
import { TableSearchBar } from "@/ui/CheatMenu/TableSearchBar";
import { useTableDraftValues } from "@/ui/CheatMenu/useTableDraftValues";
import { useTableSearch } from "@/ui/CheatMenu/useTableSearch";
import { useTableScrollY } from "@/ui/CheatMenu/useTableScrollY";

interface Props {
  changeVariables: (id: number, value: string | number) => Promise<void>;
}

interface Item {
  id: number;
  variablesKey: string;
  variablesValue: string | number;
}

const getSearchValues = (item: Item) => [
  item.id,
  item.variablesKey,
  item.variablesValue,
];

const VariablesTable: React.FC<Props> = ({ changeVariables }) => {
  const { data: variables } = useGameFeature("variables");
  const { containerRef, scrollY } = useTableScrollY();
  const { getDraftValue, setDraftValue } =
    useTableDraftValues<string | number>(variables);
  const search = useTableSearch(variables, getSearchValues);

  const handleBlur = (id: number, value: number | string) => {
    if (isNaN(Number(value))) changeVariables(id, value);
    else changeVariables(id, Number(value));
  };

  const columns = [
    { title: "id", dataIndex: "id", ellipsis: true, width: 80 },
    { title: "变量名称", dataIndex: "variablesKey", ellipsis: true },
    {
      title: "变量值",
      dataIndex: "variablesValue",
      width: 120,
      render: (variablesValue: string | number, record: Item) => (
        <Input
          value={getDraftValue(record.id, variablesValue)}
          onChange={(event) =>
            setDraftValue(record.id, event.target.value)
          }
          onBlur={(event) => handleBlur(record.id, event.target.value)}
          variant="borderless"
        />
      ),
    },
  ];

  return (
    <div className="game-table-page">
      <TableSearchBar
        value={search.query}
        placeholder="搜索变量 ID、名称或当前值"
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

export default VariablesTable;
