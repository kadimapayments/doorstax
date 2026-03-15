"use client";

import { useSidebar, SidebarProvider } from "./sidebar-context";

function ContentInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div
      className={`transition-all duration-200 ${
        collapsed ? "lg:pl-16" : "lg:pl-64"
      }`}
    >
      {children}
    </div>
  );
}

export function SidebarLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      {sidebar}
      <ContentInner>{children}</ContentInner>
    </SidebarProvider>
  );
}
