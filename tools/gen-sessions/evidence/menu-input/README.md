# Menu input and status thresholds

Configured menu keys now reach the shared TTY handler, including character
selection. The port preserves C's ordered aliases, capacity limit, explicit
selection precedence and help text. Character selection uses the shared menu
implementation instead of maintaining separate input loops. Early overflow
output completes before parsing returns and is cleared by normal startup.

Status threshold editing now preserves C's shared input-buffer behavior.
Entering a bare percentage displays its percent sign in the comparison menu.
The numeric arm also follows C's whitespace, operator and suffix mutations.

All 930 maintained recordings pass, covering 934,828 screens/cursors,
20,401,823 random calls and 33,179 animation frames. All 47 public/new timeout
checks and 29 retained checks pass. Fresh portable checks pass 40 source
controls, 13 menu cases and 34 status assertions over four cases. Fifty
negative output hashes remain unchanged. The static scope/import audit has
no findings.

The full native comparison is 16/17. The remaining case has five stale cursors
from a confirmed C recording defect after early raw output. Its entire original
eight-case diagnostic and exit 1 remain in the menu-binding evidence. The
maintained corpus contains the seven unaffected segments without changing
their inputs or recorded outputs. It does not treat the diagnostic as passing.

The original missing-argument invocation, status report metadata mismatch and
promotion verifier path failure are retained. Their corrections change neither
runtime behavior nor test assertions. The parent verification records their
scope. These results establish the tested behavior, not complete port coverage
or literal serialized-byte equality.
