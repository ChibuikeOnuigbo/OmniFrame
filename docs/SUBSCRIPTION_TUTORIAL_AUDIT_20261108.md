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
