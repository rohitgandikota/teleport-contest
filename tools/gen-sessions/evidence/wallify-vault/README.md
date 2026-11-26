# Vault wall restoration and retained objects

C wallify_vault leaves ordinary objects embedded in a restored vault wall. It briefly makes the square visible, calls newsym, restores the visibility byte, then blocks the square. JS called map_background instead, replacing the retained object's displayed and remembered glyph with the wall.

The correction uses C's save/set/newsym/restore sequence and the existing visibility constants. It removes the unused map_background import. Only vault.js changes. It adds no new helper, random draw, state representation or input special case.

Four original keyboard inputs cover retained food, an empty damaged square, a rock consumed by restoration, and an intact wall that is ineligible for restoration. All four now match C, versus three before the correction. The positive repairs two screen boundaries while retaining the food ration. Three complete negative native reports and all 15 ordinary stream hashes remain unchanged.

The parent comparison on top of the published parser correction covers 880 styled screen/cursor boundaries, 25,465 ordered random calls and zero animation frames. Its complete report equals the isolated candidate report. Fresh installed ordinary controls pass 4/4, including passive-observer removal and deferred-input comparisons across all five streams.

```sh
node tools/wallify-vault-input-gate.mjs
```

The gate imports the game only after verifying the original C recording, all input fields and keys, branch assertions and locked ordinary assertion body. Its optional argument writes a new compact report; the default writes no files. The canonical recipe adds only known coverage metadata to the retained original recipe. No recording was repeated or reserialized.

SOURCE-REVIEW.md preserves the historical source-only audit, including its earlier failures and pending-native wording. The later native-validation.json and parent-verification.json record the subsequent checks. The candidate and source seals remain unchanged.

Other omissions in wallify_vault remain separate: wall-mode recomputation, tame-occupant yelp, freeing debris, deltrap and conjoined-pit cleanup, boundary gold, relocation and special sight conditions. The rock control proves floor disappearance, not complete disposal semantics. These four cases do not establish whole-vault or literal serialized-byte parity.
