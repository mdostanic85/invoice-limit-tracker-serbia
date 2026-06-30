export type Locale = "en" | "sr";

export type AppLocaleDb = "EN" | "SR";

export function dbLocaleToLocale(db: AppLocaleDb): Locale {
  return db === "SR" ? "sr" : "en";
}

export function localeToDbLocale(locale: Locale): AppLocaleDb {
  return locale === "sr" ? "SR" : "EN";
}

export type MessageTree = {
  [key: string]: string | MessageTree;
};

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function createTranslator(messages: MessageTree): Translator {
  return (key, vars) => {
    const parts = key.split(".");
    let node: string | MessageTree = messages;
    for (const part of parts) {
      if (typeof node !== "object" || node[part] === undefined) return key;
      node = node[part];
    }
    if (typeof node !== "string") return key;
    if (!vars) return node;
    return Object.entries(vars).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      node
    );
  };
}
