export interface DatabaseField {
  id: number;
  name: string;
  type: "number" | "string" | "unknown";
}
export interface DatabaseTable {
  id: number;
  name: string;
  rowCount: number;
  fieldCount: number;
  fields: DatabaseField[];
  category?: string;
}
export type DatabaseRequest =
  | { operation: "catalog"; kind: number; start: number; limit: number }
  | {
      operation: "page";
      kind: number;
      table: number;
      start: number;
      limit: number;
      fieldStart: number;
      fieldLimit: number;
    };
export type DatabaseResult =
  | { status: "unavailable"; reason: string }
  | {
      status: "available";
      kind: number;
      total: number;
      tables: DatabaseTable[];
    }
  | {
      status: "available";
      kind: number;
      table: number;
      name: string;
      total: number;
      fieldCount: number;
      fields: DatabaseField[];
      rows: { id: number; name: string; values: (number | string | null)[] }[];
    };
export interface DatabaseCellRef {
  kind: number;
  table: number;
  row: number;
  field: number;
}
export interface GoldWriteExpectation {
  value: number;
  source: DatabaseCellRef;
}
export interface GameCollection {
  key: string;
  label: string;
  total: number;
  inventoryStatus: string;
  writable?: boolean;
}
export interface GameCollectionAccess {
  list(): Promise<GameCollection[]>;
  page(
    key: string,
    start: number,
  ): Promise<{
    total: number;
    rows: {
      id: number;
      name: string;
      description: string;
      owned?: number;
      ownedReason?: string;
      writable?: boolean;
      inventoryTarget?: DatabaseCellRef;
    }[];
  }>;
  setCount(target: DatabaseCellRef, expected: number, value: number): Promise<void>;
}
export interface GoldCandidate extends DatabaseCellRef {
  label: string;
  evidence: string;
  tableName?: string;
  fieldName?: string;
}
export interface GameDatabaseAccess {
  read(request: DatabaseRequest): Promise<DatabaseResult>;
  selectGoldSource(target: DatabaseCellRef | null): Promise<void>;
}
