"use client";

import { motion } from "framer-motion";

type ShinyTextProps = {
  text: string;
  baseColor?: string;
  shineColor?: string;
  duration?: number;
  className?: string;
};

export function ShinyText({
  text,
  baseColor = "#64CEFB",
  shineColor = "#ffffff",
  duration = 3,
  className = "",
}: ShinyTextProps) {
  return (
    <motion.span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: `linear-gradient(110deg, ${baseColor} 0%, ${baseColor} 40%, ${shineColor} 50%, ${baseColor} 60%, ${baseColor} 100%)`,
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
      animate={{
        backgroundPosition: ["200% 0%", "-200% 0%"],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      {text}
    </motion.span>
  );
}
