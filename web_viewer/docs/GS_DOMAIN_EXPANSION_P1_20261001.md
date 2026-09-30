# GS archive-domain parsing integration

Input source checkout: `053e49e3`; B002 was committed and pushed as `fe72c0dd` before this work.

The existing `masterdata_extract.py` facade now exposes `--archive-domains-only`. Its nine selected jobs retain their original ordering. The new job uses one named root-table registry from the full local IL2CPP schema, with a separately checked compact wire interpretation. It does not replace the legacy wire decoder. Field numbers, names and complete field sets are verified; these checks alone do not prove enum semantics or resource availability.

Nonempty input is bound to decoded PB SHA256 `25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1`. Typed Product resolution preserves unknown products and distinguishes scalar counters from entity references. Event type dispatch, reprints, historical dates, story rewards, photo group joins and partially known acquisition sources are explicit. Text projections remain inert plain text.

The public transport whitelist contains catalog indexes and lazy event, idol-photo, item-source and honor-source leaves. It excludes decoded PB, raw/named tables, global reward/backlink dumps, resource requirements, supplementary records and audit reports. Nested output paths must stay within their requested root.

## Verification

- `python scripts/verify-archive-domains.py --decoded-masterdata .analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb --reference E:/Web_build/GS_Archive_Domain_Work/verified-domains-25d48a55`: 14 semantic cases passed; all 1621 business outputs matched the independently verified package projection after removing only source-envelope metadata. Counts: 535 items, 1613 honors, 59 events, 7943 rewards, 49 photo-idol shards and 245 unique cue pairs.
- `python scripts/verify-masterdata-generation-jobs.py --decoded-masterdata .analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb`: all eight historical output hashes unchanged.
- Output transport and entrypoint regression scripts passed.
- Actual production CLI generated `E:/Web_build/GS_Archive_Domain_Work/integrated-domains-053e49e3` and its separate public whitelist in `integrated-public-053e49e3`. No media was copied.

This source batch is Python/tool logic. It does not require Vite compilation and has no Browser acceptance claim. Candidate artifacts have not been promoted to mounted public data. `publicationReady` remains false pending versioned frontend contracts, resource bindings and mounted Browser validation. The P0 card-skill repair candidate also remains separate until that refresh.
