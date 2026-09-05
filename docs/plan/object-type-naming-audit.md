# Object types and discoveries source audit

Thirty-eight permanent C scenarios cover inventory and floor type naming,
discovery renaming, all thirteen pauper roles, and identification of unpaid
gems. They match **1,761/1,761 screens and cursors**, **111,115/111,115 core RNG
entries**, and have no animation frames. These reuse established setups and
seeds. They are regression controls, not an estimate of unseen-game accuracy.

The complete C bodies reviewed for this pass are `docallcmd`, `docall_xname`,
`docall`, `namefloorobj`, `observe_object`, `discover_object`,
`undiscover_object`, `rename_disco`, `disco_append_typename`, `pauper_reinit`,
`o_on`, `find_oid`, `gem_learned`, `object_from_map`, and `see_objects`.
The pricing dependency also reads `append_price_quote` and `get_cost`.
The port follows their decisions, subject to the representation and dependency
limits below. Review is not proof of equivalence for every state.

| C function | Direct outcomes reached in the current union |
|---|---:|
| `docallcmd` | 32/42 |
| `docall` | 15/18 |
| `docall_xname` | 9/18 |
| `namefloorobj` | 19/30 |
| `rename_disco` | 19/22 |
| `undiscover_object` | 2/18 |
| `object_from_map` | 35/56 |
| `pauper_reinit` | 34/36 |
| `o_on` | 6/6 |
| `find_oid` | 11/14 |
| `gem_learned` | 7/10 |

The new exact C profiles add **75 outcomes** and three entered function records,
`namefloorobj`, `undiscover_object`, and `rename_disco`. The full union is
**52,910/108,268 direct outcomes**, **4,287/5,491 entered function records**.
Profiles are in `.cache/c-coverage/object-types-20260905`. The union script in
`.cache/naming/coverage-union.mjs` checks every complete LLVM branch tuple before
merging counts. All four new recordings were exact and credited. This census
excludes Lua, macro-expansion branches and inactive build configurations.

`object-type-state-gate.mjs` checks every recorded scenario. A type name survives
empty or Escape cancellation, while all-spaces input removes it. Quantity,
instance names and dilution survive the prompt's temporary formatting.
Clearing a type name retains an encountered discovery. Renaming a known type
from discoveries creates no real inventory object. Blind, unseen objects do
not become encountered through a failed naming attempt.

Pauper roles start with two skill credits, no learned spells or inventory, and
the C role-specific object recognition. Every initially trained skill is reset
to unskilled with zero practice. The Cleric's separate role initialization must
also recognize water, overriding pauper. The C Samurai discovery exists but
cannot be given a type name, which distinguishes an empty discovery list from
one with no nameable entries.

The unpaid-gem control preserves object identity and quantity on the bill.
Identifying two diamonds keeps their stored per-gem price at 5,333. Identifying
two pieces of white glass changes it from 1,067 to 7. Disabling only the new
`discover_object` gem callback in an isolated Node loader makes the state gate
fail with 1,067 instead of 7. The negative-control log is
`.cache/naming/type-gem-negative-control.log`; the working tree was not changed
for that intervention. Constructed controls also exercise the all-gems request
and recursive lookup through containers and migrating object/monster lists.

Floor naming a mimic creates a temporary object without attaching it to the
floor. The recording and state gate confirm that the mimic's appearance becomes
known and no timer or light remains. Additional source controls verify that a
fake corpse's rot timer is stopped, a buried object is found without being
observed as surface loot, and a detected container-trap glyph prefers the chest
at its location. Temporary objects have no contents, light or external owner,
so dropping the local JS reference reclaims them. The complete C `dealloc_obj`,
`dealloc_obj_real` and `dobjsfree` bodies were read at mkobj.c:2745-2844 to check
that distinction. The general C deletion queue and Lua references remain open.

One hallucinated floor probe found a shared redraw error. `docrt_flags` calls
`see_monsters`, including `newsym` on an unmounted hero. Replacing that with a
direct hero glyph skipped the object underneath the hero and one display-RNG
draw. The next floor glyph then showed a different helmet color. An isolated
C build with `map_object` stack traces confirmed the missing call. `docrt`
now uses `see_monsters`; `see_objects` follows C's `vobj_at` identity test in
floor-chain order and calls `update_inventory`. The debug build and trace are
under `.cache/naming/display-recorder` and `c-map-trace.log`. They are separate
from both the ordinary oracle and native coverage recorder.

Open paths remain explicit. Custom packorder is still ignored by the existing
discovery-order helper. `update_inventory` still has windowport and map-output
suppression markers. `see_monsters` still omits deferred/arriving-monster guards,
worm-tail refresh and warning-count effects. Mimic corpse payloads have both
flat and nested representations; `object_from_map` reads both, but all writers
and cleanup paths still need one consistent ownership rule. The sink prompt,
name removal after forgetting, long discovery-name truncation, rare temporary
object variants, and non-ASCII input need more native scenarios. Some
`docall_xname` attribute branches cannot be selected through ordinary `call_ok`;
their code review is not claimed as gameplay coverage.

Verification passes public 44/44 and supplemental 427/427. Their screen and RNG
totals are respectively 11,405 and 792,838, then 123,830 and 6,218,844. Public
animations remain 1,462/1,483; supplemental animations remain 3,248/3,248. Fuzz
is unchanged at 101/102, 14,261/14,262 screens and 491,759/491,759 core RNG, with
the known fixed-datetime artifact. All 48 hang checks, 80 role-smoke controls,
16 tool tests, source audit, the new state gate and 14 related state gates
pass. Frozen files are unchanged. Logs are `.cache/naming/type-final-*.log`.
The assertion ledger is 1,432/1,432, separate from measured C coverage.
