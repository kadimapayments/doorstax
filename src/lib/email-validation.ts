const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "yopmail.com", "sharklasers.com", "guerrillamail.info", "grr.la",
  "guerrillamail.biz", "guerrillamail.de", "guerrillamail.net",
  "guerrillamail.org", "spam4.me", "trashmail.com", "trashmail.me",
  "trashmail.net", "mailnesia.com", "maildrop.cc", "dispostable.com",
  "tempail.com", "fakeinbox.com", "mailcatch.com", "mintemail.com",
  "temp-mail.org", "10minutemail.com", "mohmal.com", "getnada.com",
  "emailondeck.com", "crazymailing.com", "tempinbox.com",
  "mailnator.com", "binkmail.com", "harakirimail.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
