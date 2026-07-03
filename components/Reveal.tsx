"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Stagger index — multiplies the base delay so sequenced items ease in. */
  index?: number;
  className?: string;
  /** HTML tag to render (defaults to a div). */
  as?: "div" | "section" | "li" | "article";
}

/**
 * Scroll-in reveal for the landing story (design-system/MASTER.md §4: ease-out
 * enter ≤400ms, transform/opacity only, stagger 30–50ms). Animates once as the
 * section enters view; under prefers-reduced-motion it renders statically so the
 * content is instantly readable.
 */
export function Reveal({ children, index = 0, className, as = "div" }: RevealProps) {
  const reduce = useReducedMotion();
  const Tag = motion[as];

  if (reduce) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: "easeOut", delay: index * 0.05 }}
    >
      {children}
    </Tag>
  );
}
