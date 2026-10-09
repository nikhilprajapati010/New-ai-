import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

/**
 * Vanguard AI Security Service & Defense Perimeter
 * Protects against:
 * - Brute force attacks via Token Bucket rate limiters
 * - XSS & Prototype Pollution via input sanitizers
 * - Timing attacks via crypto.timingSafeEqual
 * - Password/Secret compromise via Scrypt salt hashing
 * - Information disclosure & framing via Security Headers & CSP
 * - Credential/API key leaks via output redactors
 */

export const ADMIN_SECRET_KEY = "456123";

// ---------------------------------------------------------------------------
// 1. Constant-Time String Comparison (Timing-Attack Defense)
// ---------------------------------------------------------------------------
export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a || "", "utf8");
    const bufB = Buffer.from(b || "", "utf8");

    // Equalize length buffer to prevent leaking length via timing
    if (bufA.length !== bufB.length) {
      // Execute dummy constant-time comparison to avoid short-circuit timing leak
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2. Cryptographic Password & Secret Hashing (Scrypt + Salt)
// ---------------------------------------------------------------------------
export interface HashedCredential {
  hash: string;
  salt: string;
  iterations?: number;
}

/**
 * Securely hashes a password or secret using scrypt and a cryptographic salt
 */
export function hashPassword(password: string): HashedCredential {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString("hex"),
    salt,
  };
}

/**
 * Verifies a password against a stored scrypt hash in constant time
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return timingSafeCompare(derivedKey.toString("hex"), storedHash);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 3. Input Sanitization & Anti-XSS Filter
// ---------------------------------------------------------------------------
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /onload\s*=/gi,
  /onerror\s*=/gi,
  /onclick\s*=/gi,
  /onmouseover\s*=/gi,
  /<iframe\b[^>]*>/gi,
  /<embed\b[^>]*>/gi,
  /<object\b[^>]*>/gi,
];

/**
 * Sanitizes a string, removing harmful script injection payloads and neutralizing HTML tags
 */
export function sanitizeString(val: string): string {
  if (typeof val !== "string") return "";

  let cleaned = val;

  // Remove control characters (except newline, tab, carriage return)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Neutralize dangerous scripting tags and event handlers
  for (const pattern of DANGEROUS_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim();
}

/**
 * Recursively sanitizes any incoming object, guarding against Prototype Pollution
 */
export function sanitizeObject<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "string") {
    return sanitizeString(input) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeObject(item)) as unknown as T;
  }

  if (typeof input === "object") {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      // Prevent prototype pollution
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return input;
}

/**
 * Express middleware that automatically sanitizes req.body, req.query, and req.params
 */
export function sanitizeInputsMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(req.params);
  }
  next();
}

// ---------------------------------------------------------------------------
// 4. Sliding Window / Token Bucket Rate Limiter
// ---------------------------------------------------------------------------
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  blockedUntil?: number;
}

export class RateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private readonly maxTokens: number;
  private readonly refillRatePerMs: number;
  private readonly blockDurationMs: number;

  constructor(maxTokens: number, windowMs: number, blockDurationMs: number = 60000) {
    this.maxTokens = maxTokens;
    this.refillRatePerMs = maxTokens / windowMs;
    this.blockDurationMs = blockDurationMs;

    // Periodic cleanup of idle buckets every 5 minutes to prevent memory leak
    setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets.entries()) {
        if (now - bucket.lastRefill > windowMs * 2 && (!bucket.blockedUntil || now > bucket.blockedUntil)) {
          this.buckets.delete(key);
        }
      }
    }, 300000).unref();
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    return req.socket?.remoteAddress || "127.0.0.1";
  }

  public check(req: Request, cost: number = 1): { allowed: boolean; remaining: number; retryAfterSec?: number } {
    const ip = this.getClientIp(req);
    const now = Date.now();

    let bucket = this.buckets.get(ip);
    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(ip, bucket);
    }

    // Check if client is currently in penalty block
    if (bucket.blockedUntil && now < bucket.blockedUntil) {
      const retryAfterSec = Math.ceil((bucket.blockedUntil - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillRatePerMs);
    bucket.lastRefill = now;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    } else {
      // Temporarily block on sustained exhaustion
      bucket.blockedUntil = now + this.blockDurationMs;
      const retryAfterSec = Math.ceil(this.blockDurationMs / 1000);
      return { allowed: false, remaining: 0, retryAfterSec };
    }
  }

  public createMiddleware(errorMessage: string = "Too many requests. Please slow down.") {
    return (req: Request, res: Response, next: NextFunction) => {
      const { allowed, remaining, retryAfterSec } = this.check(req);

      res.setHeader("X-RateLimit-Limit", this.maxTokens);
      res.setHeader("X-RateLimit-Remaining", remaining);

      if (!allowed) {
        if (retryAfterSec) {
          res.setHeader("Retry-After", retryAfterSec);
        }
        return res.status(429).json({
          error: "Rate limit exceeded",
          message: errorMessage,
          retryAfterSeconds: retryAfterSec || 60,
        });
      }

      next();
    };
  }
}

// 5 attempts per minute on sensitive authentication endpoints
export const authRateLimiter = new RateLimiter(5, 60000, 120000);

// 30 chat messages per minute
export const chatRateLimiter = new RateLimiter(30, 60000, 60000);

// 120 API requests per minute for standard endpoints
export const generalApiRateLimiter = new RateLimiter(120, 60000, 30000);

// ---------------------------------------------------------------------------
// 5. Security Headers & Defense Middleware
// ---------------------------------------------------------------------------
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent XSS filters in legacy browsers from introducing new vulnerabilities
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Strict Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict unnecessary browser features
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Enable safe popup interactions for Google OAuth while isolating windows
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

  // Content Security Policy:
  // - Protects against XSS
  // - Supports AI Studio preview iframe via frame-ancestors *
  // - Allows Google Firebase Auth popups and fonts
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' ws: wss: https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.run.app",
    "img-src 'self' data: https: blob:",
    "frame-src 'self' https://*.firebaseapp.com https://*.google.com https://accounts.google.com",
    "frame-ancestors *",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  res.setHeader("Content-Security-Policy", cspDirectives);

  next();
}

// ---------------------------------------------------------------------------
// 6. Secret Redactor (Masking Keys in Responses and FS outputs)
// ---------------------------------------------------------------------------
const SECRET_REGEX = /(?:AIza[0-9A-Za-z-_]{35})|(?:sk-[a-zA-Z0-9]{20,})|(?:Bearer\s+[0-9a-zA-Z._-]+)/g;

export function redactSecrets(text: string): string {
  if (typeof text !== "string") return text;
  return text.replace(SECRET_REGEX, "[REDACTED_SECRET]");
}

// ---------------------------------------------------------------------------
// 7. Safe CORS Configuration
// ---------------------------------------------------------------------------
export function getCorsOptions() {
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
      if (!origin) return callback(null, true);

      // Allow localhost and local dev ports
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Allow official Google Cloud Run domains and preview domains
      if (
        origin.endsWith(".run.app") ||
        origin.endsWith(".google.com") ||
        origin.endsWith(".firebaseapp.com")
      ) {
        return callback(null, true);
      }

      // Reject unknown external origins
      callback(new Error("CORS policy violation: Access from origin is not permitted."));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key", "x-requested-with"],
    credentials: true,
    maxAge: 86400, // Cache preflight for 24 hours
  };
}
