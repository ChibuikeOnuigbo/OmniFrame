import React, { useEffect, useState, useRef } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useEditor } from '../store'

export function AudioMeter() {
  const playing = useEditor((s) => s.playing)
  const masterVolume = useEditor((s) => s.masterVolume)
  const setMasterVolume = useEditor((s) => s.setMasterVolume)
  const masterMuted = useEditor((s) => s.masterMuted)
  const setMasterMuted = useEditor((s) => s.setMasterMuted)
  const clips = useEditor((s) => s.clips)
  const playhead = useEditor((s) => s.playhead)

  const [leftDb, setLeftDb] = useState(-60)
  const [rightDb, setRightDb] = useState(-60)
  const [peakLeftDb, setPeakLeftDb] = useState(-60)
  const [peakRightDb, setPeakRightDb] = useState(-60)

  const animRef = useRef<number>(0)

  useEffect(() => {
    let active = true

    const updateMeter = () => {
      if (!active) return

      if (playing && !masterMuted) {
        // Calculate audio presence from active audio/video clips at playhead
        const activeAudios = clips.filter(
          (c) => (c.kind === 'audio' || c.kind === 'video') && !c.hidden && playhead >= c.start && playhead <= c.start + c.duration,
        )

        if (activeAudios.length > 0) {
          // Compute nominal dynamic level modulated by volume
          const baseGain = masterVolume * (activeAudios[0].volume ?? 1)
          const timeMod = Math.sin(performance.now() / 150) * 4
          const randomJitter = (Math.random() - 0.5) * 6
          const currentDbL = Math.max(-60, Math.min(2, -18 + baseGain * 12 + timeMod + randomJitter))
          const currentDbR = Math.max(-60, Math.min(2, -19 + baseGain * 12 - timeMod + randomJitter))

          setLeftDb((prev) => prev * 0.4 + currentDbL * 0.6)
          setRightDb((prev) => prev * 0.4 + currentDbR * 0.6)

          setPeakLeftDb((prev) => Math.max(currentDbL, prev - 0.5))
          setPeakRightDb((prev) => Math.max(currentDbR, prev - 0.5))
        } else {
          setLeftDb((prev) => Math.max(-60, prev - 2.5))
          setRightDb((prev) => Math.max(-60, prev - 2.5))
          setPeakLeftDb((prev) => Math.max(-60, prev - 1.0))
          setPeakRightDb((prev) => Math.max(-60, prev - 1.0))
        }
      } else {
        setLeftDb(-60)
        setRightDb(-60)
        setPeakLeftDb((prev) => Math.max(-60, prev - 2.0))
        setPeakRightDb((prev) => Math.max(-60, prev - 2.0))
      }

      animRef.current = requestAnimationFrame(updateMeter)
    }

    animRef.current = requestAnimationFrame(updateMeter)
    return () => {
      active = false
      cancelAnimationFrame(animRef.current)
    }
  }, [playing, masterMuted, masterVolume, clips, playhead])

  // Convert dB (-60 to 0) to percentage (0 to 100)
  const dbToPct = (db: number) => {
    if (db <= -60) return 0
    if (db >= 0) return 100
    return Math.max(0, Math.min(100, ((db + 60) / 60) * 100))
  }

  const leftPct = dbToPct(leftDb)
  const rightPct = dbToPct(rightDb)
  const peakLeftPct = dbToPct(peakLeftDb)
  const peakRightPct = dbToPct(peakRightDb)

  return (
    <div
      data-testid="audio-vu-meter"
      className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-ink-800 bg-ink-950/80 text-[10px] text-ink-300 select-none"
    >
      {/* Mute button */}
      <button
        type="button"
        data-testid="audio-master-mute-btn"
        title={masterMuted ? 'Unmute Master Audio' : 'Mute Master Audio'}
        aria-label={masterMuted ? 'Unmute master' : 'Mute master'}
        onClick={() => setMasterMuted(!masterMuted)}
        className="p-1 rounded text-ink-400 hover:text-white hover:bg-ink-800 transition-colors"
      >
        {masterMuted ? <VolumeX size={13} className="text-red-400" /> : <Volume2 size={13} />}
      </button>

      {/* Stereo Dual Meters (L & R) */}
      <div className="flex flex-col gap-0.5 w-20">
        {/* Left Channel */}
        <div className="flex items-center gap-1">
          <span className="font-mono text-[9px] text-ink-500 w-2.5">L</span>
          <div className="relative h-1.5 flex-1 bg-ink-800 rounded-sm overflow-hidden">
            <div
              data-testid="vu-meter-left-bar"
              className={`h-full transition-all duration-75 ${
                leftDb > -3 ? 'bg-red-500' : leftDb > -12 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${leftPct}%` }}
            />
            {/* Peak hold notch */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm"
              style={{ left: `${peakLeftPct}%` }}
            />
          </div>
        </div>

        {/* Right Channel */}
        <div className="flex items-center gap-1">
          <span className="font-mono text-[9px] text-ink-500 w-2.5">R</span>
          <div className="relative h-1.5 flex-1 bg-ink-800 rounded-sm overflow-hidden">
            <div
              data-testid="vu-meter-right-bar"
              className={`h-full transition-all duration-75 ${
                rightDb > -3 ? 'bg-red-500' : rightDb > -12 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${rightPct}%` }}
            />
            {/* Peak hold notch */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm"
              style={{ left: `${peakRightPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Numerical Peak Display */}
      <div className="font-mono text-[9px] text-ink-400 w-9 text-right" data-testid="vu-meter-db-value">
        {masterMuted ? 'MUTE' : leftDb <= -58 ? '-∞ dB' : `${Math.round(Math.max(leftDb, rightDb))} dB`}
      </div>

      {/* Master Volume Slider */}
      <div className="flex items-center gap-1 pl-1 border-l border-ink-800">
        <input
          type="range"
          data-testid="master-volume-slider"
          aria-label="Master volume"
          min={0}
          max={1.5}
          step={0.05}
          value={masterMuted ? 0 : masterVolume}
          onChange={(e) => {
            setMasterVolume(parseFloat(e.target.value))
            if (masterMuted) setMasterMuted(false)
          }}
          className="of-range w-14"
        />
        <span className="font-mono text-[9px] text-ink-400 w-6">
          {masterMuted ? '0%' : `${Math.round(masterVolume * 100)}%`}
        </span>
      </div>
    </div>
  )
}
