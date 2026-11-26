# Required binding-parameter consumer

The original pre-candidate plan named three files. The raw-byte controls exposed
one additional actual consumer before runtime edits: cmd.js bind_key. The final
candidate therefore changes four files, all on fixed f227. The original plan,
audit-files list, input locks and audit receipt remain preserved as the initial
review stage. This addendum records the reason for the extension.

Complete C cmd.c2662-2730 bind_key copies the command to a temporary C buffer,
splits a parenthesized parameter, then stores min(30,strlen(param)) bytes. Complete
current JS bind_key instead UTF8-encodes the parameter before storing it. That is
correct for its existing Unicode-facing caller. A raw BINDINGS handoff needs an
explicit byte input to bypass that encoding. Otherwise e2 82 ac becomes c3 a2 c2
82 c2 ac. No parser-only repair can correct this without writing another owner's
state after its return or decoding a potentially incomplete sequence.

Read the complete C/JS bind_key owner, cmdbind_get/add/remove stores, default
command bindings and actual JS callers. Read complete C/JS keylist_putcmds and
dokeylist, dotoggleoption and toggle_bool_option; also read the C changed-binding
serializer and interactive binding producer. Actual JS calls to bind_key are
parsebindings and the ASCII default initialization. The raw parameter is consumed
by key listing and toggle_bool_option. No unrelated command handler is changed.

Two new ordinary controls were separately named and locked before runtime edits:
`recipes/binding-param-proposals.json`, SHA
2cc01a3a5cbd6de5459011bf674e175ee1606db88ab142ec7f96137a51f186b4,
and lockSHA2a76bb425087839872232a4976cce12ac5c846960a6a20e951755055bff4fe2a.
They use real RC BIND=A:toggle(...), then ordinary ?j input. Both reach the actual
key-list line at step5. The UTF8 control stores e282ac and displays three blank
cells between quotes; the ASCII control stores and displays time. Both have no
parser error, full observer/plain/deferred equality and ten baseline hashes locked.
The candidate retains all ten hashes. No C result is claimed for these two yet.
Their primary recipe and input lock are in binding-native-handoff.json for parent.

The added cmd.js hunk only recognizes an explicit Uint8Array command, forms its
C-byte view and copies raw parameter bytes directly. Existing Unicode callers
keep the original encoding. It adds no runtime export, flag, alternate command
implementation or rendering change. This is required consumer work, not a blanket
handler conversion. The other three files implement the reviewed byte reader,
symbol/key/pattern entry points and OPTIONS recursion as planned.

The source28 controls were locked before these edits. The first setup assumed
numeric C step keys; the second captured a stale game object across resetGame.
Both failures remain, with exact derivation receipts. Version3 observes the live
module binding and uses the recorded one-character keys. Its28 names and C
predictions are unchanged. Baseline12/28 becomes candidate28/28. Symbol52 is
unchanged and passes on both graphs. Initial retained fruit gate invocations lacked
the four documented portable dependencies; those pre-import failures are also
preserved. Only verified links were added, and the unchanged five gates then pass.
