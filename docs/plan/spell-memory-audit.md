# Casting preconditions and spell memory

Seventy-two C cases cover casting rejection, forgotten spells, amnesia and
identification. They match 22,545 screens and cursors and 183,171 RNG calls.
The C coverage union adds 166 direct outcomes and eight entered function
records. Every switch value in spell_backfire is reached, covering its
20/20 direct outcomes. This is a function-level result, not certification
of the spell subsystem or the game.

## Source review and implementation

The complete rejectcasting body in spell.c:687..711 now rejects stun,
inability to chant and bound hands, with C's quarterstaff exception and
messages. getspell at 715..783 awaits that check, consumes queued spell
selections, and uses the live menu-style setting. docast at 820..829 stores
the selected letter in the repeat queue. The C traditional prompt also
stores its response. Preserve that duplicate: repeating a directional
spell selected through the traditional prompt can feed an invalid letter
to getdir. A native case tests that behavior.

spell_backfire at 1181..1217 preserves C's ten-way draw, four distributions
of confusion and stun, old timeout masking and update order. The full
spelleffects_check body at 1220..1379 is transcribed, including the capacity
guard, energy costs and dirty flags, memory warnings, hunger and strength
exceptions, Amulet drain, insufficient-energy suffixes, Wizard intelligence
switch and failure cost. Its existing JS out-parameter representation is
retained. percent_success and the spell-effect dispatch are not certified
by this review. Cure sickness and several other effects remain absent.

can_chant now lives in mondata, after can_blow as in the C. Both reading
and turning undead use it, replacing two local copies that compared sound
values against the wrong constant table. freehand moves to engrave, its
actual C module. Applying tools, picking up objects, catching missiles and
casting now share that function. Its control flow is unchanged.

make_confused and make_stunned use set_itimeout, preserving permanent bits
and clamping the timeout. Their messages and dirty checks retain C's use
of the requested duration and previous complete intrinsic value. The full
C setters and itimeout helpers were read. losespells, forget and
seffect_amnesia were also read completely. Their selection behavior already
worked; losespells now uses the shared Confusion predicate. Tests expose
zero loss, partial loss, all loss, both confusion comparisons, luck rerolls
and zero known spells.

The empty-inventory identification cases exposed an omitted message in
seffect_identify. Its full C body now distinguishes spells from scrolls,
uses up only a scroll, avoids teaching the scroll type for an identify spell,
and reports empty inventory. menu_identify handles selection limits,
successive menus, cancellation, no eligible items and five empty attempts.
query_objlist implements SIGNAL_NOMENU and SIGNAL_ESCAPE while preserving
the established selected-object array for ordinary results. The active-map
part of tty_wait_synch is represented by flush_screen before another menu.
Raw-terminal and interrupted-input synchronization still need review.
identify_pack's traditional ggetobj path remains explicitly unported.
The rest of query_objlist is not certified by this change.

The repeat probes also reached command cancellation. rhack now clears both
queues for absent input, escape and cancelled counts, and preserves
docast's failure result for its shared cleanup. do_repeat uses C's Norep
message. The full relevant C command bodies were read, but the remaining
dispatcher and windowport branches remain outside this certification.

## Native cases and state checks

| Recipe | Cases | Screens | RNG calls |
|---|---:|---:|---:|
| spell-casting-preconditions | 30 | 8,579 | 72,476 |
| spell-forgetting | 18 | 5,757 | 49,538 |
| spell-memory-selection | 10 | 3,775 | 24,800 |
| spell-identification | 14 | 4,434 | 36,357 |

All four native re-recordings are exact and all 72 assertions pass. The
ledger is 2,065/2,065, with 99 covered and seven partial scenario categories.
The state gate replays every case. It checks 17 backfires before their
energy deduction and 27 amnesia selections before the following message.
It verifies the exact forgotten slots, unchanged slots and cleared study
context. It also checks that selecting too many identification items does
not identify the extra item.

Constructed controls cover queued invalid types and letters, spell counts
at alphabet boundaries, unknown spell indices, memory-warning boundaries,
hunger and strength exceptions, capacity, energy suffixes, Amulet equality,
intelligence-dependent hunger, the minimum nutrition floor, all seven spell
levels, additive confusion and permanent timeout bits. They earn no native
coverage or reachability credit. The 52-slot spell lists are constructed
controls, not claims about what the native game can learn.

The first state-gate version attempted to observe rnd through the existing
rn2-only probe. The corrected gate observes the post-amnesia rn2 boundary
and the energy write after backfire. No runtime instrumentation was added.
A loader mutation removes additive confusion for the confusion-only arm.
The visible oracle then fails on 98 screens and 16,300 positional RNG
entries. The state gate independently reports six turns instead of 36.

The exact previous checkpoint, 5f71c712, was loaded across all twelve changed
runtime modules. It fails three of four new fixtures, with 2,225 screen,
53 cursor and 108,754 positional RNG mismatches. The amnesia selection
recipe already passed and adds independent execution evidence.

One related state gate failed on both the old and new runtime. It compared
raw m_ap_type against M_AP_OBJECT. The existing C oracle shows a coin-pile
disguise, while the state also carries M_AP_F_DKNOWN. The gate now uses
include/monst.h:73 M_AP_TYPE, matching C's mask. No mimic runtime changed.

## Verification and limits

The final full sweep passes all 531 fixtures: 44 public and 487 supplemental,
249,251 screens/cursors and 9,273,681 RNG calls. The existing 21 public
animation mismatches remain. Supplemental matches 237,846 screens/cursors,
8,480,843 RNG calls and 21,679 animations. Runtime was held fixed during
both complete sweeps. Fuzz remains
101/102 with its known fixed-date miss and all 491,759 RNG calls matching.
All 48 hang checks, 80 role controls, 16 tool tests, source audit (0/268),
the new state gate and fourteen related state gates pass. Reports are in
.cache/spell-memory and .cache/c-coverage/spell-memory-20260905.

The union is 54,941/108,268 direct outcomes and 4,356/5,491 entered records.
Selected totals are spell_backfire 20/20, rejectcasting 7/8,
spelleffects_check 47/72, getspell 21/32, losespells 13/14,
can_chant 6/8, freehand 7/8, menu_identify 17/18 and seffect_identify 26/38.
remaining.json lists each missing outcome. No new unreachable claims are
made here. More native warning, hunger, strength, menu-range and source
combination cases are still needed even where constructed controls pass.

Next, port the traditional inventory selection chain, ggetobj and askchain,
then continue the remaining spell effects, timeout, inventory, monster and
Lua paths. Keep the full-port goal active. Frozen files and the original
C recorder are unchanged. This checkpoint is local; no push is authorized.
