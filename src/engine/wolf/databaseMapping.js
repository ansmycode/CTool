// Pure schema rules: no process addresses, executable versions or game-specific table ids.
import { identifyGold } from "../../electron/wolf/databaseSemantics.js";
const normalize = (s) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-:：┣┗┃┏┓┛┫]/g, "");
function split(name) {
  const m = name.match(/^\s*(【[^】]+】|\[[^\]]+\])\s*(.*)$/);
  return { scope: m ? normalize(m[1]) : "", name: normalize(m ? m[2] : name) };
}
const definitions = {
  items: /^(アイテム|道具|物品|items?)$/,
  weapons: /^(武器|weapons?)$/,
  armors: /^(防具|armou?rs?)$/,
  equipment: /^(装備|装备|裝備|equipment)$/,
};
const holdings = {
  items:
    /^(所持アイテム個数|道具持有数量|物品持有数量|itemcounts?|iteminventory)$/,
  weapons: /^(所持武器個数|武器持有数量|weaponcounts?|weaponinventory)$/,
  armors: /^(所持防具個数|防具持有数量|armou?rcounts?|armou?rinventory)$/,
  equipment:
    /^(所持装備個数|装备持有数量|equipmentcounts?|equipmentinventory)$/,
};
const names =
  /^(アイテム名|武器の名前|防具の名前|装備の名前|名称|名字|道具名|物品名|武器名|防具名|装备名|name|itemname|weaponname|armou?rname|equipmentname)$/;
const descriptions =
  /^(説明文(?:\[2行まで可\])?|(?:武器|防具)の説明\[2行まで可\]|装備の説明|说明|描述|description)$/;
const counts = /^(所持個数|持有数量|数量|count|quantity|ownedcount)$/;
const labels = {
  items: "道具",
  weapons: "武器",
  armors: "防具",
  equipment: "装备",
};
export function discoverCollections(userTables, variableTables) {
  const result = [];
  const basicParty = variableTables.some((t) => t.reason)
    ? undefined
    : identifyGold(variableTables).selected;
  for (const table of userTables) {
    if (table.reason) continue;
    const tag = split(table.name);
    const category = Object.keys(definitions).find((k) =>
      definitions[k].test(tag.name),
    );
    if (!category) continue;
    const nameFields = table.fields.filter(
      (f) => f.type === "string" && names.test(normalize(f.name)),
    );
    if (nameFields.length !== 1) continue;
    // Ambiguous definition groups are not selected by order/id.
    if (
      userTables.filter((t) => {
        const x = split(t.name);
        return x.scope === tag.scope && definitions[category].test(x.name);
      }).length !== 1
    )
      continue;
    const desc = table.fields.filter(
      (f) => f.type === "string" && descriptions.test(normalize(f.name)),
    );
    const candidates = variableTables.filter((t) => {
      const x = split(t.name);
      return (
        !t.reason &&
        x.scope === tag.scope &&
        holdings[category].test(x.name) &&
        t.fieldCount === 1 &&
        t.fields.length === 1 &&
        t.fields[0].type === "number" &&
        counts.test(normalize(t.fields[0].name))
      );
    });
    result.push({
      key: `${category}:${table.id}`,
      label: `${tag.scope ? tag.scope + " · " : ""}${labels[category]}`,
      category,
      definition: {
        table: table.id,
        name: table.name,
        nameField: nameFields[0].id,
        nameFieldName: nameFields[0].name,
        descriptionField: desc.length === 1 ? desc[0].id : undefined,
        descriptionFieldName: desc.length === 1 ? desc[0].name : undefined,
      },
      total: table.rowCount,
      // Schema resemblance alone does not establish row-id semantics or an active game system.
      inventoryStatus:
        candidates.length === 1
          ? basicParty && tag.scope === ""
            ? "basic-system-readonly"
            : "candidate"
          : candidates.length > 1
            ? "ambiguous"
            : "unsupported",
      inventoryCandidate:
        candidates.length === 1
          ? {
              table: candidates[0].id,
              name: candidates[0].name,
              field: candidates[0].fields[0].id,
              fieldName: candidates[0].fields[0].name,
              rows: candidates[0].rowCount,
            }
          : undefined,
      writable: false,
    });
  }
  return result;
}
