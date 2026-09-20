# Communication presentation and reading closeout — 2026-09-20

Input: `codex/runtime-audit-closeout` at `5b5f2e4`. Scope follows the new communication audit and the user's phone-layout feedback; source documents are references, not execution authority.

## Decisions and changes

- Shared step presentation projection drives StoryViewer and asset priority. Calls/chats do not gate on hidden actors. A direct communication entry does not mount SpineStage; a previously mounted stage retains its last step and stops its application ticker under communication. Page visibility cannot restart a suspended stage. Returning to stage restores normal source projection/readiness.
- Empty setup/transition steps adjacent only to communication and without actors do not require WebGL; authored step navigation is preserved. Explicit ADV and stage commands override stale legacy phone flags; choices inherit their actual preceding communication context, stopping at ADV/title boundaries.
- Asset discovery still retains snapshot/model evidence. Stage-only uses in communication are not Critical; upcoming stage uses still become Near through the existing bounded lookahead. Source voice dependencies remain intact. Communication images are warmed with cancellation before playable; missing art uses UI fallbacks and warns rather than blocking readable text. This is not a new transactional scene engine or an unlimited branch prefetcher.
- Reader rows retain a lightweight `presentation` hint rather than changing dialogue kinds: this preserves identity, typography and existing row consumers. Source stamps have independent anchored media rows and an image-error fallback; no invented text. Single-path mixed stories can become readable; unsupported branch exits remain unsupported. Standalone Mobile Archive gets no additional Reader entry.
- Generated source-backed corpus: 2800 documents, 2489 ready / 311 unsupported (four mixed stories formerly rejected solely for stamps now ready). Existing text/source hashes and anchors checked. The broad-looking JSON diff is generated communication metadata plus stamp rows, not rewritten dialogue.
- Final call layout follows the user's preference for the original phone interaction: portrait device, slight tilt, full personal background, centred avatar and in-phone dialogue remain. Only the desktop ratio (0.72 → 0.8), avatar size and text padding/width are adjusted. The explored horizontal artwork/card composition was rejected by the user and removed; it is not the final product. Text scrolling resets for each new line/language. Very short viewports or exceptionally long bilingual content can still require scrolling within the original phone; text is not shrunk or truncated to hide that limit.
- The choice rail occupies a real row on mobile, preventing it from covering the conversation.

## Verification

- `verify-communication-presentation.mjs`: standalone / ADV-call-ADV / ADV-talk-choice-talk-ADV, stale flags, priority retention, authored voice, source stamp anchors, unsupported branching, actor readiness bypass, stage resumption and stale image cancellation.
- Communication asset parity, asset priority, interaction matrix, stage loading/position clock, loading safety/audio, Reader document integrity (2800), typography and `npm run build:check` pass.
- Full `verify:reading` reaches and passes catalog/progress/documents/identity/repository/navigation/playback, then reproduces the existing Windows Vite SSR `transport invoke timed out after 60000ms` in `verify-reading-render.mjs` (this run traversing CommunicationUiAssets via AssetResolver). It is not reported as a passing full gate. No test timeout or assertion was weakened.
- Build output: reusable `.analysis/build-check`, `copyPublicDir:false`, no full asset package. Relevant logs: `.analysis/communication-*.log`.
- Browser: actual 5175 IAB routes, phone Next/choice, desktop and mobile artwork/text geometry, direct-call canvas absence; mixed-story transitions and Reader stamps checked separately below. IAB is not real Edge hardware/performance acceptance.

## Deliberate limits

No E1 actor-projection rewrite, guessed branch reconvergence, new standalone Reader product, PNG re-upload, cloud deployment or claim of long-session GPU acceptance. These changes remove hidden stage work; they cannot make Edge's Microsoft Basic Render Driver hardware accelerated.

Additional source finding: the reference's assumption that calls currently have no voices is false for the user's Ren example. Step 3 declares `2_3_040_03_09_a1001.m4a`. Authored voice playback is preserved; only hidden stage mouth animation/lip data loading is suppressed on communication surfaces.

Browser evidence completed: `episodes/1_3_10017_01_j.json` call → stage returned to a visible Kyoji scene with one unsuspended Canvas; `episodes/1_4_001_02_e.json` stage → talk retained one Canvas with `data-presentation-suspended=true`; its Reader stamp anchor `step-36:stamp` rendered the actual stamp and continuous neighbouring messages with 短信 labels.

Final direction supersedes the earlier artwork/card screenshots: retain the original phone composition, with modest readability adjustments. All 52 local mobile backgrounds were checked as 688×1000; the complete source background remains installed on the device.

Final visual acceptance after restoring the original phone design: 1280×800 desktop and 390×667 mobile, Ren `040ren_303_2_3_040_03_09_a.json` steps 3→4→5 (long line → choice → reply). Full original background and centred portrait remain; no horizontal overflow; the mobile text panel measured clientHeight=scrollHeight=273, including the selected reply. Direct entry had zero Canvas nodes. The final build:check passed in 11.95 s. Earlier horizontal-card screenshots are superseded.
