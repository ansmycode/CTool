import type { DatabaseTable } from "@/game/database";
export interface WolfCollectionMapping {
  key: string;
  label: string;
  category: string;
  total: number;
  definition: {
    table: number;
    name: string;
    nameField: number;
    nameFieldName: string;
    descriptionField?: number;
    descriptionFieldName?: string;
  };
  inventoryStatus:
    | "basic-system"
    | "candidate"
    | "ambiguous"
    | "unsupported";
  quantityBinding?: {
    kind: 0 | 1;
    table: number;
    tableName: string;
    field: number;
    fieldName: string;
    rowCount: number;
    source: "inline" | "separate";
  };
  writable: boolean;
}
export function discoverCollections(
  userTables: DatabaseTable[],
  variableTables: DatabaseTable[],
): WolfCollectionMapping[];
