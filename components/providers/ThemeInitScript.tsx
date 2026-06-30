"use client";

import { useServerInsertedHTML } from "next/navigation";
import { THEME_STORAGE_KEY } from "@/lib/theme/types";

const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

/** Injects theme init script during SSR, outside the React client tree (React 19-safe). */
export function ThemeInitScript() {
  useServerInsertedHTML(() => (
    <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
  ));
  return null;
}
