# Contest score dashboard

Last refreshed: 2026-08-31T21:09:04.515Z. Local commit: `afa0f33`.
Leaderboard snapshot: 2026-08-31T06:22:08.448Z. Fork last scored: 2026-08-31T05:47:19.372Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 57151/57536 | 99.33% | 280/282 | 3393887/3393887 (100.00%) | 261/2186 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `afa0f33` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 106/106 | 0 | 0 |
| Explicit C branches | 480/517 | 0 | 37 |

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 57529/57536 |
| Cursor positions | 11405/11405 | 57151/57536 |
| Startup and per-turn estimate | 95+0.73/turn | 111+0.24/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 1.941 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-31T21:09:04.515Z | `afa0f33` | 11405/11405 | 57151/57536 | 6032/11265 | 3 |
| 2026-08-31T13:44:42.783Z | `9005c7c` | 11405/11405 | 56926/57311 | 6032/11265 | 3 |
| 2026-08-31T13:17:34.700Z | `df0df67` | 11405/11405 | 56825/57210 | 6032/11265 | 3 |
| 2026-08-31T12:38:12.886Z | `94ebe06` | 11405/11405 | 56474/56859 | 6032/11265 | 3 |
| 2026-08-31T12:12:08.753Z | `aa35496` | 11405/11405 | 56301/56686 | 6032/11265 | 3 |
| 2026-08-31T11:43:26.341Z | `ab27a1f` | 11405/11405 | 56126/56511 | 6032/11265 | 3 |
| 2026-08-31T11:17:57.743Z | `e50d7f2` | 11405/11405 | 55654/56039 | 6032/11265 | 3 |
| 2026-08-31T10:57:36.651Z | `2bd15d4` | 11405/11405 | 55454/55839 | 6032/11265 | 3 |
| 2026-08-31T10:30:33.193Z | `54c6f0a` | 11405/11405 | 55148/55533 | 6032/11265 | 3 |
| 2026-08-31T10:05:33.313Z | `d553d67` | 11405/11405 | 54767/55152 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
