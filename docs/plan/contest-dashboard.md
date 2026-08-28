# Contest score dashboard

Last refreshed: 2026-08-28T08:24:07.244Z. Local commit: `0589dfd`.
Leaderboard snapshot: 2026-08-27T10:30:40.033Z. Fork last scored: 2026-08-27T09:55:38.417Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-28T05:45:18.000Z. The page reported Updated 5h ago and displayed the same visible scores.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 22136/22521 | 98.29% | 123/125 | 1731893/1731893 (100.00%) | 14/431 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `0589dfd` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 22514/22521 |
| Cursor positions | 11405/11405 | 22136/22521 |
| Startup and per-turn estimate | 64+0.52/turn | 106+0.15/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 2.452 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-28T08:24:07.244Z | `0589dfd` | 11405/11405 | 22136/22521 | 6032/11265 | 3 |
| 2026-08-28T08:14:09.550Z | `ba9ce99` | 11405/11405 | 22022/22407 | 6032/11265 | 3 |
| 2026-08-28T07:44:01.182Z | `5735a7e` | 11405/11405 | 21540/21925 | 6032/11265 | 3 |
| 2026-08-28T07:35:15.744Z | `bc2b9e6` | 11405/11405 | 21474/21859 | 6032/11265 | 3 |
| 2026-08-28T07:24:10.303Z | `46d5d58` | 11405/11405 | 21139/21524 | 6032/11265 | 3 |
| 2026-08-28T07:12:29.734Z | `f2649a0` | 11405/11405 | 21053/21438 | 6032/11265 | 3 |
| 2026-08-28T07:01:09.794Z | `fe2b6f8` | 11405/11405 | 20968/21353 | 6032/11265 | 3 |
| 2026-08-28T06:51:38.136Z | `d6ea625` | 11405/11405 | 20778/21163 | 6032/11265 | 3 |
| 2026-08-28T06:42:21.318Z | `253f76b` | 11405/11405 | 20720/21105 | 6032/11265 | 3 |
| 2026-08-28T06:26:02.150Z | `56ce89c` | 11405/11405 | 20538/20923 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
