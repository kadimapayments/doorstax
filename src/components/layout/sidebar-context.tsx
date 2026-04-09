"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

interface SidebarContextType {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextType>({ collapsed: true, toggle: () => {} });

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Always start collapsed — no localStorage persistence.
  // Users can expand during their session; it resets on page reload.
  const [collapsed, setCollapsed] = useState(true);

  const toggle = () => {
    setCollapsed((prev) => !prev);
  };

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
