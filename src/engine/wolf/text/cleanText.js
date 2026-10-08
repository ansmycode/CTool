import { stripTextControlCodes } from '../../text/cleanText.js';

// Also implemented in native/wolf/text_dictionary.h for synchronous game-thread lookup.
export function cleanWolfTextLine(text) {
  return stripTextControlCodes(text).replace(/\\+[A-Za-z]+|\\[|~$]/g, '').trim();
}
