import { equal, ok } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MANAGED_COLOR_KEYS } from '../src/color_model';
import { removeManagedSettings } from '../src/settings_cleanup';
import { deletePropertyAtPath, documentHasComments, parseSettingsDocument } from '../src/settings_document';

/**
 * Real settings.json files vary far more than any fixture set we would think to
 * write: indentation style, line endings, comment placement, trailing commas,
 * key order, and unicode all differ per user. These properties are asserted
 * against generated documents so the editor is exercised on shapes nobody
 * anticipated, rather than only on the ones we imagined.
 */

// Deterministic PRNG: a failure must be reproducible from its seed alone.
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const UNRELATED_KEYS = [
  'editor.fontSize', 'editor.tabSize', 'files.exclude', 'typescript.tsdk',
  'search.exclude', 'editor.insertSpaces', 'rust-analyzer.check.command',
  'python.defaultInterpreterPath', 'workbench.colorTheme', 'emoji.🌈 setting',
];

const UNRELATED_VALUES = [
  '14', '"node_modules/typescript/lib"', 'true', 'false', '2',
  '{ "**/.git": true, "out/**": true }',
  '["https://example.com/a//b", "c"]',
  '"a \\" quote and a // slash"',
  '{\n@INDENT@@INDENT@"nested": { "deep": true }\n@INDENT@}',
];

const COMMENTS = [
  '// keep this note',
  '// Please keep this file in sync with the one in the vscode repo.',
  '/* block comment */',
  '/* multi\n   line\n   comment */',
  '// trailing slashes // inside // a comment',
];

interface GeneratedDocument {
  text: string;
  /** Top-level keys that must survive untouched. */
  unrelated: string[];
  /** Managed color keys written into the document. */
  managed: string[];
  /** Whether a comment was placed between a property and its separating comma. */
  commentBeforeComma: boolean;
}

function generate(random: () => number): GeneratedDocument {
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
  const chance = (probability: number): boolean => random() < probability;

  const indent = pick(['  ', '    ', '\t']);
  const newline = chance(0.2) ? '\r\n' : '\n';
  const trailingComma = chance(0.3);

  const unrelatedCount = Math.floor(random() * 4);
  const unrelated: string[] = [];
  while (unrelated.length < unrelatedCount) {
    const key = pick(UNRELATED_KEYS);
    if (!unrelated.includes(key)) { unrelated.push(key); }
  }

  const managedCount = Math.floor(random() * 5);
  const managed: string[] = [];
  while (managed.length < managedCount) {
    const key = pick(MANAGED_COLOR_KEYS as string[]);
    if (!managed.includes(key)) { managed.push(key); }
  }

  // Unrelated colors keep the colorCustomizations block alive after removal.
  const extraColors = chance(0.4) ? ['editor.background'] : [];

  const lines: string[] = ['{'];
  const emit = (line: string) => lines.push(indent + line);

  if (chance(0.4)) { emit(pick(COMMENTS)); }

  const entries: string[] = [];
  for (const key of unrelated) {
    const value = pick(UNRELATED_VALUES).replace(/@INDENT@/g, indent);
    entries.push(`${JSON.stringify(key)}: ${value}`);
  }

  if (managed.length > 0 || extraColors.length > 0) {
    const colorLines = [...managed, ...extraColors]
      .map(key => `${indent}${indent}${JSON.stringify(key)}: "#032F03"`);
    const inner = colorLines.join(',' + newline) + (trailingComma ? ',' : '');
    entries.push(
      chance(0.25) && colorLines.length === 1
        ? `"workbench.colorCustomizations": { ${[...managed, ...extraColors].map(k => `${JSON.stringify(k)}: "#032F03"`).join(', ')} }`
        : `"workbench.colorCustomizations": {${newline}${inner}${newline}${indent}}`,
    );
  }

  if (chance(0.3)) { entries.push('"windowColors.baseColor": "#0c7ba0"'); }

  let commentBeforeComma = false;
  entries.forEach((entry, index) => {
    const last = index === entries.length - 1;
    if (chance(0.25)) { emit(pick(COMMENTS)); }

    // Three comma layouts, because they exercise different code paths:
    //  - comment between the property and its comma (this shape once produced
    //    an unparseable `{ , "next": 1 }` and no generated document covered it)
    //  - comment after the comma, describing the property that stays
    //  - the plain case
    if (!last && chance(0.25)) {
      emit(entry + ' ' + pick(['// trailing note', '/* trailing */']));
      emit(',');
      commentBeforeComma = true;
    } else if (!last && chance(0.25)) {
      emit(entry + ', // note about the line above');
    } else {
      emit(entry + (last && !trailingComma ? '' : ','));
    }
  });

  lines.push('}');
  return {
    text: lines.join(newline) + (chance(0.8) ? newline : ''),
    unrelated,
    managed,
    commentBeforeComma,
  };
}

describe('settings editing properties (generated documents)', () => {
  it('holds every invariant across 2000 generated settings files', () => {
    // An invariant that never runs proves nothing. These count how often each
    // branch was actually reached, and the run fails if the generator drifts
    // into producing documents too dull to exercise the code.
    const seen = {
      withManagedKeys: 0,
      withComments: 0,
      withUnrelatedKeys: 0,
      commentBeforeComma: 0,
      blockSurvived: 0,
      disposable: 0,
      changed: 0,
    };

    for (let seed = 1; seed <= 2000; seed++) {
      const random = makeRandom(seed);
      const { text, unrelated, managed, commentBeforeComma } = generate(random);
      const context = `seed ${seed}\n---\n${text}\n---`;

      if (managed.length > 0) { seen.withManagedKeys++; }
      if (documentHasComments(text)) { seen.withComments++; }
      if (unrelated.length > 0) { seen.withUnrelatedKeys++; }
      if (commentBeforeComma) { seen.commentBeforeComma++; }

      const before = parseSettingsDocument(text);
      // The generator must produce valid JSONC; if not, that is a test bug.
      ok(before !== undefined, `generated document must parse. ${context}`);

      const removal = removeManagedSettings(text, {
        includeWindowColorsSettings: seed % 2 === 0,
      });
      ok(removal !== undefined, `parseable input must yield a result. ${context}`);

      // 1. The result must still be a valid settings file.
      const after = parseSettingsDocument(removal.text);
      ok(after !== undefined, `result must re-parse. ${context}\nresult:\n${removal.text}`);

      // 2. Unrelated settings survive with identical values.
      for (const key of unrelated) {
        ok(key in after, `must keep ${key}. ${context}\nresult:\n${removal.text}`);
        equal(
          JSON.stringify(after[key]),
          JSON.stringify(before[key]),
          `must not alter ${key}. ${context}\nresult:\n${removal.text}`,
        );
      }

      // 3. No managed color key survives.
      const colors = after['workbench.colorCustomizations'];
      if (colors && typeof colors === 'object') {
        seen.blockSurvived++;
        for (const key of MANAGED_COLOR_KEYS) {
          ok(!(key in (colors as Record<string, unknown>)), `must drop ${key}. ${context}`);
        }
        ok(
          Object.keys(colors as Record<string, unknown>).length > 0,
          `an emptied block must be removed entirely. ${context}\nresult:\n${removal.text}`,
        );
      }
      if (removal.changed) { seen.changed++; }

      // 4. Comments are never silently dropped from a document that keeps settings.
      if (documentHasComments(text) && managed.length === 0) {
        ok(
          documentHasComments(removal.text),
          `comments must survive when nothing was removed. ${context}`,
        );
      }

      // 5. Deleting a file is only ever safe when nothing of the user's is left.
      if (removal.disposable) {
        seen.disposable++;
        equal(Object.keys(after).length, 0, `disposable implies no settings. ${context}`);
        ok(!documentHasComments(removal.text), `disposable implies no comments. ${context}`);
      }

      // 6. Removal is idempotent.
      const second = removeManagedSettings(removal.text, {
        includeWindowColorsSettings: seed % 2 === 0,
      });
      equal(second?.changed, false, `removal must be idempotent. ${context}`);
    }

    // Guard against a generator that quietly stops producing interesting input.
    const minimums: Record<keyof typeof seen, number> = {
      withManagedKeys: 1000,
      withComments: 700,
      withUnrelatedKeys: 1000,
      commentBeforeComma: 150,
      blockSurvived: 200,
      disposable: 20,
      changed: 1000,
    };
    for (const key of Object.keys(minimums) as (keyof typeof seen)[]) {
      ok(
        seen[key] >= minimums[key],
        `only ${seen[key]} of 2000 documents exercised "${key}" (need ${minimums[key]}); ` +
        'the generator is no longer covering this case',
      );
    }
  });

  it('never corrupts a document when deleting an arbitrary key', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const { text } = generate(makeRandom(seed));
      const parsed = parseSettingsDocument(text);
      ok(parsed !== undefined);
      const keys: string[] = Object.keys(parsed);

      for (const key of keys) {
        const result = deletePropertyAtPath(text, [key]);
        const after = parseSettingsDocument(result);
        ok(after !== undefined, `seed ${seed}: deleting ${key} corrupted the document:\n${result}`);
        const remaining: string[] = Object.keys(after);
        ok(!remaining.includes(key), `seed ${seed}: ${key} survived deletion`);
        for (const other of keys) {
          if (other !== key) {
            ok(remaining.includes(other), `seed ${seed}: deleting ${key} also removed ${other}`);
          }
        }
      }
    }
  });

  it('never acts destructively on a document damaged by truncation', () => {
    // A file cut short mid-write must never be treated as complete, because
    // "nothing left" is the signal used to delete it.
    //
    // Asserting that a bail happens exactly when parsing fails would be
    // circular — removeManagedSettings bails *because* parsing failed. What
    // matters is the consequence: whenever it does act on damaged input, the
    // result must still be a valid file that kept the user's settings, and it
    // must never report a truncated file as safe to delete.
    let bailed = 0;
    let acted = 0;

    for (let seed = 1; seed <= 40; seed++) {
      const { text } = generate(makeRandom(seed));
      for (let cut = 1; cut < text.length; cut++) {
        const truncated = text.slice(0, cut);
        const removal = removeManagedSettings(truncated);

        if (removal === undefined) {
          bailed++;
          continue;
        }
        acted++;

        const after = parseSettingsDocument(removal.text);
        ok(
          after !== undefined,
          `acting on truncation at ${cut} produced an invalid file:\n${removal.text}`,
        );
        // Anything the truncated file still declared must survive, minus the
        // managed keys we are removing on purpose.
        const before = parseSettingsDocument(truncated) ?? {};
        for (const key of Object.keys(before)) {
          if (key === 'workbench.colorCustomizations' || key.startsWith('windowColors.')) {
            continue;
          }
          ok(key in after, `truncation at ${cut} lost the setting ${key}`);
        }
        if (removal.disposable) {
          equal(Object.keys(after).length, 0, `truncation at ${cut} was wrongly called disposable`);
          ok(!documentHasComments(removal.text), `truncation at ${cut} still holds a comment`);
        }
      }
    }

    // Both paths must be reachable, or this test is asserting nothing.
    ok(bailed > 100, `expected many truncations to be rejected, saw ${bailed}`);
    ok(acted > 20, `expected some truncations to still be actionable, saw ${acted}`);
  });
});
