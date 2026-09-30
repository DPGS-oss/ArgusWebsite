"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ElementType } from "react";

type Props = { text: string; as?: ElementType; className?: string };

/** Heading whose words rise into place, one after another, when scrolled into view. */
export function AnimatedHeading({ text, as: Tag = "h2", className = "" }: Props) {
  const reduce = useReducedMotion();
  if (reduce) return <Tag className={className}>{text}</Tag>;
  const words = text.split(" ");
  return (
    <Tag className={className} aria-label={text}>
      <motion.span
        aria-hidden
        className="inline"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "0px 0px -60px 0px" }}
        transition={{ staggerChildren: 0.06 }}
      >
        {words.map((word, i) => (
          <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span
              className="inline-block"
              variants={{ hidden: { y: "105%" }, show: { y: "0%" } }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}
