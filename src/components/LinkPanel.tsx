import React, { useState } from 'react'
import {
  Link2,
  Unlink,
  AlignLeft,
  Move,
  Clock,
  Trash2,
  MousePointer,
  Lock,
  Eye,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  GitCommit,
  Plus,
} from 'lucide-react'
import { useEditor } from '../store'
import type { LinkRuleType, LinkSet, ParentRelationship, GroupInstance } from '../types'

export function LinkPanel() {
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const linkSets = useEditor((s) => s.linkSets)
  const parentRelationships = useEditor((s) => s.parentRelationships)
  const groups = useEditor((s) => s.groups)
  const createLinkSet = useEditor((s) => s.createLinkSet)
  const removeLinkSet = useEditor((s) => s.removeLinkSet)
  const toggleLinkRule = useEditor((s) => s.toggleLinkRule)
  const arrangeLinkedElements = useEditor((s) => s.arrangeLinkedElements)
  const createParentRelationship = useEditor((s) => s.createParentRelationship)
  const removeParentRelationship = useEditor((s) => s.removeParentRelationship)
  const createGroup = useEditor((s) => s.createGroup)
  const removeGroup = useEditor((s) => s.removeGroup)

  const activeClip = clips.find((c) => c.id === selectedClipId) || clips[0]

  // Find active link set containing active clip
  const activeLinkSet = activeClip
    ? linkSets.find((ls) => ls.memberIds.includes(activeClip.id))
    : linkSets[0]

  const activeParentRel = activeClip
    ? parentRelationships.find((pr) => pr.childId === activeClip.id || pr.parentId === activeClip.id)
    : parentRelationships[0]

  const activeGroup = activeClip
    ? groups.find((g) => g.memberIds.includes(activeClip.id))
    : groups[0]

  const [linkTargetId, setLinkTargetId] = useState<string>('')
  const [arrangedNotice, setArrangedNotice] = useState(false)

  const handleCreateNewLink = () => {
    if (!activeClip || !linkTargetId || activeClip.id === linkTargetId) return
    createLinkSet([activeClip.id, linkTargetId])
    setLinkTargetId('')
  }

  const handleArrange = (linkSetId: string) => {
    arrangeLinkedElements(linkSetId)
    setArrangedNotice(true)
    setTimeout(() => setArrangedNotice(false), 2500)
  }

  return (
    <div data-testid="link-panel" className="p-3 text-xs text-ink-200 select-none space-y-4 overflow-y-auto h-full">
      {/* Overview Banner */}
      <div className="p-3 rounded-xl border border-brand/30 bg-brand/10 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-brand text-xs">
          <Link2 size={14} />
          <span>Universal Link & Relationships</span>
        </div>
        <p className="text-[11px] text-ink-300 leading-relaxed">
          Policy-based multi-element linking, directional parenting hierarchies, and spatial groups.
        </p>
      </div>

      {/* Active LinkSet Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
            Link Sets ({linkSets.length})
          </span>
          {activeLinkSet && (
            <button
              type="button"
              data-testid="unlink-set-btn"
              onClick={() => removeLinkSet(activeLinkSet.id)}
              className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300"
            >
              <Unlink size={11} />
              <span>Unlink Set</span>
            </button>
          )}
        </div>

        {activeLinkSet ? (
          <div data-testid="active-link-card" className="p-3 rounded-xl border border-ink-800 bg-ink-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink-100 text-xs">{activeLinkSet.name}</span>
              <span className="text-[10px] text-ink-500 font-mono">
                {activeLinkSet.memberIds.length} members
              </span>
            </div>

            {/* Linked Members List */}
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-ink-500 font-mono block">Members</span>
              <div className="flex flex-wrap gap-1">
                {activeLinkSet.memberIds.map((mId) => {
                  const memberClip = clips.find((c) => c.id === mId)
                  return (
                    <span
                      key={mId}
                      className={`px-2 py-0.5 rounded text-[10px] border ${
                        mId === activeClip?.id
                          ? 'border-brand bg-brand/20 text-white font-medium'
                          : 'border-ink-700 bg-ink-900 text-ink-300'
                      }`}
                    >
                      {memberClip?.name || mId}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Link Rules Toggles */}
            <div className="space-y-1.5 pt-2 border-t border-ink-800">
              <span className="text-[9px] uppercase tracking-wider text-ink-500 font-mono block">
                Synchronization Rules
              </span>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { key: 'motion', label: 'Motion', icon: Move },
                  { key: 'duration', label: 'Duration', icon: Clock },
                  { key: 'delete', label: 'Delete', icon: Trash2 },
                  { key: 'selection', label: 'Selection', icon: MousePointer },
                  { key: 'visibility', label: 'Visibility', icon: Eye },
                  { key: 'lock', label: 'Lock', icon: Lock },
                ].map(({ key, label, icon: Icon }) => {
                  const active = activeLinkSet.rules[key as LinkRuleType]
                  return (
                    <button
                      key={key}
                      type="button"
                      data-testid={`rule-toggle-${key}`}
                      onClick={() => toggleLinkRule(activeLinkSet.id, key as LinkRuleType)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left text-[11px] transition-colors ${
                        active
                          ? 'border-brand/60 bg-brand/15 text-white font-medium'
                          : 'border-ink-800 bg-ink-900 text-ink-400 hover:text-ink-200'
                      }`}
                    >
                      <Icon size={12} className={active ? 'text-brand' : 'text-ink-500'} />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Arrange Linked Elements Action */}
            <div className="pt-2 border-t border-ink-800">
              <button
                type="button"
                data-testid="arrange-linked-btn"
                onClick={() => handleArrange(activeLinkSet.id)}
                className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-ink-800 hover:bg-ink-700 border border-ink-700 text-ink-100 font-medium text-xs transition-colors"
                title="Horizontally aligns linked elements in time while preserving separate tracks and untouched unrelated clips"
              >
                <AlignLeft size={13} className="text-brand" />
                <span>Arrange Linked Elements</span>
              </button>

              {arrangedNotice && (
                <div data-testid="arrange-success-alert" className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <CheckCircle2 size={12} />
                  <span>Linked elements aligned horizontally; separate tracks preserved.</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-ink-800 bg-ink-950/40 space-y-2 text-center text-ink-500">
            <p className="text-[11px]">No active link set for selected clip.</p>
            {activeClip && (
              <div className="flex gap-2">
                <select
                  data-testid="link-target-select"
                  value={linkTargetId}
                  onChange={(e) => setLinkTargetId(e.target.value)}
                  className="flex-1 h-7 px-2 rounded bg-ink-900 border border-ink-700 text-[11px] text-ink-200"
                >
                  <option value="">Select clip to link...</option>
                  {clips
                    .filter((c) => c.id !== activeClip.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  data-testid="create-linkset-btn"
                  disabled={!linkTargetId}
                  onClick={handleCreateNewLink}
                  className="h-7 px-2.5 rounded bg-brand text-white font-medium text-[11px] disabled:opacity-40"
                >
                  Link
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Directional Parenting Section */}
      <div className="space-y-2 pt-2 border-t border-ink-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
            Directional Parenting
          </span>
          {activeParentRel && (
            <button
              type="button"
              data-testid="remove-parenting-btn"
              onClick={() => removeParentRelationship(activeParentRel.childId)}
              className="text-[10px] text-red-400 hover:text-red-300"
            >
              Unparent
            </button>
          )}
        </div>

        {activeParentRel ? (
          <div data-testid="parent-relationship-card" className="p-2.5 rounded-lg border border-ink-800 bg-ink-900/60 text-[11px] space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-ink-200">
              <span className="text-brand">Child:</span>
              <span>{clips.find((c) => c.id === activeParentRel.childId)?.name || activeParentRel.childId}</span>
              <span className="text-ink-500">→</span>
              <span className="text-emerald-400">Parent:</span>
              <span>{clips.find((c) => c.id === activeParentRel.parentId)?.name || activeParentRel.parentId}</span>
            </div>
            <p className="text-[10px] text-ink-500">One-way hierarchical transform inheritance without cycles.</p>
          </div>
        ) : (
          <div className="text-[11px] text-ink-500 text-center p-2 rounded border border-ink-800">
            No parent assigned. Use Inspector to parent clip.
          </div>
        )}
      </div>

      {/* Spatial Groups Section */}
      <div className="space-y-2 pt-2 border-t border-ink-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
            Spatial Groups ({groups.length})
          </span>
        </div>

        {activeGroup ? (
          <div data-testid="active-group-card" className="p-2.5 rounded-lg border border-ink-800 bg-ink-900/60 text-[11px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={13} className="text-brand" />
              <span className="font-medium text-ink-200">{activeGroup.name}</span>
              <span className="text-[10px] text-ink-500 font-mono">({activeGroup.memberIds.length} items)</span>
            </div>
            <button
              type="button"
              data-testid="ungroup-btn"
              onClick={() => removeGroup(activeGroup.id)}
              className="text-[10px] text-red-400 hover:text-red-300"
            >
              Ungroup
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-ink-500 text-center p-2 rounded border border-ink-800">
            No group selected. Select multiple clips on timeline and press Group.
          </div>
        )}
      </div>
    </div>
  )
}
