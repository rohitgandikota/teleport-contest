# Shop quote variants, source-only

Fixed280 map9dbbff6a includes the parent's welcome/potion composition and the
verified three quote owners plus ordered dochat branch. No runtime change is
proposed. Source24, candidate316 and promotion49 remain immutable. The earlier
five native cases prove sober quote behavior, not hallucinated argument order.

## Complete chosen owners and ordering

C shk.c5386-5503 and JS shk.js4876-4971 contain shop_object, price_quote and
shk_embellish. Full C dochat1257-1409 and JS dochat202-309 were read. The caller
checks speech exclusions, then sight/hearing and eligible shop stock before
requesting a direction. An eligible quote returns ECMD_TIME after awaited
feedback. Multiple object records, regardless of each record's quantity, use
an NHW_MENU; a single priced record uses verbalize.

The price loop skips coins, uses get_cost for chargeable goods, adds contained
cost where present and scales globs by weight. Its nonzero-price currency call
is in a full expression before doname. For one priced record, doname runs again
before the verbalize expression. That call has currency(cost) and
shk_embellish(first_obj,cost) as separate arguments. Their relative C argument
evaluation order is unspecified. The actual recorder binary's order is still
unknown. JS evaluates its template currency before embellishment.

invent.c1521-1554 lists21 currencies and currency calls ROLL_FROM under
Hallucination. hack.h1493 expands that to rn2. shk_embellish always calls rn2(3)
and only on zero calls rn2(5). The natural pick-axe is a known type, not unpaid,
not a container, artifact or worn item. doname uses flags0, so this case avoids
the separate unpaid/contents/with-price currency calls in objnam.c1654-1682.
Thus the selected owner's C possibilities begin with the loop rn2(21), followed
by either currency21 then embellishment3/[5], or embellishment3/[5] then
currency21. These are owner-level constraints, not a claim about all command or
turn RNG. The pass will record the actual input-boundary slices and current JS
prefix without declaring which compiled C order is correct.

The earlier promotion's source review pins the Clang build policy and original
recording receipt. Neither a policy comment nor the prior nonhallucinatory C
recording proves compiled order for this call. No compiler, recorder or seed
search is run here.

## Actual hallucination producer

Complete C dodrink526-615, dopotion618-644, peffects1333-1425,
peffect_hallucination696-714, make_hallucinated369-438 and the corresponding JS
owners were read. Quaff first selects a real potion, handles worn stacks and
milky/smoky occupants, then invokes the effect. A cursed hallucination potion
sets a900..1099-turn increment through rn1(200,900), barring resistance, and
skips the optional enlightenment branch. The matched cursed fruit-juice potion
uses peffect_see_invisible's early fruit return and does not set hallucination.
Both quaffs consume the selected potion and one ordinary turn when successful.
The prior maintained potion-entry recipe supplies the acknowledgement/cancel
pattern. An occupant or unresolved naming/message prompt is a failed producer,
not a reason to retry with another seed or silently change inputs.

make_hallucinated redraws monsters, objects and traps before the cosmic message.
The complete see_monsters, see_objects and see_traps helpers were read. Display
randomness has a separate RNG context; the probe does not enable extra display
logging or trace flags. It compares all ordinary screens, cursors, core calls,
ordered slices and animation frames across observed/plain/deferred execution.
No transitive display-system closure is claimed.

## Stack and ownership controls

The maintained seed6903 prefix ends at75,10 in Inuvik's general store over a
natural pick-axe priced67. Complete wiz_wish/makewish/hold_another_object and
selected readobjnam count/BUC contracts support real wishes for2 uncursed apples.
The quantity assignment honors debug-mode counts for mergeable goods. C's FOOD
macro gives apples base cost50/20+5=7; get_cost uses the same8..10 charisma bracket
that makes the50-cost pick-axe67. C integer rounding gives the apple unit quote9.
set_cost sells two apples for7 when ordinary Wizard gear and type knowledge hold.
These price prerequisites are checked from passive state, not assumed afterward.

Complete dodrop/drop/dropx/dropy/dropz/place_object, stackobj and sellobj, plus
saleable/set_cost/getprice/get_cost, were read. The full prior doname and shop
helper reads were revalidated by range hash; selected count/plural and currency
branches were inspected again. Drop places the new stack at the pile head, then
prompts through sellobj. Accepted sale leaves the apples chargeable and pays7;
refusal sets no_charge. Apple and pick-axe types cannot merge. Both rows retain
two object records, so both use a waiting menu. Only accepted apples should have
`9 zorkmids each`; the refused stack should have `no charge`. Both retain the
pick-axe67 entry and consume one chat turn after the menu is dismissed.

The original shop source24's28 C ranges and31 unchanged JS ranges were verified.
Four changed JS ranges (dochat, dropz/dropy, dropx, drop/dodrop) were read in their
current fixed form. Existing sellobj gaps, including rouse_shk and robbed-shop
handling, are not repaired or claimed covered. The proposal requires an awake,
peaceful, unrobbed, funded resident. Broader wish parsing, merge internals and
transitive naming remain dependencies, not whole-owner closure claims here.

## Locked family and limits

proposal01 contains four cases and332 literal input keys. Every name, seed,
datetime, nethackrc and moves field, including presence and every byte, is fixed
in input-lock.json before the one bounded pass. The primary recipe includes all
four branch assertions at creation so a later parent recording can preserve
root metadata. It is a proposed C recipe, not an existing C recording.

Only the hallucinated single is the target for the order question. Sober single,
priced stack and no-charge stack are meaningful controls and have all five output
hashes fixed after this first observation. Full pre-action, pre-chat and final
state summaries show the actual producer. The observer calls no naming, pricing,
shop_keeper, RNG or mutation helper. It reads existing public pure predicates and
actual objects; all changes come from the keyboard. Deferred EOF remains pending
and output-stable before deliberate harness shutdown.

Contents-only/container quotes and leading/interleaved coins remain open source
leads, not attempted inputs. So do hallucinated menus, artifacts, inner sales
language choices, excluded keeper states and other dochat branches. No native
parity, confirmed regression or runtime candidate is claimed before parent C.

Source ranges are bounded by each named owner's closing brace in source-ranges.json. The selected tty_yn_function contract confirms that a pending drop message is acknowledged before the sale prompt accepts y/n; the maintained drop prefix is retained. No tuple or predicate changed during this final source-boundary check.
