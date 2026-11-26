# Vault wall flags and pet feedback

This checkpoint combines three source-backed lines in two existing vault
functions. clear_fcorr restores wall_info from the saved flags. wallify_vault
awaits yelp before relocating a tame occupant.

The first fix lets a restored wall be dug after a temporary terrain wish changed
its flags. The second restores the pet's message before wall reconstruction.
The original C recordings contain four and three cases. Each fix has separate
source, candidate and portable-test evidence. The combined runtime matches all
seven cases and preserves all five complete negative reports.

All 926 maintained recordings pass, along with 101 selected/public replays,
101 strict eight-second workers, 49 retained checks and 29 retained native cases.
Final registry validation removed one unregistered root coverage label from the
saved-flags recipe. Its public gate verifies the exact original bytes by
restoring that label. Inputs and assertions are unchanged; see the separate
coverage-label-correction.json receipt.

Run the two public gates:

```sh
node tools/fakecorr-saved-flags-input-gate.mjs
node tools/wallify-vault-occupant-input-gate.mjs
```

Each gate checks the unchanged C recording before fresh keyboard runs. See
parent-verification.json for the final combined regression and fixed-file
checks. Separate evidence is in [fakecorr-saved-flags](../fakecorr-saved-flags/README.md)
and [wallify-vault-occupant](../wallify-vault-occupant/README.md).

The saved-flags witness uses supported debug terrain wishing. Other restoration
arms and typed fields remain open. Pet-helper branches and other wallify gaps
are listed in the separate evidence. Native comparison checks decoded styled
cells, cursors, ordered normalized random calls and animation frames. It does
not establish literal serialized-byte parity or complete vault-module parity.
