import type { ReactNode } from "react";
import Link from "next/link";

const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const UL_RE = /^[-*]\s+(.+)$/;
const OL_RE = /^\d+\.\s+(.+)$/;
const HR_RE = /^---+$/;
const INLINE_RE = /(\*\*[^*]+?\*\*|\[[^\]]+\]\([^)]+\))/g;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function Inline({ text }: { text: string }): ReactNode {
  const parts = text.split(INLINE_RE);
  return parts.map((part, index) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) {
      return (
        <strong key={index} className="font-semibold text-ink">
          {bold[1]}
        </strong>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const label = link[1];
      const href = link[2];
      const className = "text-brand-violet underline underline-offset-2 hover:text-ink";
      if (href.startsWith("/") && !href.startsWith("//")) {
        return (
          <Link key={index} href={href} className={className}>
            {label}
          </Link>
        );
      }
      const external = href.startsWith("http://") || href.startsWith("https://");
      return (
        <a
          key={index}
          href={href}
          className={className}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {label}
        </a>
      );
    }
    return part ? <span key={index}>{part}</span> : null;
  });
}

function peekNonEmpty(lines: string[], from: number): { index: number; line: string } {
  let index = from;
  while (index < lines.length && !lines[index].trim()) index += 1;
  return { index, line: index < lines.length ? lines[index].trim() : "" };
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      if (level === 1) {
        nodes.push(
          <h1 key={key} id={id} className="text-4xl font-bold tracking-tight text-ink">
            <Inline text={text} />
          </h1>,
        );
      } else if (level === 2) {
        nodes.push(
          <h2 key={key} id={id} className="mt-10 scroll-mt-24 text-2xl font-bold text-ink">
            <Inline text={text} />
          </h2>,
        );
      } else {
        nodes.push(
          <h3 key={key} id={id} className="mt-8 scroll-mt-24 text-xl font-bold text-ink">
            <Inline text={text} />
          </h3>,
        );
      }
      key += 1;
      i += 1;
      continue;
    }

    if (HR_RE.test(line)) {
      nodes.push(<hr key={key} className="my-8 border-bone" />);
      key += 1;
      i += 1;
      continue;
    }

    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (!trimmed) {
          const next = peekNonEmpty(lines, i + 1);
          if (next.line && UL_RE.test(next.line)) {
            i = next.index;
            continue;
          }
          break;
        }
        const item = UL_RE.exec(trimmed);
        if (!item) break;
        items.push(item[1]);
        i += 1;
      }
      nodes.push(
        <ul key={key} className="list-disc space-y-2 pl-6 text-slate">
          {items.map((item, idx) => (
            <li key={idx}>
              <Inline text={item} />
            </li>
          ))}
        </ul>,
      );
      key += 1;
      continue;
    }

    if (OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (!trimmed) {
          const next = peekNonEmpty(lines, i + 1);
          if (next.line && OL_RE.test(next.line)) {
            i = next.index;
            continue;
          }
          break;
        }
        const item = OL_RE.exec(trimmed);
        if (!item) break;
        items.push(item[1]);
        i += 1;
      }
      nodes.push(
        <ol key={key} className="list-decimal space-y-2 pl-6 text-slate">
          {items.map((item, idx) => (
            <li key={idx}>
              <Inline text={item} />
            </li>
          ))}
        </ol>,
      );
      key += 1;
      continue;
    }

    nodes.push(
      <p key={key} className="leading-relaxed text-slate">
        <Inline text={line} />
      </p>,
    );
    key += 1;
    i += 1;
  }

  return <>{nodes}</>;
}
