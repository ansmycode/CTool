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
    | "basic-system-readonly"
    | "candidate"
    | "ambiguous"
    | "unsupported";
  inventoryCandidate?: {
    table: number;
    name: string;
    field: number;
    fieldName: string;
    rows: number;
  };
  writable: false;
}
export function discoverCollections(
  userTables: DatabaseTable[],
  variableTables: DatabaseTable[],
): WolfCollectionMapping[];
