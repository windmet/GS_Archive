# Mounted domain sources and versioned route producers

Input HEAD: `885f7d04`. Only verified JSON was promoted; no media packages were generated or copied.

The P0 skill repair now replaces `skills_by_id` in the mounted card detail dictionary. Its original bytes and promotion receipt are preserved at `E:/Web_build/GS_Archive_Domain_Work/mounted-backup-885f7d04`. Card data SHA256 changed from `810c01082f367b859ce76c911cefa5e1a94dae5ae0a67ef3d413a13d6215e6a3` to `00e2793eb3ed28c8c4e09a1852a46e21fcda1c626b2eb4b68b35732b24f732bf`. All non-skill dictionaries remain unchanged.

`public/data/masterdata/domains/` contains the 1251 transport-whitelisted JSON files (12,196,745 bytes) from the verified domain extractor. Raw/audit/global reward and backlink dumps remain outside the repository. The runtime UI will consume versioned read models, rather than these source catalogs directly.

The new offline producer verifies source envelope identity and joins:

- 59 historical events, preserving all 36 established story-event URLs. New event identities use `event:<eventCode>`. Reprints keep distinct event identity while reusing their explicit original story chapter; original reward-card links are retained only for the original event.
- 535 items and 1613 honors with typed and explicitly partial source links. Acquisition conditions are not inferred from names or prefab presence.
- 49 photo-idol records plus one material record, retaining script/config names without interpreting `animationName` as a Spine motion.

Every consumed source shard is hashed into release provenance and rechecked after generation. Items/honors share bounded detail pages selected by entity ID, preserving the existing 9000-file and 192-KiB page budgets. Generic detail budget remains 768 KiB; the bounded runtime cache is unchanged.

Validation: read-model suite passed 43 cases before the added packed-page case; actual checkout projection counts and original/reprint identities passed. Python skill regression verified 836 source card records and 2672 costume relationships. The new packed-page test verifies every selected entity and descriptor closure. Source-only verification does not imply Browser, media, device or deployment acceptance. Frontend and bootstrap refresh follow in the next scoped batch.
