"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  KeyRound,
  Database,
  Shield,
  BookOpen,
  Webhook,
  FlaskConical,
  Code2,
  Menu,
  X,
  ChevronDown,
  Receipt,
  AlertTriangle,
  CreditCard,
  Mail,
  Clock,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      { label: "Overview", href: "/", icon: <Home className="w-4 h-4" /> },
    ],
  },
  {
    title: "Guides",
    items: [
      {
        label: "Authentication",
        href: "/docs/authentication",
        icon: <KeyRound className="w-4 h-4" />,
      },
      {
        label: "Core Objects",
        href: "/docs/core-objects",
        icon: <Database className="w-4 h-4" />,
      },
      {
        label: "RBAC & Security",
        href: "/docs/rbac",
        icon: <Shield className="w-4 h-4" />,
      },
      {
        label: "Ledger System",
        href: "/docs/ledger-system",
        icon: <BookOpen className="w-4 h-4" />,
      },
      {
        label: "Webhooks",
        href: "/docs/webhooks",
        icon: <Webhook className="w-4 h-4" />,
      },
      {
        label: "Sandbox",
        href: "/docs/sandbox",
        icon: <FlaskConical className="w-4 h-4" />,
      },
      {
        label: "Expenses System",
        href: "/docs/expenses",
        icon: <Receipt className="w-4 h-4" />,
      },
      {
        label: "Eviction Tracking",
        href: "/docs/evictions",
        icon: <AlertTriangle className="w-4 h-4" />,
      },
      {
        label: "Payment Processing",
        href: "/docs/payment-processing",
        icon: <CreditCard className="w-4 h-4" />,
      },
      {
        label: "Email Notifications",
        href: "/docs/email-notifications",
        icon: <Mail className="w-4 h-4" />,
      },
      {
        label: "Cron Jobs",
        href: "/docs/cron-jobs",
        icon: <Clock className="w-4 h-4" />,
      },
    ],
  },
  {
    title: "Reference",
    items: [
      {
        label: "API Reference",
        href: "/api-reference",
        icon: <Code2 className="w-4 h-4" />,
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 pb-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo-white.svg"
            alt="DoorStax"
            width={140}
            height={28}
            priority
          />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded-full border border-accent-purple/20">
            Developers
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            <button
              onClick={() => toggleSection(section.title)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
            >
              {section.title}
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  collapsedSections.has(section.title) ? "-rotate-90" : ""
                }`}
              />
            </button>
            {!collapsedSections.has(section.title) && (
              <ul className="mt-1 space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                          active
                            ? "bg-accent-purple/10 text-accent-lavender border border-accent-purple/20"
                            : "text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent"
                        }`}
                      >
                        <span
                          className={
                            active ? "text-accent-purple" : "text-text-muted"
                          }
                        >
                          {item.icon}
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-text-muted">
          <span className="text-text-secondary font-medium">v2.0.0</span>
          <span className="mx-2">|</span>
          <span>DoorStax Platform</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-bg-card border border-border lg:hidden"
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 w-[280px] h-screen bg-bg-secondary border-r border-border transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
