# Source contract and evidence limits

The earlier complete owner reads are preserved in the parent packet's
source/fruit-byte-read-ledger.json, fruit-byte-followup-read-ledger.json and
fruit-byte-ingress-read-ledger.json. Their recorded baseline is the earlier NUL
graph, not live main. The bounded implementation uses the explicit dbb280 graph
in source/base-runtime.json. The new status-owner ledger records the four
remaining full bodies and immediate callers on that graph. All C and JS source
pins are dependencies, not copied C snapshots.

At the config boundary, the recorder writes nethackrc as UTF8. C nmcpy counts
bytes, ends at NUL/comma and leaves room for a terminator. optfn_fruit munges and
sanitizes at each statement using iflags.wc_eight_bit_input. initoptions_finish
registers the already parsed name later. Input keys use Latin1 transport, so
getlin results must not be UTF8-encoded again. The actual fruit fallback in
readobjnam compares the saved typed fruit name to fname. The new typed-name
ordinary witness reaches that fallback; generic wishes alone do not prove it.

The existing sanitizer can produce e22eac from e282ac, even when eight-bit input
is enabled. A partial retained c3 is also valid C name storage. Neither can be
passed through a Unicode replacement decoder. Byte strings retain the existing
naming/inflection, fruit chain and save-codec interfaces. The retained30 real
owner assertions test those effects without a codec repair or mocks.

msgtype_type, get_menu_coloring and check_autopickup_exceptions take formatted
byte-valued C text. The existing regex string interface encodes Unicode and
would encode those bytes again. The changed callers use its existing byte-array
interface. RC patterns establish bytes at their parser boundary; interactive
patterns already arrive as bytes. Stored pattern labels retain partial bytes.
The original8 regex assertions still pass unchanged, including the rejected
byte-string misuse of that API. No regex internals are changed.

Menu matching uses pmatchi's ASCII lowc, with case-sensitive pmatch unchanged.
The ordinary high-byte inequality control distinguishes this from JavaScript
Unicode lowercasing. It leaves the real inventory object selected differently;
it does not just compare two helper return values. Menu color is also checked
on a real menu entry, with an ASCII color/search control.

The canonical eight-bit field is shared by option parsing, boolean readers,
option UI storage, sanitize_name and the glyph writer. The startup loop preserves
that field after parsing. No second fruit sanitization occurs after all options,
and no extra fruit registration is introduced by the interactive path.

The installed recorder's topl_putsym passes signed char to nomux_putch(int).
That capture ignores values below32. Cursor advancement still occurs, and the
previous cell's glyph/style remains. This is supported by the earlier locked
source plus installed-binary proof. Base/menu/status text follows its signed
char source path. Status also writes each byte to cw.data so later comparisons
remain correct. The constructed status control proves both preserved styled
cells and a later unchanged-field no-repaint decision.

process_text_window has a distinct first-byte g_putch route. Its advanced cursor,
unsigned low-seven capture and DEC handling are not the signed text route used
by later bytes. The existing display DEC comparison map is shared with this
actual caller. It is not a test-only export. Corner menus clear the row suffix
before writing text, so skipped bytes expose cleared cells. No blank replacement
or output postprocessing is used to imitate that behavior.

The four completed status owners are bot_via_windowport,
evaluate_and_notify_windowport, tty_status_update and tty_putstatusfield. The
immediate bot, eval_notify_windowport_field, status_update/windowproc,
make_things_fit, check_fields, render_status and tty_curs_status path was also
read. Name/title lengths, HP-bar splitting and padding already operate correctly
on byte-valued strings; botl.js needs no new abstraction or edit.

Source v1's rejected !fruit expectation is preserved. include/optlist.h:339
sets negateok=No and options.c:625 rejects it before optfn_fruit. V2 asserts that
rejection and retained value. The two window probes now acknowledge the prior
real wish message through more() before constructing the test window, matching
wintty.c:1966. No input was added to any ordinary recipe for these corrections.

This closes the named source candidate, not the complete config reader or all
text behavior. Runtime Unicode from every possible ingress is not certified by
these18 ordinary cases. Interactive pattern editor branches and text/base
writers have constructed/source evidence where ordinary reach is not supplied.
The new13 and original5 still need exact parent native comparison. The separate
wrapped-message clearing patch must be composed by the parent, without changing
the fixed dbb candidate used for these results.
