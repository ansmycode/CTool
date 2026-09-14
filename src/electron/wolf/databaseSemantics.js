// Semantics of the optional Wolf basic system, not assumptions in the memory reader.
const normalize = value => value.normalize("NFKC").toLowerCase().replace(/[\s_\-:：]/g, "");
const currency = /^(所持金|所持ゴールド|ゴールド|お金|金币|金幣|金钱|金錢|持有金钱|持有金錢|gold|money|currency)$/;
const party = /^(パーティー?情報|パーティー?|队伍信息|隊伍資訊|队伍|隊伍|party|partyinfo|partyinformation)$/;
const archive = /セーブ|引き継ぎ|履歴|初期値|存档|存檔|继承|繼承|历史|歷史|save|history|backup|initial/;
const member = /メンバー\d+|成员\d+|成員\d+|member\d+|actor\d+/;

export function tableCategory(table, kind) {
  const name=normalize(table.name);
  if (/武器|weapon/.test(name)) return kind===0 ? "武器定义候选" : "武器数据候选";
  if (/防具|armor|armour/.test(name)) return kind===0 ? "防具定义候选" : "防具数据候选";
  if (/装備|装备|裝備|equipment/.test(name)) return "装备数据候选";
  if (/アイテム|道具|物品|item/.test(name)) return kind===0 ? "道具定义候选" : "道具持有数据候选";
  return undefined;
}

export function identifyGold(tables) {
  const candidates=[];
  for (const table of tables) {
    if (table.rowCount!==1 || archive.test(normalize(table.name))) continue;
    const members=table.fields.filter(f=>f.type==="number"&&member.test(normalize(f.name))).length;
    for (const field of table.fields) {
      if(field.type!=="number"||!currency.test(normalize(field.name)))continue;
      candidates.push({kind:1,table:table.id,row:0,field:field.id,
        label:`${table.name} / ${field.name}`,tableName:table.name,fieldName:field.name,
        evidence:party.test(normalize(table.name))&&members>=4 ? "basic-system-party" : "currency-label",
      });
    }
  }
  const strong=candidates.filter(c=>c.evidence==="basic-system-party");
  return { candidates, selected:strong.length===1?strong[0]:undefined,
    reason:strong.length>1?"multiple_basic_system_candidates":candidates.length?"gold_candidates_need_confirmation":"gold_semantics_not_recognized" };
}
