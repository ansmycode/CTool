import { InputNumber, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { TableSearchBar } from "./TableSearchBar";
import { useTableDraftValues } from "./useTableDraftValues";
import { useTableScrollY } from "./useTableScrollY";
import { useTableSearch } from "./useTableSearch";

export interface WolfInventoryTableRow {
  id: number;
  name: string;
  description: string;
  owned?: number;
  ownedReason?: string;
  writable?: boolean;
}

interface Props {
  rows: WolfInventoryTableRow[];
  onChangeCount?: (id: number, value: number) => void;
  emptyText: string;
}

/** Wolf inventory has different write rules from MV/MZ, so it owns this table. */
export default function WolfInventoryTable({
  rows,
  onChangeCount,
  emptyText,
}: Props) {
  const { containerRef, scrollY } = useTableScrollY();
  const search = useTableSearch(rows, (row) => [
    row.id,
    row.name,
    row.description,
  ]);
  const { getDraftValue, setDraftValue } = useTableDraftValues<number | null>(
    rows,
  );
  const columns: ColumnsType<WolfInventoryTableRow> = [
    { title: "名称", dataIndex: "name", ellipsis: true, width: 260 },
    {
      title: "持有数量",
      dataIndex: "owned",
      width: 130,
      render: (owned: number | undefined, record) => {
        if (owned === undefined)
          return (
            <Tooltip title={record.ownedReason || "库存数据暂不可用"}>
              <span style={{ color: "#8c8c8c" }}>未知 ⓘ</span>
            </Tooltip>
          );
        if (!onChangeCount || !record.writable) return owned;
        return (
          <InputNumber
            min={0}
            max={2147483647}
            precision={0}
            value={getDraftValue(record.id, owned)}
            onChange={(value) => setDraftValue(record.id, value)}
            onBlur={(event) => onChangeCount(record.id, Number(event.target.value))}
            variant="borderless"
          />
        );
      },
    },
    {
      title: "说明",
      dataIndex: "description",
      ellipsis: true,
      render: (value: string) => (
        <Tooltip title={<span style={{ whiteSpace: "pre-wrap" }}>{value}</span>}>
          {value || "—"}
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="game-table-page">
      <TableSearchBar
        value={search.query}
        placeholder="搜索名称或说明"
        filteredCount={search.filteredCount}
        totalCount={search.totalCount}
        onChange={search.setQuery}
      />
      <div ref={containerRef} className="table-container">
        <Table<WolfInventoryTableRow>
          virtual
          className="wolf-inventory-table"
          columns={columns}
          dataSource={search.filteredData}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1000, y: scrollY }}
          size="small"
          locale={{ emptyText }}
        />
      </div>
    </div>
  );
}
