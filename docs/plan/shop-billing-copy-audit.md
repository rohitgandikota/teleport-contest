# Shop billing copies and used-up inventory

bill_dummy_object now lives in mkobj.js and follows C's complete body. It
reads the original unit price, removes the live bill, allocates the copy with
nextoid, copies saved data, removes the revival association, clears candle
light and worn state, adds the copy to the bill, and restores the original
price. The live object's no_charge flag follows its location. Existing callers
await the billing operation; shk.js re-exports it.

copy_oextra preserves names, saved monsters, mail commands and monster IDs.
copy_mextra preserves each extension's value fields and existing destination
allocation. Embedded coordinates and arrays are independent copies. C copies
eshk.bill_p as a pointer, so that pointer remains shared. The C bodies and
object/monster structure definitions were read before implementing these rules.

The new C recordings exposed an absent used-up inventory path. doinvbill now
counts expended entries and displays their itemized charges, usage fees and
total. bp_to_obj chooses the bill or live-object chain. xprname includes C's
price formatting, quantity override, inventory-letter rules and length limit.
The existing inventory category command now includes the used-up menu entry,
including the single-category guard. Text paging preserves C's More wait.

## Evidence

The permanent shop-billing-copies recipe has 14 independently recorded C
cases: named water unblessing and uncursing, whole water stacks, named and
stacked purification, cursed purification, purification to water, named and
stacked burning oil, wax and tallow candles, and lamp ignition. Every case
asserts the C used-up category and itemized price; named cases also assert the
retained name. All 1,779 screens/cursors and 75,178 RNG entries match.

tools/shop-billing-copy-state-gate.mjs checks original prices, distinct IDs,
the C ID-dependent price adjustment, stack quantities, names, ownership,
consumption flags, light timers and the used-up count. Separate source controls
check saved-monster value copies, retained pointer identity, removal of a
corpse's revival association, and a lit non-candle billing copy. These controls
do not earn C gameplay coverage.

An isolated loader changes the copy's allocator back to next_ident. All 14 C
cases still match their 1,779 screens/cursors and 75,178 RNG entries. The state
gate fails on stack-oil because the copy's ID changes its price adjustment.
No runtime file is changed by this negative control. Logs and the loader are
in .cache/billcopy/negative-* and wrong-identity.mjs.

The exact native recording in .cache/c-coverage/shop-billing-copy-20260905 adds
55 direct outcomes and enters doinvbill. The union reaches 53,638/108,268
outcomes and 4,305/5,491 entered records. bill_dummy_object reaches 8/10
outcomes, doinvbill 22/32, xprname 26/38 and copy_oextra 5/20. The assertion
ledger is 1,721/1,721, with 99 broad categories covered and seven partial.

All 44 public and 445 supplemental fixtures pass on the stable runtime.
Public has 11,405 exact screens/cursors, 792,838 exact RNG entries and
1,462/1,483 animations. Supplemental has 143,726 exact screens/cursors,
7,151,465 exact RNG entries and 3,298 exact animations. Fuzz remains 101/102
with the known fixed-date artifact, 14,261/14,262 screens, 14,262 exact cursors,
491,759 exact RNG entries and 75/76 animations. All 45 hang checks, 80 reused
role-smoke controls, 16 tool tests, source audit and seven state gates pass.
Frozen files are unchanged. Results are in .cache/billcopy/regression.log,
fuzz.log, hang.log, roles.log, related-state.log and state-final.log.

## Remaining paths

The shared addtobill/add_one_tobill implementation still needs its remaining
billability, full-bill disposal, glob and quote-recording source review.
copy_oextra is connected to billing here; splitobj and saved-trait callers
still need to use the shared copy routines. Traditional inventory categories
and general non-ASCII byte formatting need additional C recordings. The next broader
dependency is bless/curse's light, weight, timer and equipment side effects.
Native outcome counts and current-corpus success do not establish complete
gameplay or held-out parity. The full-port goal remains active.

## Follow-up: partial consumption and two-page bills

Seven additional C scenarios in shop-usedup-inventory cover one and two
potions consumed from a three-potion stack, complete consumption, usage-only
debt, an unused purchase, and a 25-entry bill with both paging and Escape.
The initial long-bill setup reused the first inventory letter after later
wishes received new letters. That setup was rejected before promotion. The
corrected C recording reaches all 25 purchases and shows a 675-zorkmid total.
All 4,171 screens/cursors and 41,185 RNG entries match.

The state check exposed an independent bug despite perfect replay: obfree_bill
manually linked consumed objects and left in_use set. It now calls C's shared
add_to_billobjs cleanup and reads original glob weight through OMID. The gate
checks all 21 C cases, proves that bill display restores temporary quantities,
and distinguishes live partial stacks from completely consumed bill objects.
A fully consumed three-potion stack retains a final object with quantity one
and a billed quantity of three. A loader retaining in_use still passes all
4,171 screens and 41,185 RNG entries but fails the stored-state check.

The exact native recording in shop-usedup-inventory-20260905 adds seven
outcomes. The union is 53,645/108,268 outcomes and 4,305/5,491 entered records;
doinvbill reaches 26/32. The ledger is 1,728/1,728. All 44 public and 446
supplemental fixtures pass. Supplemental has 147,897 exact screens/cursors,
7,192,650 exact RNG entries and 3,298 exact animations. Public and fuzz counts
are unchanged from the previous checkpoint. All 45 hang checks, 80 reused
role-smoke controls, 16 tool tests, source audit, the expanded state gate and
five related state gates pass. Final verification logs are
.cache/billcopy/itemization-*.log. The source controls and exclusions above
still apply.
