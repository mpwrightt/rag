"use client";

import { cn } from "@/lib/utils";

interface ShineBorderProps {
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
  color?: string | string[];
  className?: string;
  children: React.ReactNode;
}

export default function ShineBorder({
  borderRadius = 8,
  borderWidth = 1,
  duration = 14,
  color = "#A07CFE",
  className,
  children,
}: ShineBorderProps) {
  const colorArray = Array.isArray(color) ? color : [color];
  const gradientColors = colorArray.join(", ");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-black",
        className,
      )}
      style={{
        borderRadius: `${borderRadius}px`,
      }}
    >
      {/* Rotating gradient border */}
      <div
        className="absolute inset-0"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${gradientColors}, transparent 50%, ${gradientColors}, transparent 100%)`,
          animation: `spin ${duration}s linear infinite`,
          borderRadius: `${borderRadius}px`,
        }}
      />
      
      {/* Inner content area */}
      <div
        className={cn("relative h-full w-full bg-black")}
        style={{
          margin: `${borderWidth}px`,
          borderRadius: `${borderRadius - borderWidth}px`,
        }}
      >
        <div className="relative z-10 h-full w-full">{children}</div>
      </div>
    </div>
  );
}