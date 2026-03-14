type RateLimitBucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()

export function checkFixedWindowRateLimit(input: {
  scope: string
  key: string
  limit: number
  windowMs: number
}) {
  const now = Date.now()
  const scopeKey = `${input.scope}:${input.key || "anonymous"}`
  const current = buckets.get(scopeKey)

  if (!current || now > current.resetAt) {
    const next: RateLimitBucket = {
      count: 1,
      resetAt: now + input.windowMs,
    }
    buckets.set(scopeKey, next)
    return {
      allowed: true,
      remaining: Math.max(0, input.limit - next.count),
      resetAt: next.resetAt,
    }
  }

  if (current.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    }
  }

  current.count += 1
  return {
    allowed: true,
    remaining: Math.max(0, input.limit - current.count),
    resetAt: current.resetAt,
  }
}
