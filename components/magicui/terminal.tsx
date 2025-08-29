"use client";

import { cn } from "@/lib/utils";
import { motion, useInView } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

interface TerminalProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  startOnView?: boolean;
}

const Terminal: React.FC<TerminalProps> = ({
  children,
  className,
  startOnView = true,
  ...props
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [render, setRender] = useState(startOnView ? isInView : false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  useEffect(() => {
    if (isInView && !render) {
      setRender(true);
    }
  }, [isInView, render]);

  const handleTypingComplete = () => {
    setCurrentLineIndex((prevIndex) => prevIndex + 1);
  };

  const childrenArray = React.Children.toArray(children);

  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full rounded-lg bg-black p-4 text-white",
        className,
      )}
      {...props}
    >
      <div className="absolute left-4 top-4 flex gap-2">
        <div className="h-3 w-3 rounded-full bg-red-500" />
        <div className="h-3 w-3 rounded-full bg-yellow-500" />
        <div className="h-3 w-3 rounded-full bg-green-500" />
      </div>
      <div className="mt-6 font-mono">
        {render &&
          childrenArray.map((child, i) => {
            if (React.isValidElement(child) && i <= currentLineIndex) {
              return React.cloneElement(child, {
                ...child.props,
                onTypingComplete: handleTypingComplete,
                startDelay: i === 0 ? 0 : undefined, // Only first child has no delay
              });
            }
            return null;
          })}
      </div>
    </div>
  );
};

interface TypingAnimationProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: React.ElementType;
  text: string;
  duration?: number;
  startDelay?: number; // New prop for delay before starting
  onTypingComplete?: () => void; // Callback for completion
  keepCursor?: boolean; // Keep blinking cursor after typing completes
  cursor?: string; // Custom cursor character
}

const TypingAnimation: React.FC<TypingAnimationProps> = ({
  as: Comp = "div",
  text,
  duration = 0.1,
  className,
  startDelay = 0,
  onTypingComplete,
  keepCursor = false,
  cursor = "_",
  ...props
}) => {
  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const hasCompletedRef = useRef(false); // New ref to track completion

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      if (text.length === 0) {
        // If text is empty, just complete after the delay
        if (onTypingComplete && !hasCompletedRef.current) {
          onTypingComplete();
          hasCompletedRef.current = true;
        }
      } else {
        setIsTyping(true);
      }
    }, startDelay);

    return () => clearTimeout(initialTimer);
  }, [startDelay, text.length, onTypingComplete]);

  useEffect(() => {
    if (!isTyping || hasCompletedRef.current) return; // Don't re-trigger if already completed

    if (duration < 0.01) { // If duration is very small, make it instant
      setTypedText(text);
      if (onTypingComplete && !hasCompletedRef.current) {
        onTypingComplete();
        hasCompletedRef.current = true;
      }
      setIsTyping(false); // Set to false after calling onTypingComplete
      return;
    }

    const typingInterval = setInterval(() => {
      if (typedText.length < text.length) {
        setTypedText(text.slice(0, typedText.length + 1));
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);
        if (onTypingComplete && !hasCompletedRef.current) {
          onTypingComplete();
          hasCompletedRef.current = true;
        }
      }
    }, duration * 1000);

    return () => clearInterval(typingInterval);
  }, [text, typedText, isTyping, duration, onTypingComplete]);

  return (
    <Comp className={cn("animate-in fade-in", className)} {...props}>
      {typedText}
      {(isTyping || (keepCursor && typedText.length === text.length)) && (
        <span className="animate-pulse" style={{ animationDuration: "1s" }}>
          {cursor}
        </span>
      )}
    </Comp>
  );
};

interface AnimatedSpanProps extends HTMLMotionProps<'span'> {
  children: React.ReactNode;
}

const AnimatedSpan: React.FC<AnimatedSpanProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <motion.span
      className={cn("animate-in fade-in", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      {...props}
    >
      {children}
    </motion.span>
  );
};

interface PauseProps {
  ms: number;
  onTypingComplete?: () => void;
}

const Pause: React.FC<PauseProps> = ({ ms, onTypingComplete }) => {
  useEffect(() => {
    const t = setTimeout(() => {
      onTypingComplete?.();
    }, ms);
    return () => clearTimeout(t);
  }, [ms, onTypingComplete]);
  return null;
};

const RagAgentBootTerminal: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => {
  return (
    <Terminal className={cn("max-w-3xl mx-auto shadow-lg/50 shadow-black/30", className)} {...props}>
      <TypingAnimation text="> Initializing RAG agent..." duration={0.02} />
      <TypingAnimation text="> Connecting to backend..." duration={0.03} />
      <TypingAnimation text="> Connecting to knowledge base..." duration={0.03} />
      <TypingAnimation text="> Agent ready." className="text-emerald-400" duration={0.02} />
      <Pause ms={250} />
      <TypingAnimation
        text="<Rag-Agent>: Ask me anything about your files!"
        className="text-cyan-300"
        duration={0.02}
        keepCursor
        cursor="|"
      />
    </Terminal>
  );
};

export { AnimatedSpan, Terminal, TypingAnimation, Pause, RagAgentBootTerminal };