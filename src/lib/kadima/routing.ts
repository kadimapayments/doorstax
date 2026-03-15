/**
 * Returns the appropriate terminal ID based on ACH transaction amount.
 * Amounts under $200 route to one terminal, $200+ to another.
 */
export function getAchTerminalId(amount: number): string {
  if (amount < 200) {
    return process.env.KADIMA_ACH_TERMINAL_LOW || process.env.KADIMA_TERMINAL_ID || "";
  }
  return process.env.KADIMA_ACH_TERMINAL_HIGH || process.env.KADIMA_TERMINAL_ID || "";
}
