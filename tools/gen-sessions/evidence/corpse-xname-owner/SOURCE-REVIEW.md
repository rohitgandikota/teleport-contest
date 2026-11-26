# Corpse naming owner review

Fixed baseline is ismnum32dd, 280 modules. No live-main imports. The original source340 diagnostic remains byte-identical at 2/3. All earlier proposals, including the missed first blind contact, are retained.

## Chosen owner and actual gaps

Complete C `objnam.c:1824-1920` and JS `objnam.js:652-704` were read before implementation. The immediate caller census is in `caller-census.json`; `reviewed-callers-complete.json` pins 48 complete owner ranges, including the source340 full misc-impact owner reused by exact hash. This is a naming-owner review, not closure of every caller's unrelated behavior.

The C owner suppresses the indefinite article when it appends the plural corpse suffix. It does not suppress it merely because quantity exceeds one: NOCORPSE intentionally keeps the article. The existing JS omits the suppression. C separately handles actual globs through OBJ_NAME, ignoring corpse suffix, species and quantity. JS omits that branch. C calls existing obj_pmname, which substitutes the role cleric name only for random-gender aligned clerics; JS inlines a simpler gender lookup. Finally, C mungspaces the assembled adjective/name and tests the original adjective's first byte for a digit. JS trims the adjective first and never collapses internal spaces. The candidate will implement these branches in their C order, only within objnam.js and its existing do_name import edge.

No new asynchronous owner, export, generic naming API, species normalization, or caller change is needed. Proper-name and unique-name prefix precedence remains C-shaped. No plural rule is inferred from English: C appends a literal s and clears any_prefix only in that branch.

## Immediate contracts

C hack.h59-66 defines the five flags and NO_PFX precedence; hack.h1189-1200 defines corpse gender bits. obj.h stores quantity, spe, dknown, globby and corpsenm independently. OBJ_NAME uses the object's type table name. the_unique_pm C1121-1141/JS635-646 excludes personal names, high clerics and worm tails, and includes the Wizard. type_is_pname reads the canonical M2_PNAME bit. s_suffix, mungspaces and just_an were read completely. C mungspaces stops at newline, changes tabs to spaces, collapses spaces, and strips a final space. The tests retain that quirk and the raw leading-space versus digit distinction.

C do_name.c1321-1359 / JS do_name.js1116-1141 already implements obj_pmname, including CORPSTAT_GENDER masking and random aligned-cleric substitution. It does not draw RNG. Its disabled saved-traits block is not part of the active contract. The valid species bound is the already-published ismnum prerequisite.

The hmon misc CORPSE arm prints with THE when dknown and ARTICLE otherwise, then calls observe_object, then preserves the existing cure/petrification sequence. observe_object has no Blind guard; a blind landed hit changes dknown after the message. The ordinary witness checks unknown before contact, known after contact, quantity/type, worn protection, survival and saved statue identity. doname contributes quantity via its NOCORPSE path. cxname, cxname_singular and killer_xname were read completely and are exercised separately.

## Real producers and reach

The four keyboard cases come unchanged from proposals03. Debug wishes create and wield actual corpses while gloves protect the hero. The blind plural case lands a second forced hit on the generated keeper and creates its statue. A sighted plural case, blind held stack and blind singular impact are matched negatives. All four include an actual inventory command. Their observed lines are pinned in producer-proof.json. No map, species, object, RNG, or helper is injected in those runs.

The source controls use a real wished/wielded corpse and a real wished gray-ooze glob. The relevant readobjnam producer branch C5037-5084 / JS3340-3399 converts pudding corpses to globs, creates the object through mksobj, and preserves quantity one for globs. mksobj C957-968 / JS596-604 sets globby, weight, known flags, species and the real glob timeout. The producer proof confirms a quantity-one, weight-20 glob. Subsequent source-control changes to quantity, gender, species, adjective, or flags are explicitly constructed. This local producer review does not claim complete readobjnam/mksobj closure.

C eatcorpse excludes globs from its tainted-corpse branch, despite the older corpse_xname comment. No ordinary call into the glob branch has been established. No ordinary invalid-species producer is invented.

## Preserved dependencies and limitations

Shared an omits C's impossible diagnostic and `an []` result for an empty string, and C's bounded concatenation. This candidate does not change an. Arbitrary empty/truncated strings and buffer behavior are outside its verified contract. obj_pmname also omits its invalid-object diagnostic; invalid positive species indices are not valid C owner inputs. JS feel_cockatrice uses corpse_xname for a killer string where C uses killer_xname; that separate caller discrepancy is unchanged.

The new strict wrapper controls expose an additional existing killer_xname restoration gap: C restores the complete obj value, while JS Object.assign leaves newly added absent greased/opoisoned fields as zero. Three assertions deliberately keep failing. The owner controls retain full object/type and RNG preservation checks; no assertion is removed and no generic copy fix is included. These zero-valued additions have not been shown to affect ordinary naming output. They are not evidence of an ordinary regression.

The first ordinary metadata attempt accidentally required final HP115 even during HP12 startup. Its exact tool, recipe, lock and 0/4 report are retained under evidence/pre-candidate-health-metadata-v1. The correction requires positive HP throughout and exact final HP115. It changes no input tuple, C branch string or negative output hash, and precedes any runtime candidate.
