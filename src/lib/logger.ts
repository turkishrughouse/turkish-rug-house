type LogLevel = "debug" | "info" | "warn" | "error"

type LogPayload = {
  level: LogLevel
  message: string
  scope?: string
  at: string
  [key: string]: unknown
}

function write(level: LogLevel, message: string, scope: string | undefined, meta?: Record<string, unknown>) {
  const payload: LogPayload = {
    level,
    message,
    scope,
    at: new Date().toISOString(),
    ...(meta || {}),
  }
  const line = JSON.stringify(payload)
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>, scope?: string) {
    write("debug", message, scope, meta)
  },
  info(message: string, meta?: Record<string, unknown>, scope?: string) {
    write("info", message, scope, meta)
  },
  warn(message: string, meta?: Record<string, unknown>, scope?: string) {
    write("warn", message, scope, meta)
  },
  error(message: string, meta?: Record<string, unknown>, scope?: string) {
    write("error", message, scope, meta)
  },
}

