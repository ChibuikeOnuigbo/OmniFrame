# Subscription tutorial audit queue

The supplied YouTube subscriptions export contains 211 unique public channel
IDs. It is now a reproducible audit input rather than a list treated as watched
evidence.

`scripts/build-subscription-audit-queue.py` performs two separate stages:

1. Offline planning ranks tutorial/editing-named channels and divides all 211
   channels into 36 deterministic six-channel batches.
2. On the existing GitHub audit runner, yt-dlp inventories positions 1–500 of
   both Videos and Shorts for each selected channel using the owner's optional
   cookie secret. Video titles are classified for tutorial phrases, editor
   names and editing techniques. Twenty candidates are selected round-robin
   across those channels for the decoded frame/audio-evidence path.

Batch 1 contains Zept Tutorials, Dr. Xenios Tutorials, Wizzy Tutorials, Tyson
Tutorials, Zenny Tutorials and mxtstutorials. The trigger is set to
`mode=subscriptions`, `batch=1`. Future batches change the trigger batch number;
older pages use `playlist_start` and `playlist_end` trigger fields when a tab
exceeds the recorded 500-title page.

The raw export and generated 211-channel plan are under
`research/youtube-subscriptions/`. `qa/subscription-audit-queue-unit.py` checks
the exact channel count, unique IDs, batch coverage and tutorial-classifier
boundaries. Workflow YAML parses successfully.

No new “watched” count is claimed at commit time. A title inventory is not a
viewing review. A video advances only to `FOOTAGE_ACQUIRED` after the audit
runner downloads media and decodes timestamped frames; human visual/audio
review remains a separate status.

The first run verified 389 candidates across five channels, then exposed an
empty Shorts tab represented by yt-dlp as JSON `null`. Empty tabs are now a
normal zero-item result and the same batch is retriggered.

Decoded frames from that retry revealed a second issue: a tutorial-named
channel was allowing unrelated challenge and free-clip uploads. The classifier
now requires a tutorial phrase or a specific technique after removing editor
names such as “After Effects” from the technique text. Challenge/free-clip and
product-showcase titles are regression-tested as non-candidates. Batch 1 is
retriggered with the refined queue.

## Refined batch 1 result

GitHub Actions run `42432257986` completed in 10m08s and committed evidence as
`fd44ee28`. It inventoried 889 unique Videos/Shorts entries and classified 814
as tutorial or technique candidates. The round-robin selection acquired 20/20
videos across all six channels using `yt-dlp default+cookies`:

- Zept Tutorials: 4
- Dr. Xenios Tutorials: 4
- Wizzy Tutorials: 3
- Tyson Tutorials: 3
- Zenny Tutorials: 3
- mxtstutorials: 3

The selected sources total 7,460.198 seconds (2.07 hours). Extraction produced
343 timestamped uniform/scene frames and 60 audio diagnostics. Every record is
`FOOTAGE_ACQUIRED`; `visual_review` and listening remain `pending`. The refined
midpoint contact sheet was inspected and shows workflows around 4K cleanup,
colour correction/LUTs, flow and AE-like transitions, sound design, phone 3D,
CapCut overlays, 3D book/card motion, text effects, shakes and time remapping.
One sampled frame per video is not continuous viewing.

Current editor mapping from that sampled evidence:

| Observed topic | OmniFrame state |
|---|---|
| Colour correction and LUTs | Editable LUT/adjustment stack exists. |
| Flow/AE-like transitions | Transition catalog, curves and compounds exist; tutorial-specific recreations are pending. |
| 3D book/card motion | Card Flip and 3D object/device systems exist; exact tutorial parity is pending. |
| Overlays and text effects | Editable overlay beds, effect regions and text effects exist. |
| Shake effects | Imported Shake Pack and keyframeable effect instances exist. |
| Time remapping | Fifteen tested speed curves exist in browser/headless source clocks. |
| 4K cleanup/upscaling | Candidate-model research exists; a universal 4K quality/performance claim is not established. |
| AI sound design and phone model generation | Audio editing and a 3D asset library exist; automatic SFX placement and a Tripo-equivalent generator are gaps. |

Runner evidence: `youtube-audit/runner/reports/subscriptions-batch1.json`,
`youtube-audit/runner/subscriptions/inventory.json` and the per-video folders
under `youtube-audit/runner/evidence/`.
