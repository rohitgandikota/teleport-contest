# Lock occupations, mimics and door passage

Magic-key disarming, lock-tool selection and interrupted occupations now
follow C's state transitions. Mimics retain absorbed items. Door commands
preserve queued directions, remembered terrain, inventory bulk and C's
integer closing threshold. New native follow-ups expose defects that the
initial tests could not observe.

## Source review and changes

The full recorder version of lock.c was read before the changes. The full
maybe_absorb_item, getdir, cmdq_add_dir, cmdq_pop, watch_on_duty, mon_yells,
stuff_prevents_passage, can_ooze, can_fog, cant_reach_floor, parsebindings
and test_move bodies were also read. The active m_canseeu macro and
greatest_erosion macro were checked against the included headers. SetVoice
preprocesses to nothing in this recorder configuration. No C or frozen code
changed. Reading a function does not establish that all its dependencies or
configurations have been ported.

Magic keys increase the occupation chance, reveal a trap, ask about disarming,
and preserve the lock state after successful disarming. Refusal retains the
trap and stops the occupation. Box trap knowledge and wisdom exercise follow
the C branches. Entry and resumption recheck hands, swallowing, floor reach
and tool type. Forcing uses existing erosion even on a proofed blade, as C's
macro does. Container questions are formatted before updating lock knowledge.

Automatic tool choice distinguishes ordinary tools, the hero's quest artifact
and another role's quest artifact. It prefers a magic key where C does and
does not use credit cards for locking. Automatic use checks artifact touch.
Door interactions include shopkeeper credit-card remarks, mimic discovery,
item absorption and shop damage from trapped doors.

Absorption moves the same object from hero or floor ownership to monster
inventory. It handles equipment, unpaid billing, encumbrance and visible or
blind messages. Ball, chain, rock-class and artifact resistance guards remain
in the same order as C. The asynchronous pickup path is awaited.

Opening and closing use effective confusion, stun and blindness. Closing
checks wall passage, small bodies and riding, and truncates the attribute
average before comparing the roll. C's rm.glyph means remembered terrain.
An initial JS comparison used a nonexistent field and lost a learned-information
turn in public seed1500. The corrected comparison uses remembered_glyph,
including the initial stone glyph, and the public case matches again.

Automatic kicking queues both the command and direction. getdir consumes
canned directions and configured movement bindings without a live direction
prompt. Configuration accepts BINDINGS and its C-supported abbreviations.
Door movement respects wall passage and amorphous inventory limits. The
existing bulk predicate now reads the hero's inventory for the hero. Its C
comparison of object type with COIN_CLASS is preserved, including that quirk.

Town watches use the active lock occupation and target coordinate. A first
warning marks the door; a repeated attempt causes arrest. Visibility includes
the C invisibility and underwater guards. Existing digging warnings are reused.
The larger getdir, movement, bindings parser and monster routines remain
partial. Mouse handling, help retries and other unrelated branches are open.

## Probe validity and observations

Initial neutral-Wizard magic-key attempts were rejected by the artifact, and
one north-door setup was blocked. Corrected cases use the valid alignment and
an observed east-door setup. Native prompt boundaries, rather than fixed
padding, determine the yes/no/quit responses. A space cancels these questions.
The final magic-key recipe has 12 magic disarming questions, six acceptances
and six refusals, plus 12 ordinary trap controls.

Booze probes are named for confusion, which C actually produced. Rocks and
iron balls are invalid forcing-weapon controls. A default wished sack was
empty, so it is not claimed as a full-container test. Full-sack bulk is covered
by a constructed state. Only the north approach in the eight-direction mimic
setup reached the mimic; the other seven are named as ordinary door controls.

Sixteen closing seeds initially missed the fractional boundary. A follow-up
with strength12, dexterity17 and constitution14 reaches rn2(25)=14. C refuses
to close because it truncates 43/3 to14 before the comparison. Removing the
truncation now causes a native mismatch. A separate follow-up kills the mimic
after it absorbs a key and recovers the dropped key. This makes missing
monster ownership observable beyond the absorption message.

The final fixtures were recorded with the official recipe recorder. Each has
an exact instrumented C repeat; the final 34-case passage fixture was repeated
after the two follow-ups. Independent integrity and branch assertions pass.
Invalid or cancelled intermediate setups are not promoted as intended coverage.

## Evidence and remaining paths

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| lock-magic-key | 24 | 6,920 | 57,998 |
| lock-operations | 99 | 26,675 | 226,750 |
| lock-passage | 34 | 17,007 | 85,544 |

All 157 scenarios, 50,602 screens/cursors, 370,292 RNG calls and 241 animations
match. The state gate checks 157 native replays, 93 inventory observations,
six disarms and two mimic acquisitions. It also checks HP and recursive object
ownership. Another 64 constructed groups check selection, interrupted work,
chance boundaries, knowledge, object transfer, queues, warnings and bulk.
Constructed states receive no C reachability or coverage credit.

All eight deliberate regressions fail the state gate. Native comparison of
the final three fixtures gives:

| Deliberate regression | Screen misses | Cursor misses | Positional RNG misses |
|---|---:|---:|---:|
| Skip magic-key behavior | 438 | 69 | 55,316 |
| Keep stale trap knowledge | 0 | 0 | 0 |
| Lose absorbed mimic inventory | 146 | 1 | 5 |
| Keep fractional closing average | 31 | 0 | 2,473 |
| Ignore erosion on proofed blades | 0 | 0 | 74,866 |
| Ignore canned directions | 215 | 5 | 115,524 |
| Skip watch warnings | 0 | 0 | 0 |
| Ignore hero inventory for ooze | 45 | 44 | 66,266 |

Trap knowledge and watch warnings still pass the native comparisons. Their
constructed controls catch those faults, but stronger native observations
remain necessary. Erosion is detected by RNG comparison while screens still
match. The exact five runtime modules from cda8c13f fail all three fixtures,
with 7,423 screen, 4,786 cursor and 349,541 positional RNG misses.

The C union adds 194 direct outcomes and three entered function records over
cda8c13f, reaching 56,813/108,268 outcomes and 4,401/5,491 entered records.
The newly entered records are cmdq_add_dir, obstructed and maybe_absorb_item.
The two recording directories are lock-occupations-20260906 and
lock-passage-final-20260906. The union includes earlier credited exploratory
executions only for paths they actually took. It excludes macro-internal
conditions and inactive configurations. No new unreachable claims are made.

Direct outcomes now include picklock38/50, forcelock20/30, autokey26/54,
pick_lock121/180, doforce33/42, doopen_indir50/72, doclose25/42,
doorlock26/102, obstructed1/14, maybe_absorb_item8/16 and watch_on_duty9/16.
can_ooze reaches4/4, while its bulk dependency reaches40/74. The assertion
ledger is3,342/3,342 with99 categories covered and seven partial. Neither
ledger completion nor these source counts establish full gameplay coverage.

Fourteen related state gates, 47 hang cases plus the final passage follow-up,
80 fresh games across 13 roles, 14 tool tests and source audit0/268 pass.
Fuzz remains101/102 with the known fixed-date screen difference; all491,759
RNG calls match. The full sweep passes572/572 fixtures:44 public and528
supplemental. All621,590 screens/cursors and12,551,703 RNG calls match.
The21 older public animation mismatches remain. New animations all match.

Local evidence is in `.cache/lock-occupation`: totals.json,
mutation-results.json, verification-exits.json, final-exits.json,
regression-complete.log and remaining.json. Magical door effects, obstructions,
shop damage, mounted cases, native town warnings and untested tool/artifact
combinations remain. The ongoing full C/Lua port continues beyond this pass.
