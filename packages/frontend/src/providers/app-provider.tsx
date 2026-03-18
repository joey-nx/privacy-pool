"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { LatentProvider } from "./latent-provider";

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  return (
    <ThemeProvider>
      <LatentProvider>{children}</LatentProvider>
    </ThemeProvider>
  );
}
