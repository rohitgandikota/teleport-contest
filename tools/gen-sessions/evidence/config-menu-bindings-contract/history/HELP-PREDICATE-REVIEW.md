# Help predicate correction

Verified against the parent's unchanged C5 raw, SHA256 `403bc5fa36aee50794057d8763e713fb8a1d11a6425e742e7d0132a26352b554`. Both positive segments display the predicted menu alias correctly at step 7, row 4:

```text
decoded:     Select     ;      ,
serialized:  Select\x1b[5C;\x1b[6C,
```

The decoded row starts with two spaces. `options.c:9090` defines `mc_fmt` as `%8s     %-6s %s`; `show_menu_controls` supplies `Select`, the whole-menu alias `;`, and the page operation `,`. The label occupies columns 2 through 7, the alias column 13, and the page command column 20. The preceding heading, blank line and two column headings place this row at y=4. `pager.c:2820 domenucontrols` calls this columned form through `?l`.

The error was mine: I used `screenIncludes` for decoded visual text even though `tools/gen-sessions/assertions.mjs` applies it directly to serialized screen strings. `scripts/record-session.mjs:43 compressAnsiLine` replaces every run of at least five spaces with a cursor-forward escape. `encodeScreenAnsiRle` is called on each recorded input screen. Thus the literal `Select     ;` cannot match that encoded row, despite the correct display. The existing gameplay gate decodes screens before checking this phrase and has no corresponding mistake.

The separate corrected primary recipe changes only the two faulty raw-substring predicates. Each becomes 21 exact decoded cell assertions for the entire source-formatted row, including both leading spaces, the label, all gaps, the semicolon and the comma. They are fixed to the actual source-reached step and row. All original selection cells remain. The other three assertions are byte-for-byte equal as JSON values. All original inputs, expectations and gameplay assertion bodies remain unchanged.

`recipes/help-primary-derivation.json` records the exact transformation. `tools/help-native-check.mjs` verifies raw SHA/size, C5/source:c, all five fields, every key, 36 boundaries, 15520 calls, zero frames and recording integrity before checking predicates. The old two errors reproduce exactly; the corrected five branches pass. It also checks the original decoded semantic phrase independently. No C raw, screen, cursor or expected gameplay output is rewritten.

The parent's later runtime comparison on map `19946bb0dd7d375a2c726572868a2e427b61bbb9fe35e94ed6b07c0367da4b34` remains separate: 3/5 native, with three exact negative reports. This companion continues to use fixed9a92 for source/baseline work. Neither the metadata correction nor that independent comparison is a runtime candidate result.
