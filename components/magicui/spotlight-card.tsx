"use client";

import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SpotlightCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  radius?: number; // px radius of the spotlight
  strength?: number; // 0..1 intensity of the light
}

/**
 * MagicUI-style spotlight hover card.
 * Follows mouse with a radial gradient and subtle border glow.
 */
export function SpotlightCard({
  className,
  children,
  radius = 200,
  strength = 0.25,
  ...props
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, active: false });

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true });
      }}
      onMouseLeave={() => setPos((p) => ({ ...p, active: false }))}
      className={cn(
        "relative rounded-2xl border bg-white/5 dark:bg-white/5",
        "border-white/10 backdrop-blur-sm",
        "transition-transform duration-200 will-change-transform",
        pos.active && "ring-1 ring-white/10",
        className,
      )}
      style={{
        backgroundImage: pos.active
          ? `radial-gradient(${radius}px ${radius}px at ${pos.x}px ${pos.y}px, rgba(255,255,255,${strength}), transparent 60%)`
          : undefined,
      }}
      {...props}
    >
      <div className="relative z-10">{children}</div>
      {/* subtle inner gradient */}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/5 to-transparent" />
    </div>
  );
}

export default SpotlightCard;
