interface RateBucket {
  count: number;
  expiresAt: number;
}

class InMemoryRateLimiter {
  private buckets = new Map<string, RateBucket>();

  check(key: string, opts: { windowMs: number; max: number }): boolean {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.expiresAt < now) {
      this.buckets.set(key, { count: 1, expiresAt: now + opts.windowMs });
      return true;
    }
    if (existing.count >= opts.max) return false;
    existing.count += 1;
    return true;
  }
}

let singleton: InMemoryRateLimiter | null = null;
export function getInMemoryRateLimiter(): InMemoryRateLimiter {
  singleton ??= new InMemoryRateLimiter();
  return singleton;
}
