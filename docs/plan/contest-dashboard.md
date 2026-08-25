# Contest score dashboard

Last refreshed: 2026-08-25T19:10:27.504Z. Local commit: `2c7ee7b`.
Leaderboard snapshot: 2026-08-25T13:53:33.751Z. Fork last scored: 2026-08-25T13:18:07.116Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 8713/11405 | 76.40% | 39/44 | 513664/792838 (64.79%) | 6/1483 |
| Public leaderboard | 6642/11405 | 58.24% | 34/44 | 49.80% | 6/1483 |
| Held-out leaderboard | 4256/11265 | 37.78% | 1/44 | 16.82% | 0/2959 |
| Supplemental C suite | 2027/3739 | 54.21% | 23/40 | 379332/470994 (80.54%) | 0/75 |

## Contest position and generalization

- Held-out rank: **5/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.641**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 8717/11405 | 2027/3739 |
| Cursor positions | 9765/11405 | 2701/3739 |
| Startup and per-turn estimate | 74+0.36/turn | 52+0.58/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.337 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 17867.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-25T19:10:27.504Z | `2c7ee7b` | 8713/11405 | 2027/3739 | 4256/11265 | 5 |
| 2026-08-25T18:49:44.860Z | `25a411b` | 8713/11405 | 2022/3739 | 4256/11265 | 5 |
| 2026-08-25T18:44:19.278Z | `9a0fbca` | 8713/11405 | 2019/3739 | 4256/11265 | 5 |
| 2026-08-25T18:39:56.399Z | `5f67cfd` | 8713/11405 | 2019/3739 | 4256/11265 | 5 |
| 2026-08-25T18:05:11.157Z | `ce87fbf` | 8711/11405 | 2012/3739 | 4256/11265 | 5 |
| 2026-08-25T17:56:06.702Z | `4e1cb46` | 8711/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T17:41:12.331Z | `3c2d1b8` | 8668/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T17:27:45.262Z | `0d0c87e` | 8638/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T17:22:25.598Z | `92ef4f2` | 8548/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T17:01:55.529Z | `e3b2a1f` | 8356/11405 | 1999/3739 | 4256/11265 | 5 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
