export function normalizeDelhiveryStatus(raw: string | undefined | null): string {
  if (!raw) return "UNKNOWN";

  const status = raw.toUpperCase();

  if (status.includes("DELIVERED")) return "DELIVERED";
  if (status.includes("RTO")) return "RTO - RETURNED";
  if (status.includes("OUT FOR DELIVERY")) return "OUT FOR DELIVERY";
  if (status.includes("IN TRANSIT")) return "IN TRANSIT";
  if (status.includes("PICKED")) return "PICKED";
  if (status.includes("MANIFEST")) return "AWB GENERATED";

  return status;
}
