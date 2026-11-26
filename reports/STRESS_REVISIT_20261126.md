# Follow-up stress validation — 26 November 2026

Ran four targeted browser scripts against the current renderer. No new production
code defect was reproduced; this commit adds tests rather than speculative fixes.

- Built 100 video assets/clips with blur and 100 catalog effects using the same
  authorized fixture with distinct blob URLs. Visited enough clips to evict the
  first decoder; verified its DOM removal and cleared source attribute.
- Alternated distant clips, including 0/99 and 1/98. Evicted videos decoded again.
  Automated revisit waits were 7–100 ms in this run; these include polling and
  are not a controlled comparison with earlier stress timings.
- Issued rapid forward/backward seeks and checked final decoder time/readiness.
  Playback crossed clip boundaries; pause stopped all cached playback videos.
  New Project cleared the clips and removed cached playback elements.
- Real stereo calibration passed: half volume reduced signal by about 6 dB.
  Added assertions that detached audio falls below −70 dB and reconnecting
  restores the previous gain without creating duplicate source nodes.
- Filmstrip workflow passed 14 assertions, including 14 distinct real video
  tiles, 14 distinct compound tiles and entering the nested sequence.
- Live MCP workflow passed mask defaults, Undo, moves/keyframes/curves,
  persistence, invalid input rejection and timeline output; 25 tools exposed.

Evidence: qa-output/stress-revisit/. Existing media and older QA snapshots remain
intact. The test still reuses one source, does not prove 100 unique-file import
throughput, sustained audible boundary continuity, exact displayed frames, or
4K/hardware performance. Audio calibration is separate from the 100-clip project.
Full unit/build gates were not repeated: application source is unchanged from
the prior verified revision. Remaining priorities are realistic long-GOP footage,
seek-to-present measurement, sustained A/V sync and multi-layer GPU profiling.
