# Mixed-message source boundary

The regression is in the topline path. All seventeen newly different cells
across the nine unchanged recordings are the first resolved wall or floor
glyph at (0,0). The ordinary byte painter now correctly sign-extends C text
bytes before nomux capture. It cannot also interpret the already-decoded
glyph prefix as byte text. U+00B7 is both a resolved floor glyph and a possible
byte value, so testing a Unicode range would lose the required distinction.

Complete reached owners and immediate contracts were read from the pinned
source. Upstream line numbers are used below. Recorder offsets differ because
capture instrumentation adds lines; both trees are pinned in source/pins.json.

| C owner | JS owner and finding |
| --- | --- |
| pager.c do_look 1673 through its return, including putmixed 1923 | pager.js do_look, do_screen_description, decoded_ch and encglyph_char. The producer already resolves the displayed glyph. Its message call still used pline. |
| windows.c decode_mixed 1466 and genl_putmixed; utf8map.c mixed_to_utf8 86 | The current pager representation has already performed the reached glyph resolution. This patch does not replace that representation or port the enhanced UTF8 conversion arm. |
| wintty.c tty_putmixed 4170, complete function | The new tty_putmixed_message arm brackets update_topl with mixed and clears both mixed and topl_utf8 on return. Its actual caller has NHW_MESSAGE and attr 0. |
| wintty.c tty_putstr 2226, full NHW_MESSAGE branch through 2300 | Attr 0 means normal history and no urgent override. update_topl owns STOP suppression, joining, history, wrapping and acknowledgement. The narrow wrapper also clears one-shot NOSTOP, as tty_putstr does. |
| topl.c redotoplin 122, update_topl 251, addtopl, remember_topl, show_topl, more, topl_putsym and putsyms | tty/topl.js and display.js complete corresponding owners. redotoplin writes the first mixed glyph before ordinary signed-byte painting. The byte painter stays unchanged. |
| wintty.c end_glyphout 3724 and g_putch 3740; recorder termcap.c nomux_putch | The first glyph uses graphics output. Subsequent text uses signed chars. The grid representation stores an already-resolved glyph with default color/attribute, rather than terminal escape state. |
| wintty.c process_text_window 1771 and relevant tty display/putstr callers | The initial suspicion of the text-window loop was rejected by the first-cell evidence and actual pager path. No text-window loop changes are included. |

The NHW_MESSAGE adapter accepts a nonempty, already-resolved description from
do_look. It does not accept an attr argument, so it cannot accidentally claim
URGENT or NOHISTORY handling. Persistent STOP remains set with attr 0; NOSTOP
allows one message and is then cleared. The tests cover joining, a pending
acknowledgement dismissed by ESC, a wrapped full producer description, top-line
flags and normal history. The actual putmixed call bypasses pline's MSGTYPE,
location consumption, previous-message assignment and vision flush, as C does.
The byte renderer is not broadened for plain high-byte strings.

The current JS message window uses game state rather than a numbered WinDesc.
There is no WIN_MESSAGE ID to store in ttyDisplay.lastwin; the reviewed JS graph
has no reader of lastwin. Menu display writes it separately. AVT window codes
and terminal glyph/color mode escapes have no independent grid state here.
These observations do not claim a complete generic tty_putstr port.

Explicit limits: enhanced UTF8 mixed_to_utf8 conversion, new raw glyph escape
decoding, custom UTF8 override semantics, invalid-window fallback and non-message
window types are outside this reached adapter. A constructed topl_utf8 control
checks that the new glyph branch respects the existing guard; it is not evidence
that the full enhanced UTF8 path is ported. Existing merged byte-cap and DEBUG
CapitalMon gaps are unchanged.

Source controls are constructed, not ordinary input claims. The first setup
attempt expected a midgame parser call to rebuild displayed symbols; it failed
before assertions. Attempt two reached a full floor description that wrapped,
invalidating the short-line setup. Both tools and failed reports are retained.
The final setup uses an unchanged recorded startup boundary with real DEC map
symbols. Short boundary cases use that actual first glyph and an explicitly
constructed short body. A distinct full-producer case checks its real wrapping
and acknowledgement. All nine complete ordinary inputs remain unchanged.

The first runtime candidate passed 15/16 final source cases and failed NOSTOP
cleanup. Its patch, map and reports remain fixed. The final runtime adds that
one required assignment and uses upstream provenance. No expectation was changed
to accept a runtime failure. Plain-byte and guard controls retain all five full
grid hashes from the regressed graph.
