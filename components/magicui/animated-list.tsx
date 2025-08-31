"use client";

import React, { ReactElement, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface AnimatedListProps {
  className?: string;
  children: React.ReactNode;
  delay?: number;
}

export const AnimatedList = ({
  className,
  children,
  delay = 1000,
}: AnimatedListProps) => {
  const [index, setIndex] = useState(0);
  const childrenArray = React.Children.toArray(children);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % childrenArray.length);
    }, delay);

    return () => clearInterval(interval);
  }, [childrenArray.length, delay]);

  const itemsToShow = childrenArray.slice(0, index + 1).reverse();

  return (
    <div className={className}>
      <AnimatePresence>
        {itemsToShow.map((item, idx) => (
          <AnimatedListItem key={idx}>
            {item}
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  );
};

export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const animations = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1, transition: { type: "spring" } },
    exit: { scale: 0, opacity: 0, transition: { type: "spring" } },
    transition: { type: "spring", stiffness: 350, damping: 40 },
  };

  return (
    <motion.div {...animations} layout className="mx-auto w-full">
      {children}
    </motion.div>
  );
}