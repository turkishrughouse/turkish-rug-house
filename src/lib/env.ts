import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  STORAGE_PROVIDER: z.enum(["local"]).default("local"),
  UPLOAD_PUBLIC_BASE_URL: z.string().url().optional(),
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(15),
  UPLOAD_MIN_WIDTH: z.coerce.number().int().positive().default(600),
  UPLOAD_MIN_HEIGHT: z.coerce.number().int().positive().default(600),
  UPLOAD_ENABLE_AVIF: z
    .string()
    .optional()
    .transform((value) => value === "true"),
})

let cachedEnv: z.infer<typeof envSchema> | null = null

export function getEnv() {
  if (cachedEnv) return cachedEnv
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
    throw new Error(`Environment validation failed: ${details}`)
  }
  const env = parsed.data
  if (!env.AUTH_SECRET && !env.NEXTAUTH_SECRET) {
    throw new Error("Environment validation failed: AUTH_SECRET (or NEXTAUTH_SECRET) is required")
  }
  cachedEnv = env
  return env
}

