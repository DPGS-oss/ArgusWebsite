import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string | null;
  size?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  href = "/",
  size = 28,
  showWordmark = false,
  wordmarkClassName = "text-base font-bold text-ink",
  className = "",
  priority = false,
}: BrandLogoProps) {
  const mark = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="inline-flex shrink-0 overflow-hidden"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo.png"
          alt={showWordmark ? "" : "Argus GST Billing"}
          width={size}
          height={size}
          priority={priority}
          className="h-full w-full object-contain"
        />
      </span>
      {showWordmark ? <span className={wordmarkClassName}>Argus</span> : null}
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="Argus home">
      {mark}
    </Link>
  );
}
