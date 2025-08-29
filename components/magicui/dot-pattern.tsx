"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type DotPatternProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: number; // px between dots
  dotSize?: number; // px size of dot
  color?: string; // any css color
  opacity?: number; // 0..1
};

/**
 * Lightweight dot background built with CSS radial-gradients.
 * Renders as an absolutely positioned layer by default.
 */
export function DotPattern({
  className,
  size = 24,
  dotSize = 2,
  color = "rgba(255,255,255,0.15)",
  opacity = 1,
  style,
  ...props
}: DotPatternProps) {
  const background = `radial-gradient(${color} ${dotSize}px, transparent ${dotSize + 0.5}px)`;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage: background,
        backgroundSize: `${size}px ${size}px`,
        opacity,
        ...style,
      }}
      {...props}
    />
  );
}

export default DotPattern;
