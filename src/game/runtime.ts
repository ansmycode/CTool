export type WolfRuntimeRequest =
  | { operation: "runtime" | "varcatalog" }
  | { operation: "varpage"; group: number; start: number; limit: number }
  | { operation: "varwrite"; group: number; index: number; expected: number; value: number }
  | { operation: "speed"; value: number }
  | { operation: "noclip"; value: boolean };
export interface RuntimeFeature { available: boolean; reason: string }
export interface WolfRuntimeStatus {
  status: "available";
  speed: RuntimeFeature & { value: number };
  noclip: RuntimeFeature & { value: boolean };
  variables: RuntimeFeature;
}
export interface VariableGroup { id: number; count: number; name?: string }
export interface VariableRow { id: number; value: number; name?: string }
export interface VariableCatalog { status: "available"; groups: VariableGroup[] }
export interface VariablePage { status: "available"; group: number; total: number; rows: VariableRow[]; metadataReason?: string }
export type WolfRuntimeResult = WolfRuntimeStatus | VariableCatalog | VariablePage
  | { status: "written"; value: number | boolean } | { status: "unavailable"; reason: string };
export interface GameRuntimeAccess {
  status(): Promise<WolfRuntimeStatus>;
  groups(): Promise<VariableCatalog>;
  page(group: number, start: number, limit: number): Promise<VariablePage>;
  setVariable(group: number, index: number, expected: number, value: number): Promise<void>;
  setSpeed(value: number): Promise<void>;
  setNoclip(value: boolean): Promise<void>;
}
export function runtimeError(reason: string): string {
  const messages: Record<string,string> = {
    pattern_not_found: "当前版本未匹配到功能位置",
    pattern_ambiguous: "功能位置存在多个候选，暂不可用",
    variables_not_ready: "变量尚未初始化，请进入游戏后刷新",
    variables_layout_mismatch: "当前版本的变量结构尚不支持",
    variable_value_conflict: "变量已被游戏改变，请刷新后重新修改",
    variable_write_unconfirmed: "写入结果未确认，请刷新并核对游戏，勿重复提交",
    variables_changed_retry: "游戏数据正在变化，请稍后刷新",
    variable_out_of_range: "变量已不存在，请刷新",
    variable_group_out_of_range: "变量组已不存在，请刷新",
  };
  return messages[reason] ?? reason;
}
