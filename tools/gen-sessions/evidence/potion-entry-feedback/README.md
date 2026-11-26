# Quaff entry and unchanged-effect feedback

C rejects quaffing while strangled before prompts, including menu-prefixed quaff. When a potion has no additional effect, C uses normal feedback while hallucinating and peculiar feedback otherwise. The runtime change ports those two branches.

Six locked keyboard inputs use real item and potion effects. The original ordinary result is 33/36 and native result is 3/6. The candidate passes all 36 checks and six native cases. All three complete control rows and fifteen output hashes stay unchanged. Observer-free and deferred-input comparisons cover all five streams.

Run `node tools/potion-entry-feedback-input-gate.mjs` from the repository root. It checks the original C recording and all input fields before gameplay. An optional path writes a new compact report. The native comparison covers decoded styles, cursors, ordered random calls and slices, and frames. It does not establish literal terminal-byte identity or complete potion coverage.
