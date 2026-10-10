/**
 * ClipFilmstrip — the thumbnail strip inside a timeline clip.
 *
 * Each tile shows the frame the project will actually show at that point in
 * the clip: real decoded video frames for plain clips, the rendered nested
 * composite for compound clips (see lib/clipFilmstrip). While tiles are
 * still rendering, the old lightweight fallback (single poster frame /
 * compound wireframe bars) stays visible so clips never flash empty.
 */

import { useEffect, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import { useEditor } from '../store'
import {
  compoundContentKey,
  renderClipFilmstrip,
  type FilmstripTile,
} from '../lib/clipFilmstrip'
import type { Clip } from '../types'

const MAX_RETRIES = 3

export function ClipFilmstrip({
  clip,
  widthPx,
  posterUrl,
  isCompound,
}: {
  clip: Clip
  widthPx: number
  /** Legacy single-frame poster (asset.thumbnail or an image URL). */
  posterUrl?: string
  isCompound?: boolean
}) {
  const [tiles, setTiles] = useState<FilmstripTile[] | null>(null)
  const [attempt, setAttempt] = useState(0)
  const loadedRef = useRef(false)

  // Compound clips: hash the nested content so edits inside the compound
  // re-render its thumbnails. Plain clips hash to a constant.
  const contentKey = useEditor((s) =>
    clip.kind === 'compound' ? compoundContentKey(clip, s) : '',
  )

  useEffect(() => {
    let cancelled = false
    loadedRef.current = false
    setTiles(null)
    renderClipFilmstrip(clip, widthPx)
      .then((out) => {
        if (cancelled || out.length === 0) return
        const complete = out.every((tile) => tile.dataUrl)
        if (complete) {
          loadedRef.current = true
          setTiles(out)
        } else if (attempt < MAX_RETRIES) {
          // Media was still decoding — try again shortly.
          setTimeout(() => {
            if (!cancelled && !loadedRef.current) setAttempt((a) => a + 1)
          }, 700)
        } else {
          setTiles(out) // show what we have
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [
    clip,
    widthPx > 8 ? Math.round(widthPx / 8) : 0,
    contentKey,
    attempt,
  ])

  if (tiles && tiles.length > 0) {
    return (
      <div
        data-testid="clip-filmstrip"
        data-tiles={tiles.length}
        data-state="rendered"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {tiles.map((tile, i) => (
          <img
            key={i}
            data-testid="clip-filmstrip-tile"
            data-frame-time={tile.t.toFixed(3)}
            data-tile-index={i}
            src={tile.dataUrl}
            alt=""
            draggable={false}
            className="absolute top-0 bottom-0 h-full w-full object-cover opacity-60"
            style={{ left: `${tile.leftPct}%`, width: `${tile.widthPct}%` }}
          />
        ))}
        <div className="absolute inset-0 bg-ink-950/15" />
      </div>
    )
  }

  // Loading fallback: legacy look (poster frame tiled / compound bars).
  return (
    <div
      data-testid="clip-filmstrip"
      data-state="loading"
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      {isCompound ? (
        <div className="absolute inset-0 flex flex-col justify-around py-1 px-1 opacity-15">
          <div className="h-1.5 w-3/4 rounded bg-indigo-400" />
          <div className="h-1.5 w-1/2 rounded bg-purple-400 ml-4" />
          <div className="h-1.5 w-2/3 rounded bg-sky-400" />
          <Layers size={10} className="mx-auto text-indigo-300" />
        </div>
      ) : posterUrl ? (
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage: `linear-gradient(90deg,rgba(8,9,13,.15),rgba(8,9,13,.15)),url(${posterUrl})`,
            backgroundRepeat: 'repeat-x',
            backgroundPosition: 'center',
            backgroundSize: 'auto 100%',
          }}
        />
      ) : null}
    </div>
  )
}
