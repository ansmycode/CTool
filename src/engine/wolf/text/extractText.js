import { cleanWolfTextLine } from './cleanText.js';
// Parsed cache retains source strings. Dictionary keys/values are display text;
// DLL Hooks normalize controls before dictionary lookup. Offsets locate the
// original line for diagnostics, not a direct replacement range for clean text.
const visibleField = /(?:表示名|名称|名前|キャラ名|コマンド名|肩書き|説明|解説|紹介|メッセージ|台詞|セリフ|名字|描述|说明|文本|对话|name|description|message|caption|help\s*text)/iu;
const termsTable = /(?:用語設定|用語集|用語定義|^terms$|^terminology$)/iu;
const internalField = /(?:ファイル|画像|音声|パス|変数|コモン|デバッグ|备注|注释|脚本|路径|file|path|script|debug|memo|comment)/iu;
// String assignments also feed custom dialogue/common-event systems. They are
// not limited to editor metadata; exclude obvious resource references only.
const resourceReference = /^(?:[a-z]:[\\/]|(?:https?|file):\/\/)|[\\/][^\r\n]*\.(?:png|jpe?g|bmp|gif|webp|ogg|wav|mp3|midi?|mps|dat|project)$/iu;
const resourceFilename = /^[^\r\n]+\.(?:png|jpe?g|bmp|gif|webp|ogg|wav|mp3|midi?|mps|dat|project)$/iu;

export function collectWolfText(documents) {
  const dictionary = Object.create(null);
  const locations = Object.create(null);
  const add = (text, location) => {
    if (typeof text !== 'string') return;
    let line = 0;
    for (const match of text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/gu)) {
      if (!match[0]) continue;
      const raw = match[0].replace(/[\r\n]+$/u, '');
      const value = cleanWolfTextLine(raw);
      if (/[\p{L}\p{N}]/u.test(value) && !/^[\d\s.,+-]+$/u.test(value) && !/^(null|undefined)$/i.test(value)) {
        const start = match.index + raw.length - raw.trimStart().length;
        dictionary[value] = value;
        (locations[value] ??= []).push({ ...location, line, start, end: match.index + raw.trimEnd().length });
      }
      line++;
    }
  };
  const commands = (list, base) => {
    for (const command of list ?? []) {
      const commonArguments = command.code === 210;
      const pictureText = command.code === 150 && ((command.intArgs?.[0] >>> 4) & 7) === 2;
      if (![101, 102, 122].includes(command.code) && !commonArguments && !pictureText) continue;
      for (const [argument, text] of (command.stringArgs ?? []).entries()) {
        // Common-event argument zero is the call target, not displayed text.
        if ((commonArguments && argument === 0) || (pictureText && argument !== 0)) continue;
        if ((command.code === 122 || commonArguments) && typeof text === 'string' &&
            (resourceReference.test(text.trim()) || resourceFilename.test(text.trim()))) continue;
        add(text, { ...base, command: command.index, code: command.code, argument });
      }
    }
  };
  for (const { source, kind, data } of documents) {
    if (kind === 'map') {
      for (const event of data.events ?? []) for (const page of event.pages ?? []) {
        commands(page.list, { source, event: event.id, page: page.id });
      }
    } else if (kind === 'common') {
      commands(data.commands, { source, event: data.id });
    } else if (kind === 'database') {
      for (const [type, table] of (data.types ?? []).entries()) {
        for (const [record, row] of (table.data ?? []).entries()) {
          // Editor record labels and schema descriptions are not game text.
          for (const [field, cell] of (row.data ?? []).entries()) {
            if ((visibleField.test(cell.name) || termsTable.test(table.name)) && !internalField.test(cell.name)) {
              add(cell.value, { source, type, record, field, fieldName: cell.name });
            }
          }
        }
      }
    } else if (kind === 'game') {
      for (const field of ['Title', 'TitlePlus', 'StartUpMsg', 'TitleMsg']) add(data[field], { source, field });
    }
  }
  return { dictionary, locations };
}
