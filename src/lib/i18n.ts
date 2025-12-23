export const locales = ["uk"] as const;
export const defaultLocale = "uk";

export type Locale = (typeof locales)[number];
