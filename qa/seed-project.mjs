/**
 * Seeds a realistic project into the running app.
 *
 * The app boots with zero tracks and zero clips, which means most of the
 * editing UI -- anything that acts on a selection -- renders nothing. Auditing
 * that state measures an empty shell. This populates the store the way a user
 * would: a couple of tracks, clips on them, a selection, markers and a text
 * layer, so the audit walks the UI people actually use.
 *
 * Returns a short summary of what got created for logging.
 */
export async function seedProject(page) {
  return page.evaluate(() => {
    const st = window.__omniframe_store?.getState?.()
    if (!st) return { error: 'no store' }
    const log = {}

    // Tracks
    const v1 = st.createTrack?.('video')
    const v2 = st.createTrack?.('video')
    const a1 = st.createTrack?.('audio')
    log.tracks = [v1, v2, a1].filter(Boolean).length

    // Clips from the demo assets
    const cur = () => window.__omniframe_store.getState()
    const assets = cur().assets || []
    const videoAssets = assets.filter((a) => a.kind === 'video' || a.kind === 'image')
    const audioAssets = assets.filter((a) => a.kind === 'audio')
    log.assets = assets.length

    const clipIds = []
    videoAssets.slice(0, 2).forEach((a, i) => {
      const tid = i === 0 ? v1 : v2
      try { cur().addClipToTrack?.(tid, a.id, i * 3) } catch (e) { /* asset type mismatch */ }
    })
    audioAssets.slice(0, 1).forEach((a) => {
      try { cur().addClipToTrack?.(a1, a.id, 0) } catch (e) { /* */ }
    })
    clipIds.push(...(cur().clips || []).map((c) => c.id))
    log.clips = clipIds.length

    // Select the first clip so selection-dependent panels render.
    if (clipIds.length) {
      cur().setSelectedClipId?.(clipIds[0])
      cur().setSelectedClipIds?.([clipIds[0]])
    }
    log.selected = cur().selectedClipId || null

    // A text layer, which unlocks the text tooling.
    try { cur().addTextTitleClip?.('Sample Title', 4.0) } catch (e) { /* */ }
    log.clipsAfterText = (cur().clips || []).length

    // Markers, so marker navigation and the marker list render.
    try {
      cur().addMarker?.({ time: 1.5, label: 'Intro', color: '#3b82f6' })
      cur().addMarker?.({ time: 4.0, label: 'Beat', color: '#ef4444' })
    } catch (e) { /* signature may differ */ }
    log.markers = (cur().markers || []).length

    // A character is already seeded; make sure one is selected.
    const chars = cur().omniframeCharacters || []
    if (chars.length && !cur().selectedCharacterId) cur().setSelectedCharacterId?.(chars[0].id)
    log.characters = chars.length

    return log
  })
}
