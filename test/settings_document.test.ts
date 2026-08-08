import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deletePropertyAtPath,
  documentHasComments,
  isDisposableDocument,
  parseSettingsDocument,
  renameTopLevelKey,
} from '../src/settings_document';

describe('parseSettingsDocument', () => {
  it('accepts the JSONC that VS Code allows in settings.json', () => {
    deepStrictEqual(
      parseSettingsDocument('{\n  // a comment\n  "editor.fontSize": 14,\n}'),
      { 'editor.fontSize': 14 },
    );
    deepStrictEqual(parseSettingsDocument('{ /* block */ "a": 1 }'), { a: 1 });
    deepStrictEqual(parseSettingsDocument('{}'), {});
  });

  it('does not treat a comment marker inside a string as a comment', () => {
    deepStrictEqual(
      parseSettingsDocument('{ "url": "https://example.com/x" }'),
      { url: 'https://example.com/x' },
    );
  });

  it('reports damaged files rather than guessing at their contents', () => {
    // The tolerant parser still returns a value for these, so the error list
    // has to be what decides — otherwise a truncated file reads as empty and
    // the caller deletes it.
    equal(parseSettingsDocument('{ "editor.fontSize": '), undefined);
    equal(parseSettingsDocument('{ "a": 1 '), undefined);
    equal(parseSettingsDocument('not json at all'), undefined);
    equal(parseSettingsDocument(''), undefined);
    equal(parseSettingsDocument('[1, 2, 3]'), undefined);
    equal(parseSettingsDocument('"just a string"'), undefined);
  });
});

describe('byte order marks', () => {
  // VS Code writes a BOM whenever files.encoding is utf8bom. A BOM is not valid
  // JSON, so these files used to be skipped exactly like the JSONC ones.
  const BOM = '﻿';

  it('parses a document that starts with a BOM', () => {
    deepStrictEqual(parseSettingsDocument(BOM + '{ "editor.fontSize": 14 }'), { 'editor.fontSize': 14 });
    equal(documentHasComments(BOM + '{\n // note\n}'), true);
  });

  it('keeps the BOM when editing', () => {
    const text = BOM + '{\n  "editor.fontSize": 14,\n  "removeMe": 1\n}\n';
    const result = deletePropertyAtPath(text, ['removeMe']);
    equal(result, BOM + '{\n  "editor.fontSize": 14\n}\n');
    equal(result.startsWith(BOM), true, 'the file encoding must not change');
  });

  it('keeps the BOM when renaming', () => {
    equal(
      renameTopLevelKey(BOM + '{ "old": 1 }', 'old', 'new'),
      BOM + '{ "new": 1 }',
    );
  });

  it('still refuses a BOM followed by damaged content', () => {
    equal(parseSettingsDocument(BOM + '{ "a": '), undefined);
  });
});

describe('documentHasComments', () => {
  it('distinguishes real comments from comment markers inside strings', () => {
    equal(documentHasComments('{ "a": 1 }'), false);
    equal(documentHasComments('{ "url": "https://example.com" }'), false);
    equal(documentHasComments('{\n  // note\n  "a": 1\n}'), true);
    equal(documentHasComments('{ /* note */ "a": 1 }'), true);
  });
});

describe('isDisposableDocument', () => {
  it('treats an empty object as disposable', () => {
    equal(isDisposableDocument('{}'), true);
    equal(isDisposableDocument('{\n}\n'), true);
  });

  it('keeps a file whose only remaining content is a comment', () => {
    equal(isDisposableDocument('{\n  // team note, keep this\n}\n'), false);
  });

  it('keeps a file that still holds settings', () => {
    equal(isDisposableDocument('{ "editor.fontSize": 14 }'), false);
  });

  it('never reports a damaged file as disposable', () => {
    equal(isDisposableDocument('{ "editor.fontSize": '), false);
    equal(isDisposableDocument('garbage'), false);
  });
});

describe('deletePropertyAtPath', () => {
  it('leaves untouched siblings formatted exactly as they were', () => {
    const text = `{
  "workbench.colorCustomizations": { "activityBar.background": "#032F03" },
  "html.customData": ["https://example.com/schema.json"],
  "search.exclude": { "**/node_modules": true, "**/dist": true }
}
`;
    equal(deletePropertyAtPath(text, ['workbench.colorCustomizations']), `{
  "html.customData": ["https://example.com/schema.json"],
  "search.exclude": { "**/node_modules": true, "**/dist": true }
}
`);
  });

  it('preserves comments elsewhere in the document', () => {
    const text = `{
  // A general note about this whole file.
  "workbench.colorCustomizations": {
    "activityBar.background": "#032F03"
  },
  "editor.fontSize": 14
}
`;
    equal(deletePropertyAtPath(text, ['workbench.colorCustomizations']), `{
  // A general note about this whole file.
  "editor.fontSize": 14
}
`);
  });

  it('preserves tab indentation and drops the trailing comma of a last property', () => {
    const text = '{\n\t"editor.fontSize": 19,\n\t"workbench.colorCustomizations": {\n\t\t"activityBar.background": "#032F03"\n\t}\n}\n';
    equal(
      deletePropertyAtPath(text, ['workbench.colorCustomizations']),
      '{\n\t"editor.fontSize": 19\n}\n',
    );
  });

  it('preserves CRLF line endings', () => {
    const text = '{\r\n  "editor.fontSize": 14,\r\n  "workbench.colorCustomizations": { "activityBar.background": "#032F03" }\r\n}\r\n';
    equal(deletePropertyAtPath(text, ['workbench.colorCustomizations']), '{\r\n  "editor.fontSize": 14\r\n}\r\n');
  });

  it('handles a document written on a single line', () => {
    equal(
      deletePropertyAtPath('{ "editor.fontSize": 14, "workbench.colorCustomizations": { "a": 1 } }', ['workbench.colorCustomizations']),
      '{ "editor.fontSize": 14 }',
    );
  });

  it('removes nested keys and leaves the rest of the block intact', () => {
    let text = `{
  "workbench.colorCustomizations": {
    "activityBar.background": "#032F03",
    "titleBar.activeBackground": "#044104",
    "editor.background": "#123456"
  },
  "editor.fontSize": 14
}
`;
    text = deletePropertyAtPath(text, ['workbench.colorCustomizations', 'activityBar.background']);
    text = deletePropertyAtPath(text, ['workbench.colorCustomizations', 'titleBar.activeBackground']);
    equal(text, `{
  "workbench.colorCustomizations": {
    "editor.background": "#123456"
  },
  "editor.fontSize": 14
}
`);
    deepStrictEqual(parseSettingsDocument(text), {
      'workbench.colorCustomizations': { 'editor.background': '#123456' },
      'editor.fontSize': 14,
    });
  });

  // A comment sitting between a property and its separating comma used to
  // defeat the scan for that comma: the scan skipped whitespace only, gave up
  // at the '/', and left the comma behind, producing `{ , "next": 1 }`.
  it('removes the comma when a comment sits between it and the property', () => {
    const text = `{
  "workbench.colorCustomizations": { "activityBar.background": "#032F03" } // note
  ,
  "editor.fontSize": 14
}
`;
    const result = deletePropertyAtPath(text, ['workbench.colorCustomizations']);
    const parsed = parseSettingsDocument(result);
    ok(parsed !== undefined, `result must re-parse, got:\n${result}`);
    deepStrictEqual(parsed, { 'editor.fontSize': 14 });
    ok(result.includes('// note'), 'the comment itself must survive');
  });

  it('handles a block comment between the property and its comma', () => {
    const text = `{
  "workbench.colorCustomizations": { "a": 1 } /* trailing */,
  "editor.fontSize": 14
}
`;
    const result = deletePropertyAtPath(text, ['workbench.colorCustomizations']);
    const parsed = parseSettingsDocument(result);
    ok(parsed !== undefined, `result must re-parse, got:\n${result}`);
    deepStrictEqual(parsed, { 'editor.fontSize': 14 });
  });

  it('handles a comment before the comma when deleting a nested key', () => {
    const text = `{
  "workbench.colorCustomizations": {
    "activityBar.background": "#032F03" // set by us
    ,
    "editor.background": "#123456"
  }
}
`;
    const result = deletePropertyAtPath(text, ['workbench.colorCustomizations', 'activityBar.background']);
    const parsed = parseSettingsDocument(result);
    ok(parsed !== undefined, `result must re-parse, got:\n${result}`);
    deepStrictEqual(parsed, { 'workbench.colorCustomizations': { 'editor.background': '#123456' } });
  });

  // Deleting the last property takes the comma before it. A trailing comment on
  // the previous property sits in that gap and belongs to a setting that stays.
  it('keeps a trailing comment that belongs to the preceding property', () => {
    const text = `{
  "editor.fontSize": 14, // my preferred size
  "workbench.colorCustomizations": { "a": 1 }
}
`;
    const result = deletePropertyAtPath(text, ['workbench.colorCustomizations']);
    const parsed = parseSettingsDocument(result);
    ok(parsed !== undefined, `result must re-parse, got:\n${result}`);
    deepStrictEqual(parsed, { 'editor.fontSize': 14 });
    ok(result.includes('// my preferred size'), 'a comment about a surviving setting must not be destroyed');
  });

  it('returns the text unchanged when the path is absent', () => {
    const text = '{ "editor.fontSize": 14 }';
    equal(deletePropertyAtPath(text, ['workbench.colorCustomizations']), text);
    equal(deletePropertyAtPath(text, ['workbench.colorCustomizations', 'nope']), text);
  });

  it('leaves damaged documents alone', () => {
    const text = '{ "editor.fontSize": ';
    equal(deletePropertyAtPath(text, ['editor.fontSize']), text);
  });

  it('always leaves a document that still parses', () => {
    const documents = [
      '{ "a": 1, "b": 2 }',
      '{\n  "a": 1,\n  "b": 2\n}\n',
      '{\n  "a": 1,\n  "b": 2,\n}\n',
      '{ "b": 2 }',
      '{\n\t"b": 2\n}',
    ];
    for (const document of documents) {
      const result = deletePropertyAtPath(document, ['b']);
      ok(parseSettingsDocument(result) !== undefined, `must still parse: ${JSON.stringify(result)}`);
      ok(!('b' in (parseSettingsDocument(result) ?? {})), `must have dropped b: ${JSON.stringify(result)}`);
    }
  });
});

describe('renameTopLevelKey', () => {
  it('renames in place, keeping the value, comments and formatting', () => {
    const text = `{
  // chosen by the team
  "windowColors.🌈 Theme": "dark",
  "editor.fontSize": 14
}
`;
    equal(renameTopLevelKey(text, 'windowColors.🌈 Theme', 'windowColors.theme'), `{
  // chosen by the team
  "windowColors.theme": "dark",
  "editor.fontSize": 14
}
`);
  });

  it('keeps object values intact', () => {
    const text = '{\n  "old": {\n    "nested": true\n  }\n}\n';
    equal(renameTopLevelKey(text, 'old', 'new'), '{\n  "new": {\n    "nested": true\n  }\n}\n');
  });

  it('returns the text unchanged when the key is absent', () => {
    const text = '{ "a": 1 }';
    equal(renameTopLevelKey(text, 'missing', 'other'), text);
  });
});
