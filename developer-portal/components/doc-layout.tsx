"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface DocLayoutProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  children: React.ReactNode;
}

export default function DocLayout({
  title,
  description,
  breadcrumbs,
  children,
}: DocLayoutProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const article = document.getElementById("doc-content");
    if (!article) return;

    const headings = article.querySelectorAll("h2, h3");
    const items: TocItem[] = [];
    headings.forEach((heading) => {
      const el = heading as HTMLElement;
      if (!el.id) {
        el.id = el.textContent
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "";
      }
      items.push({
        id: el.id,
        text: el.textContent || "",
        level: el.tagName === "H2" ? 2 : 3,
      });
    });
    setTocItems(items);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -80% 0px" }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex gap-10">
      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-3xl">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-sm text-text-muted mb-6">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5" />}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-text-primary transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-text-secondary">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-3">
            {title}
          </h1>
          {description && (
            <p className="text-lg text-text-secondary leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Content */}
        <article id="doc-content" className="prose-doorstax">
          {children}
        </article>
      </div>

      {/* Table of Contents */}
      {tocItems.length > 0 && (
        <aside className="hidden xl:block w-56 shrink-0">
          <div className="sticky top-8">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              On this page
            </h4>
            <ul className="space-y-1.5">
              {tocItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={`block text-sm transition-colors ${
                      item.level === 3 ? "pl-3" : ""
                    } ${
                      activeId === item.id
                        ? "text-accent-lavender"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
