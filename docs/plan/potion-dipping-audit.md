# Potion dipping and alteration audit

The full potion_dip body is now ported from the pinned C source. It handles
water, polymorph, alchemy, lichen acid tests, poison coating and removal,
corrosion, oil repair and ignition, lamp fueling, and purification. The shared
hold_potion and poof helpers preserve inventory reinsertion, burden policy,
identification and consumption. Typed and queued hands choices follow C's
suitability rules. Blindfold-only perception uses the corresponding C macros.

The alchemy review found a duplicate inventory insertion: splitobj already
inserts the child, but its caller inserted the same object again. Removing that
second insertion restores distinct object ownership and stack quantities.
Random alchemy results also call fixup_oil and dispose of the temporary object.

costly_alteration now lives in mkobj.js, its C module, and includes the full
verb table, ownership checks, knowledge changes, billing dispatch and floor
theft path. shk.js re-exports it for existing callers. fire_damage now checks
ignition first, preserves statue and ice-box immunity, includes luck bonuses,
passes spilled contents through flooreffects, clears worn state before
deletion, and uses C's shared singular/plural destruction messages.

## C recordings and state checks

| Recipe | Cases | Exact screens/cursors | Exact RNG entries |
|---|---:|---:|---:|
| potion-dipping-water | 27 | 2,002 | 81,670 |
| potion-dipping-effects | 30 | 2,353 | 90,811 |
| potion-dipping-shop | 6 | 803 | 32,192 |
| potion-dipping-details | 16 | 2,213 | 49,772 |
| potion-dipping-fire | 15 | 2,102 | 50,095 |
| Total | 94 | 9,473 | 304,540 |

Both new animation frames match. Every case has C intent assertions. Water
covers all nine target/water beatitude pairs, damage, dilution, towels,
grease, unchanged targets, bottle identity, hands and blindness. Other cases
cover poisonable arrows and permanent poison, polymorph immunity, oil repair
limits, purification stacks, alchemy stack limits, hallucinated feedback,
burning containers, fire-resistant objects, worn clothing and spent magic lamps.

The C intent review rejected several initial setups: ordinary daggers are not
poisonable, a heavy nonempty ice box was dropped, and neutral water merged into
an existing inventory stack. Corrected cases use arrows, an empty ice box with
strength gloves, and greased shop catalysts. Both pages of the final shop
inventory are recorded. Neutral unpaid water gaining a blessing or curse is
still an explicit gap; those invalid cases earned no assertion credit.

tools/potion-dipping-state-gate.mjs checks all 94 scenarios against C's complete
final inventory quantities. It also checks distinct identities and ownership,
consumption flags, beatitude knowledge, erosion, poison, polypile conduct,
purification, lamp fuel and timers, worn gear and spilled container contents.
Shop checks preserve the original C price and verify used-up bill copies and
their original beatitude. C does not call costly_alteration for the tested
ordinary dilution or scroll blanking paths, and their live bills remain intact.

An isolated loader changes the common no-consumption footer to retain in_use.
The blessed-water/already-blessed-dagger control still matches 70 screens and
cursors and 3,026 RNG entries, while the state gate fails on the retained flag.
The loader changes no runtime file. Evidence is in .cache/dipping/negative-*,
retain-in-use.mjs and state-gate.log.

## Coverage and regression

All five instrumented C recordings reproduce exactly in
.cache/c-coverage/potion-dipping-20260905. The additional shop page also
reproduces exactly in potion-dipping-shop-paged-20260905. The pass adds 252
direct outcomes and four entered records: poof, grease_protect,
pot_acid_damage and wet_a_towel. The measured union is 53,583/108,268 direct
outcomes and 4,304/5,491 entered records. The ledger is 1,707/1,707 assertions,
with 99 broad categories covered and seven partial.

The union reaches potion_dip at 151/180 outcomes, H2Opotion_dip at 31/38,
costly_alteration at 27/40, fire_damage at 39/54 and hold_potion at 1/2.
These are executed C outcomes, not proof that every dependency is faithful.

The stable runtime passes all 44 public and 444 supplemental fixtures. Public
has 11,405 exact screens/cursors, 792,838 exact RNG entries and 1,462/1,483
animations. Supplemental has 141,947 exact screens/cursors, 7,076,287 exact
RNG entries and 3,298 exact animations. The final shop pagination was verified
separately on the same runtime. Fuzz remains 101/102, with the same fixed-date
artifact: 14,261/14,262 screens, 14,262 exact cursors, 491,759 exact RNG entries
and 75/76 animations. Hang checks cover the public corpus and five new fixtures;
the revised shop also passes separately. All 80 reused role-smoke controls,
16 tool tests, source audit, the new state gate and ten related state gates
pass. Frozen files are unchanged. Logs are in .cache/dipping/.

## Remaining source paths

The next dependencies are bill_dummy_object's full copy/identity behavior and
bless/curse's light, weight, timer and equipment side effects. The current pass
does not establish their completeness. dodip's environmental, floor-reach and
inaccessible-equipment paths, dip_into, and getobj's hands menu remain open.
The source coverage denominator excludes Lua, macro internals and inactive
build configurations. Local corpus success does not establish held-out parity
or whole-game completeness. The full-port goal remains active.
