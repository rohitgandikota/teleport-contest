# Configuration byte limits and consumers

The C parser joins continued configuration lines and caps the result at 1,023 bytes after each append. The JS parser previously joined Unicode strings without that cap. The port now encodes RC text once, preserves truncated UTF-8 bytes, and passes those bytes through the existing option, symbol, color and binding functions. Direct Unicode callers retain their existing conversion.

Only cmd.js, coloratt.js, options.js and symbols.js change. Function names and ownership remain aligned with C. The source review and bind_key caller review describe the required 30-byte parameter copy and the recursive argument boundaries. The C reference is commit 16ff59115315917b93185d026aeefea06db9b0f4.

## Recorded behavior

Fifteen cases use four original C recordings, retained byte-for-byte. Original six cases improve from four matches to six. Partial-symbol cases improve from two matches to three. Four NUL controls and two binding-parameter controls remain exact. The final native comparison covers 70 styled screen/cursor boundaries, 45,177 random calls and zero animation frames. All four complete reports remain identical when composed with the previously published fixes.

The six portable gates cover 28 byte-source assertions, 52 retained symbol assertions and 15 ordinary keyboard cases. Every original assertion row is preserved. Nine negative cases retain all 45 hashes across screens, cursors, random calls, per-step random slices and animation frames. Each gate validates recording provenance, inputs, primary branches and integrity before importing the game. Tests run the current repository runtime.

```sh
node tools/config-merged-cap-source-gate.mjs
node tools/config-merged-cap-symbol-source-gate.mjs
node tools/config-merged-cap-input-gate.mjs
node tools/config-merged-cap-nul-input-gate.mjs
node tools/config-merged-cap-partial-input-gate.mjs
node tools/config-binding-param-input-gate.mjs
```

## Retained checks and evidence

The existing section-parser test had one obsolete bookkeeping expectation: it expected a Unicode string where C retains UTF-8 file bytes. The corrected expectation preserves the input, rejection, absence of random draws and all 60 other controls. It passes 61/61. The original test and 60/61 failed candidate report are preserved in retained-config-sections, with source evidence and the exact replacement. No runtime change was made to satisfy that test.

Portable reports recorded before the final evidence bundle have an immutableEvidence count of 50. Installed reports have 55, reflecting the final pinned provenance entries. All assertion rows, native preflight data and every other report field are identical. The original reports remain unchanged. Parent verification records this metadata difference explicitly.

Earlier incorrect test setup and preflight attempts remain under history. Source28's original baseline is 12/28; a stale binding setup produced an earlier 9/28 report that is also retained. The parent verification records the full regression, normal replay, strict hang and publication checks for this checkpoint. A passing local regression does not establish a newer held-out score.

## Remaining scope

Physical overlong-line skipping and recovery, temporary configuration filenames in diagnostics, duplicate-option warnings, the independent 128-byte option check, unreached parse_conf_str integration, special/mouse/menu binding paths, enhanced glyphs, status Unicode folding and DEBUG CapitalMon remain separate. This change does not claim whole-parser or whole-port equivalence. The native comparator checks decoded styled cells, cursors, normalized ordered random calls and animation frames, rather than literal serialized terminal bytes.
