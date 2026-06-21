// Pure, client-safe money formatting/parsing — no DB imports, so it can be used
// from client components without dragging server-only code into the bundle.

const LOCALE = process.env.NEXT_PUBLIC_LATTICE_LOCALE || process.env.LATTICE_LOCALE || "en-IN";
const CURRENCY = process.env.NEXT_PUBLIC_LATTICE_CURRENCY || process.env.LATTICE_CURRENCY || "INR";

export function formatMoney(n: number): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)}`;
  }
}

export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
