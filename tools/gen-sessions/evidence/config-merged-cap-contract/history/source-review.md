# Complete selected owner and consumer reads

The upstream C source is pinned at16ff59115315917b93185d026aeefea06db9b0f4.
File hashes are recorded in `source/pre-candidate-lock.json` and the supplemental
`source/reviewed-dependencies.json`. The fixed JS map pins all280 modules.

## Reader and physical input

Read the complete C `_cnf_parser_state`, `cnf_parser_init`, `cnf_parser_done`,
`parse_conf_buf`, `parse_conf_str` and `parse_conf_file`, cfgfiles.c1649-1860.
Also read complete `read_config_file`, `rcfile`, error-frame init/nextline/add/done,
section/CHOOSE helpers, `find_optparam`, directive table and `parse_config_line`.
Read the seven C directive wrappers actually implemented by JS: OPTIONS,
AUTOPICKUP_EXCEPTION, BINDINGS, MSGTYPE, MENUCOLOR, ROGUESYMBOLS and SYMBOLS.

The recorder's actual `recordSegment` RC write uses `fs.writeFile` on the supplied
JS string, hence UTF8 file bytes. Its transport context and the corresponding
`NethackGame` constructor/startup call were read. This is not a claim that every
unrelated recorder owner was reread. The only runtime JS caller of parseNethackrc
is jsmain startup. Complete current `parseNethackrc` and cfgfiles.js were read.

C `fgets` consumes at most1023 bytes per call, including LF when it fits. The
visible C string stops at NUL even if more physical bytes were consumed. The
memory-string caller instead stops its outer loop at NUL. These are different
contracts. The read_config_file, symbol-file, wizkit and Lua parse_conf_str caller
contracts were inspected; no corresponding JS Lua config caller was found.

The selected ordinary inputs have physical lines that fit the C read buffer.
They do not exercise external-filename diagnostics. Continuation detection is
before trailing-space removal. Replacing the backslash with NUL preserves the
spaces before it. Each nonignored fragment is appended with one separator space,
then truncated to1023 bytes. The cap is applied at every append, not after
dispatch, whitespace munging or option parsing. Full-line comments can terminate
a pending logical statement. An unfinished continuation at EOF is dropped.
Sections are checked before CHOOSE, and skipped sections do not consume a CHOOSE
draw. All of those existing ordering rules must remain unchanged.

## Byte consumers

Read complete C parseoptions489-692, match_optname and directive matching; complete
JS parseoptions, firstSeparator and the config result/error lifetime. Recursion
is right-to-left. OPTIONS receives the original spacing; the other six handlers
receive the munged value. Existing initial name/fruit encoders differ from the
interactive getlin byte path. Their sealed fruit/text producer/consumer review
is retained; the current entry points and immediate callers were reread.

Read complete C escapes6896-6968, txt2key6971-7068, parsebindings7596-7688,
msgtype_parse_add7844-7868, add_autopickup_exception9300-9347 and sym_val9385-9427,
with their JS counterparts and actual caller search. Current txt2key, sym_val,
MSGTYPE and MENUCOLOR entry points encode Unicode themselves. Feeding those
unchanged functions a byte-valued string would encode the bytes again.

Read complete C/JS parsesymbols, saved-symbol helpers, the four nhsym stores,
parse_sym_line, symbol-file reader and their immediate callers. The symbol-file
reader remains a separate Unicode caller of sym_val. C sym_val returns a signed
char widened to int; the nhsym stores convert it to unsigned. A missing closing
quote returns0. parsesymbols still succeeds and stores that0, so the ordinary
quoted-partial positive predicts no parser diagnostic and the default room glyph.
The published52 constructed symbol assertions are retained, including two-,
three- and four-byte UTF8, all four stores, real symbol-file parsing and key
controls. They must not be rewritten to accommodate a new input representation.

Read complete C/JS add_menu_coloring and add_menu_coloring_parsed. The parsed
and interactive pattern owners already use C bytes. The three regex readers
and fruit/name/TTY consumers are covered by the fixed fruit source334 review;
none needs a new output mask or terminal change for this cap repair.

Additional boundary checks read complete C/JS glyphrep_to_custom_map_entries
and its glyph-find call, plus complete parse_status_hl1/parse_status_hl2. These
checks do not certify all enhanced-glyph or status behavior. For example,
parse_status_hl1 currently uses Unicode lowercase where C uses lowc. No ordinary
status mismatch has been established here, so that separate lead does not justify
a status patch. The selected reader work must not claim those owners closed.

## Verified reach and source predictions

The fixed original6 source report is4/6. Its six rows equal the previous NUL
candidate rows, including all15 negative hashes. The complete fixed native
comparison is byte-identical to the earlier parent NUL report,
SHA322c93ff63466462c50ac0377fb0bb6787ab721d168cf7f4865a750fb54f569b.
The two cap failures have C `.` versus JS `Z` at8,12 from startup. RNG, cursors
and frames stay exact. Both exit1 reports remain visible.

The separately locked three proposals are ordinary RC inputs, not injected
helper state. Their source derivations are:

| Proposal | First physical bytes incl. LF | Merged bytes before cap | Retained value bytes | Predicted C state |
| --- | ---: | ---: | --- | --- |
| quoted partial positive | 1022 | 1025 | 27 c3 | sym_val0, room default `.` |
| literal partial negative | 1023 | 1024 | c3 | sym_val-61, nhsym195, glyph `C` |
| quoted fit negative | 1020 | 1023 | 27 c3 a9 27 | sym_val-61, nhsym195, glyph `C` |

The bounded baseline gate produces2/3, with only the predicted positive failing.
Every case has4 boundaries and3039 calls, with no frames, parser errors or
unhandled lines. Observer/plain/deferred outputs match completely. The two
negative cases' ten hashes are locked before any candidate. New native results
are pending; no C result is inferred from this JS run.
