import type { ReactNode } from "react";
import { InputNumber, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { TableSearchBar } from "./TableSearchBar";
import { useTableSearch } from "./useTableSearch";
import { useTableDraftValues } from "./useTableDraftValues";
import { useTableScrollY } from "./useTableScrollY";

export interface InventoryTableRow {
  id: number;
  name: string;
  playerHasCount?: number;
  description?: string;
  countError?: string;
  countWritable?: boolean;
}
interface Props {
  rows: InventoryTableRow[] | null;
  onChangeCount?: (id: number, count: number) => void;
  searchPlaceholder?: string;
  showId?: boolean;
  showDescription?: boolean;
  maxCount?: number;
  tableClassName?: string;
  toolbar?: ReactNode;
  emptyText?: string;
}
const searchValues = (row: InventoryTableRow) => [
  row.id,
  row.name,
  row.description,
];
/** Shared presentation only: readers, polling and write capabilities belong to the caller. */
export default function InventoryTable({
  rows,
  onChangeCount,
  searchPlaceholder = "搜索 ID、名称或说明",
  showId = true,
  showDescription = false,
  maxCount = 99,
  tableClassName,
  toolbar,
  emptyText,
}: Props) {
  const { containerRef, scrollY } = useTableScrollY();
  const search = useTableSearch(rows, searchValues);
  const { getDraftValue, setDraftValue } = useTableDraftValues<number | null>(
    rows,
  );
  const columns: ColumnsType<InventoryTableRow> = [
    ...(showId ? [{ title: "ID", dataIndex: "id", width: 80 }] : []),
    {
      title: "名称",
      dataIndex: "name",
      ellipsis: true,
      width: showDescription ? 260 : undefined,
    },
    {
      title: "已拥有数量",
      dataIndex: "playerHasCount",
      width: 120,
      render: (count: number | undefined, record) => {
        if (count === undefined)
          return (
            <Tooltip title={record.countError || "库存数据暂不可用"}>
              <span style={{ color: "#8c8c8c" }}>未知 ⓘ</span>
            </Tooltip>
          );
        if (!onChangeCount || record.countWritable === false) return count;
        return (
          <InputNumber
            max={maxCount}
            min={0}
            value={getDraftValue(record.id, count)}
            precision={0}
            onChange={(value) => setDraftValue(record.id, value)}
            onBlur={(event) =>
              onChangeCount(record.id, Number(event.target.value))
            }
            variant="borderless"
          />
        );
      },
    },
    ...(showDescription
      ? [
          {
            title: "说明",
            dataIndex: "description",
            ellipsis: true,
            render: (value: string) => (
              <Tooltip
                title={<span style={{ whiteSpace: "pre-wrap" }}>{value}</span>}
              >
                {value || "—"}
              </Tooltip>
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="game-table-page">
      <TableSearchBar
        value={search.query}
        placeholder={searchPlaceholder}
        filteredCount={search.filteredCount}
        totalCount={search.totalCount}
        onChange={search.setQuery}
      />
      {toolbar}
      <div ref={containerRef} className="table-container">
        <Table<InventoryTableRow>
          virtual
          className={tableClassName}
          columns={columns}
          dataSource={search.filteredData}
          rowKey="id"
          pagination={false}
          scroll={{ x: showDescription ? 1000 : 720, y: scrollY }}
          size="small"
          locale={emptyText ? { emptyText } : undefined}
        />
      </div>
    </div>
  );
}
