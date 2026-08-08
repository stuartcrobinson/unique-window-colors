import { findNodeAtLocation, JSONPath, parse, ParseError, parseTree, visit } from 'jsonc-parser';

export type WorkspaceSettings = Record<string, unknown>;

const PARSE_OPTIONS = { allowTrailingComma: true, disallowComments: false };

/**
 * VS Code writes a byte order mark whenever `files.encoding` is `utf8bom`, and
 * a BOM is not valid JSON. Every entry point splits it off before parsing and
 * every edit puts it back, so those workspaces are handled instead of skipped.
 */
const BYTE_ORDER_MARK = '﻿';

function splitByteOrderMark(text: string): [string, string] {
  return text.startsWith(BYTE_ORDER_MARK)
    ? [BYTE_ORDER_MARK, text.slice(BYTE_ORDER_MARK.length)]
    : ['', text];
}

/**
 * Read `.vscode/settings.json`, which is JSONC rather than JSON: VS Code accepts
 * comments and trailing commas there and plenty of projects use both.
 *
 * Returns undefined when the text is genuinely damaged. The tolerant parser
 * still yields a value for a truncated file, so the error list — not the value —
 * decides. Callers treat undefined as "leave this file alone", which matters
 * because the alternative is writing over settings we failed to understand.
 */
export function parseSettingsDocument(text: string): WorkspaceSettings | undefined {
  const errors: ParseError[] = [];
  const [, body] = splitByteOrderMark(text);
  const value: unknown = parse(body, errors, PARSE_OPTIONS);
  if (errors.length > 0) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as WorkspaceSettings;
}

/** True when the document carries a line or block comment. */
export function documentHasComments(text: string): boolean {
  let found = false;
  const [, body] = splitByteOrderMark(text);
  visit(body, { onComment: () => { found = true; } }, PARSE_OPTIONS);
  return found;
}

/**
 * True when nothing of the user's remains: no settings and no comments. Comments
 * count because a file trimmed down to `{ // team note }` still holds something
 * worth keeping, and deleting it would throw that away.
 */
export function isDisposableDocument(text: string): boolean {
  const settings = parseSettingsDocument(text);
  return settings !== undefined
    && Object.keys(settings).length === 0
    && !documentHasComments(text);
}

const isHorizontalSpace = (char: string): boolean => char === ' ' || char === '\t';

interface TextRange {
  start: number;
  end: number;
}

/**
 * Offsets of every comment in the document.
 *
 * Finding the comma that separates two properties means stepping over whatever
 * sits between them, and that can include a comment. Asking the parser where
 * the comments are keeps this honest: a `//` inside a string value is not a
 * comment, and only the tokenizer knows the difference.
 */
function findCommentRanges(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  visit(text, {
    onComment: (offset: number, length: number) => {
      ranges.push({ start: offset, end: offset + length });
    },
  }, PARSE_OPTIONS);
  return ranges;
}

/** Offset of the next character that is neither whitespace nor part of a comment. */
function skipTriviaForward(text: string, offset: number, comments: TextRange[]): number {
  let position = offset;
  for (;;) {
    while (position < text.length && /\s/.test(text[position])) { position++; }
    const comment = comments.find(range => range.start === position);
    if (!comment) { return position; }
    position = comment.end;
  }
}

/** Offset of the previous character that is neither whitespace nor part of a comment. */
function skipTriviaBackward(text: string, offset: number, comments: TextRange[]): number {
  let position = offset;
  for (;;) {
    while (position >= 0 && /\s/.test(text[position])) { position--; }
    const comment = comments.find(range => range.end === position + 1);
    if (!comment) { return position; }
    position = comment.start - 1;
  }
}

const isBlank = (text: string, from: number, to: number): boolean =>
  text.slice(from, to).trim().length === 0;

/**
 * Delete one property by splicing out its exact source range.
 *
 * jsonc-parser's own `modify`/`applyEdits` were not usable here: with formatting
 * enabled they reflow untouched siblings (a one-line array gets exploded across
 * lines), and with it disabled they collapse the newline that followed the
 * opening brace. Locating the range and cutting it ourselves leaves every other
 * byte — indentation style, line endings, trailing commas, comments — alone.
 *
 * Returns the text unchanged when the path is absent.
 */
export function deletePropertyAtPath(fullText: string, path: JSONPath): string {
  const [mark, text] = splitByteOrderMark(fullText);
  const root = parseTree(text, [], PARSE_OPTIONS);
  if (!root) {
    return fullText;
  }
  const valueNode = findNodeAtLocation(root, path);
  if (!valueNode?.parent || valueNode.parent.type !== 'property') {
    return fullText;
  }

  const property = valueNode.parent;
  const propertyStart = property.offset;
  const propertyEnd = property.offset + property.length;
  let start = propertyStart;
  let end = propertyEnd;

  // Locate the separating comma. Prefer the one after the property so a
  // surviving earlier sibling keeps its own punctuation; fall back to the one
  // before when this is the last property in the object. The search steps over
  // comments as well as whitespace — stopping at the '/' of a comment would
  // leave the comma behind and turn `{ "a": 1 /* c */, "b": 2 }` into the
  // unparseable `{ /* c */, "b": 2 }`.
  const comments = findCommentRanges(text);
  let commaOffset: number | undefined;
  const nextSignificant = skipTriviaForward(text, propertyEnd, comments);
  if (text[nextSignificant] === ',') {
    commaOffset = nextSignificant;
  } else {
    const previousSignificant = skipTriviaBackward(text, propertyStart - 1, comments);
    if (text[previousSignificant] === ',') {
      commaOffset = previousSignificant;
    }
  }

  // Usually only whitespace separates the property from its comma, so the two
  // are cut as one range and the whole line goes cleanly. When a comment sits
  // in the gap they are cut separately, because that comment may describe a
  // setting that is staying — as in `"editor.fontSize": 14, // my size`.
  let detachedComma: number | undefined;
  if (commaOffset !== undefined) {
    if (commaOffset >= propertyEnd) {
      if (isBlank(text, propertyEnd, commaOffset)) {
        end = commaOffset + 1;
      } else {
        detachedComma = commaOffset;
      }
    } else if (isBlank(text, commaOffset + 1, propertyStart)) {
      start = commaOffset;
    } else {
      detachedComma = commaOffset;
    }
  }

  // When the property owns its lines, take the whole lines, so removal does not
  // leave a blank indented row behind. A comment sharing the line is left alone.
  let lineStart = start;
  while (lineStart > 0 && isHorizontalSpace(text[lineStart - 1])) { lineStart--; }
  if (lineStart === 0 || text[lineStart - 1] === '\n') {
    start = lineStart;
    let lineEnd = end;
    while (lineEnd < text.length && isHorizontalSpace(text[lineEnd])) { lineEnd++; }
    if (text[lineEnd] === '\n') {
      end = lineEnd + 1;
    } else if (text[lineEnd] === '\r' && text[lineEnd + 1] === '\n') {
      end = lineEnd + 2;
    }
  }

  // Apply the later cut first so the earlier one's offsets stay valid.
  const cut = (source: string, from: number, to: number): string =>
    source.slice(0, from) + source.slice(to);
  if (detachedComma === undefined) {
    return mark + cut(text, start, end);
  }
  return detachedComma > end
    ? mark + cut(cut(text, detachedComma, detachedComma + 1), start, end)
    : mark + cut(cut(text, start, end), detachedComma, detachedComma + 1);
}

/**
 * Rename a top-level key in place, keeping its value and surroundings byte for
 * byte. Used by settings migration, where rewriting the whole document would
 * cost the user their comments and formatting.
 *
 * Returns the text unchanged when the key is absent.
 */
export function renameTopLevelKey(fullText: string, oldKey: string, newKey: string): string {
  const [mark, text] = splitByteOrderMark(fullText);
  const root = parseTree(text, [], PARSE_OPTIONS);
  if (!root) {
    return fullText;
  }
  const valueNode = findNodeAtLocation(root, [oldKey]);
  if (!valueNode?.parent || valueNode.parent.type !== 'property') {
    return fullText;
  }

  const keyNode = valueNode.parent.children?.[0];
  if (!keyNode) {
    return fullText;
  }
  return mark
    + text.slice(0, keyNode.offset)
    + JSON.stringify(newKey)
    + text.slice(keyNode.offset + keyNode.length);
}
