export const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const y = new Date().getFullYear() - 2 + i;
  return { value: String(y), label: String(y) };
});

export const YEAR_AWARE_ROUTES = [
  "/invoices",
  "/dashboard",
  "/forecast",
  "/annual-plan",
  "/reports",
] as const;
