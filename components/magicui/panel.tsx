"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: boolean;
  animated?: boolean; // subtle moving sweep background
  duration?: number; // seconds
};

/**
 * Minimal dark panel to match the screenshot style:
 * - rounded corners
 * - subtle border
 * - soft inner highlight (inset 1px)
 */
export function Panel({ className, children, padding = true, animated = false, duration = 12, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border",
        "bg-black/50 border-white/10",
        // inner subtle highlight and gentle elevation without glow
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
        padding && "p-6 md:p-8",
        className,
      )}
      {...props}
    >
      {animated && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-1 opacity-60"
          initial={{ x: -120, y: -80, rotate: -10 }}
          animate={{ x: 120, y: 80, rotate: 10 }}
          transition={{ duration, repeat: Infinity, repeatType: "mirror", ease: "linear" }}
          style={{
            background:
              "radial-gradient(600px 600px at 10% 10%, rgba(255,255,255,0.06), transparent 60%)",
            maskImage:
              "radial-gradient(500px 500px at 50% 50%, rgba(0,0,0,0.8), transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(500px 500px at 50% 50%, rgba(0,0,0,0.8), transparent 70%)",
          }}
        />
      )}
      {children}
    </div>
  );
}

export default Panel;
