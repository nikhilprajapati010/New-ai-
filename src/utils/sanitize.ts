/**
 * Client-Side Input Sanitizer and Anti-XSS Defense Utility
 */

export function sanitizeClientInput(input: string, maxLength: number = 2000): string {
  if (typeof input !== "string") return "";

  // Strip non-printable ASCII control characters
  let clean = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Remove script tags, javascript: protocols, and inline event handlers
  clean = clean
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/onload\s*=/gi, "")
    .replace(/onerror\s*=/gi, "")
    .replace(/onclick\s*=/gi, "");

  // Enforce maximum length
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }

  return clean.trim();
}

export function isValidEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}
