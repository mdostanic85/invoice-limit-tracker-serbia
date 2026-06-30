import { en } from "./messages/en";
import { sr } from "./messages/sr";
import type { Locale, MessageTree } from "./types";

const catalogs: Record<Locale, MessageTree> = { en, sr };

export function getMessages(locale: Locale): MessageTree {
  return catalogs[locale] ?? catalogs.en;
}

export { en, sr };
export * from "./helpers";
