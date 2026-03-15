"use client";

import { createContext, useContext, type ReactNode } from "react";

interface WhiteLabelContextValue {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  isWhiteLabel: boolean;
}

const defaultValue: WhiteLabelContextValue = {
  name: "DoorStax",
  logoUrl: null,
  primaryColor: "#5B00FF",
  accentColor: "#BDA2FF",
  isWhiteLabel: false,
};

const WhiteLabelContext = createContext<WhiteLabelContextValue>(defaultValue);

export function WhiteLabelProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: Partial<WhiteLabelContextValue>;
}) {
  const merged: WhiteLabelContextValue = {
    ...defaultValue,
    ...value,
  };

  return (
    <WhiteLabelContext.Provider value={merged}>
      {children}
    </WhiteLabelContext.Provider>
  );
}

export function useWhiteLabel(): WhiteLabelContextValue {
  return useContext(WhiteLabelContext);
}
