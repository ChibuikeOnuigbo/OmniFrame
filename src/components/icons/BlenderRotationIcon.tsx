import React from 'react'

interface Props extends React.SVGProps<SVGSVGElement> {
  size?: number
  className?: string
}

/**
 * Authentic Blender 3D Rotation Gizmo / Tool Icon
 * Features the canonical 3-axis rotation rings (X=Red, Y=Green, Z=Blue)
 * with curved directional rotation arcs and central pivot point.
 */
export function BlenderRotationIcon({ size = 16, className = '', ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="blender-rotation-icon"
      aria-label="Blender 3-axis rotation gizmo"
      className={`inline-block shrink-0 ${className}`}
      {...props}
    >
      {/* Outer trackball ring / sphere outline */}
      <circle cx="12" cy="12" r="9.5" stroke="#64748B" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.6" />

      {/* Red X-axis rotation ellipse */}
      <ellipse
        cx="12"
        cy="12"
        rx="8.5"
        ry="4.5"
        transform="rotate(-25 12 12)"
        stroke="#EF4444"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Green Y-axis rotation ellipse */}
      <ellipse
        cx="12"
        cy="12"
        rx="8.5"
        ry="4.5"
        transform="rotate(65 12 12)"
        stroke="#10B981"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Blue Z-axis horizontal rotation ring with directional arrow */}
      <ellipse
        cx="12"
        cy="12"
        rx="8.5"
        ry="3"
        stroke="#3B82F6"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Blender rotation curved arrow head */}
      <path
        d="M19.5 10.5L21.5 12.5L19 14.5"
        stroke="#3B82F6"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Central pivot point */}
      <circle cx="12" cy="12" r="1.5" fill="#F8FAFC" />
    </svg>
  )
}
