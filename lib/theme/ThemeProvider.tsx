"use client";

/* eslint-disable react-hooks/set-state-in-effect -- Theme preference is read from browser storage only after mounting. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ConfigProvider, App } from "antd";
import { getThemeConfig } from "./tokens";
import {
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "./types";

function resolveIsDark(preference: ThemePreference): boolean {
  return preference === "dark";
}

function resolveInitialPreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved: ThemePreference = prefersDark ? "dark" : "light";
  if (stored === "system") {
    localStorage.setItem(THEME_STORAGE_KEY, resolved);
  }
  return resolved;
}

function applyDocumentTheme(isDark: boolean) {
  const root = document.documentElement;
  root.setAttribute("data-theme", isDark ? "dark" : "light");
  root.style.colorScheme = isDark ? "dark" : "light";
}

interface ThemeContextValue {
  preference: ThemePreference;
  isDark: boolean;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const initial = resolveInitialPreference();
    const dark = resolveIsDark(initial);
    setPreferenceState(initial);
    setIsDark(dark);
    applyDocumentTheme(dark);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    const dark = resolveIsDark(next);
    setIsDark(dark);
    applyDocumentTheme(dark);
  }, []);

  const themeConfig = useMemo(() => getThemeConfig(isDark), [isDark]);

  const contextValue = useMemo(
    () => ({ preference, isDark, setPreference }),
    [preference, isDark, setPreference]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <ConfigProvider
        componentSize="large"
        theme={{
          ...themeConfig,
          cssVar: { key: "invoice-tracker" },
          hashed: false,
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useThemePreference() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemePreference must be used within ThemeProvider");
  }
  return ctx;
}
