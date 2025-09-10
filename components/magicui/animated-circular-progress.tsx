"use client"

import React from "react"

interface AnimatedCircularProgressProps {
  size?: number // px
  strokeWidth?: number // px
  progress: number // 0..100
  trackColor?: string
  progressColor?: string
  className?: string
  label?: React.ReactNode
}

/**
 * Minimal animated circular progress ring using SVG.
 * - Animates strokeDashoffset via CSS transition for smooth updates.
 */
export function AnimatedCircularProgress({
  size = 80,
  strokeWidth = 8,
  progress,
  trackColor = "#E5E7EB", // gray-200
  progressColor = "#4F46E5", // indigo-600
  className = "",
  label,
}: AnimatedCircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, isFinite(progress) ? progress : 0))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className={className} style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-sm font-medium"
        style={{ transform: "rotate(0deg)" }}
      >
        {label ?? `${Math.round(clamped)}%`}
      </div>
    </div>
  )
}
