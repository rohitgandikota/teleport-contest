# Contest score dashboard

Last refreshed: 2026-08-30T20:20:52.701Z. Local commit: `c14098a`.
Leaderboard snapshot: 2026-08-30T17:31:26.469Z. Fork last scored: 2026-08-30T16:55:52.282Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 39172/39557 | 99.03% | 208/210 | 2679325/2679325 (100.00%) | 88/1760 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `c14098a` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 39550/39557 |
| Cursor positions | 11405/11405 | 39172/39557 |
| Startup and per-turn estimate | 68+0.61/turn | 105+0.24/turn |

## Latest local expansion

- `amulet()` now follows `src/wizard.c` for sleeping Wizards: dead monsters are skipped, each live sleeper receives one ordered `rn2(40)` wake roll, and the first successful roll wakes that Wizard.
- A distant wake prints the creepy-feeling warning. Awake Wizards and an empty Wizard count consume no wake RNG.
- The focused late-game C oracles remain exact at 50356/50356 RNG calls and 530/530 screens, cells, and cursors.
- The new deterministic state gate covers dead-Wizard skipping, failed and successful ordered rolls, wake state, the distant warning, and both no-draw paths.
- The former `amulet:wake_wizard` marker no longer appears in any of the 210 supplemental sessions.
- Deterministic coverage remains 105/105 game elements and 126/126 named C branches. Public remains 44/44, the hang gate remains 44/44, and 80 fresh games across 13 roles reached no unported path.
- This checkpoint has not been scored by the hidden judge. The displayed held-out result is from the last published build.

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 1.988 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-30T20:20:52.701Z | `c14098a` | 11405/11405 | 39172/39557 | 6032/11265 | 3 |
| 2026-08-30T20:10:00.784Z | `245ff75` | 11405/11405 | 39172/39557 | 6032/11265 | 3 |
| 2026-08-30T19:49:59.418Z | `e080258` | 11405/11405 | 38746/39131 | 6032/11265 | 3 |
| 2026-08-30T19:27:48.323Z | `ac945f8` | 11405/11405 | 38680/39065 | 6032/11265 | 3 |
| 2026-08-30T19:17:32.901Z | `5a19514` | 11405/11405 | 38593/38978 | 6032/11265 | 3 |
| 2026-08-30T19:00:34.610Z | `5c12f8b` | 11405/11405 | 38398/38783 | 6032/11265 | 3 |
| 2026-08-30T18:40:25.838Z | `1e344aa` | 11405/11405 | 37936/38321 | 6032/11265 | 3 |
| 2026-08-30T18:10:36.798Z | `715ed63` | 11405/11405 | 37244/37629 | 6032/11265 | 3 |
| 2026-08-30T18:00:43.993Z | `1b21bb8` | 11405/11405 | 37051/37436 | 6032/11265 | 3 |
| 2026-08-30T17:44:51.360Z | `a53e7a8` | 11405/11405 | 36382/36767 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
