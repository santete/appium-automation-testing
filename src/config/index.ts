/**
 * Env loader với Zod-validated schema.
 *
 * Plan ref: M3 Decision 4 (env matrix), Task 8.
 *
 * Single source of truth: spec file + wdio config dùng `loadEnv()` thay vì
 * đọc `process.env` trực tiếp. Schema validate fail-fast → missing/malformed
 * env raise lỗi tại boot, không lúc test runtime.
 *
 * D2 status: TEST_USERNAME/TEST_PASSWORD đánh dấu deprecated. Spec sẽ đọc
 * cred từ AccountPool qua global hook (tests/_hooks/global.ts). M3 giữ
 * optional cho transition window — slice 3 sẽ remove hoàn toàn.
 */
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { z } from 'zod';

const EnvSchema = z.object({
  // ── Profile selector ──────────────────────────────────────
  ENV_PROFILE: z.enum(['local', 'staging']).default('local'),

  // ── Local emulator config ────────────────────────────────
  ANDROID_DEVICE_NAME: z.string().min(1),
  ANDROID_PLATFORM_VERSION: z.string().min(1),
  APP_PATH: z.string().min(1),

  // ── Wait config ──────────────────────────────────────────
  DEFAULT_WAIT_TIMEOUT: z.coerce.number().int().positive().default(10_000),
  DEFAULT_WAIT_INTERVAL: z.coerce.number().int().positive().default(500),

  // ── Account pool ─────────────────────────────────────────
  ACCOUNT_POOL_CONFIG_PATH: z.string().default('./src/utils/accountPool/pool.config.json'),
  ACCOUNT_POOL_STATE_PATH: z.string().default('./tmp/account-pool.state.json'),

  // ── Network sim ──────────────────────────────────────────
  NETWORK_SIM_DEFAULT: z.enum(['full', 'lte', 'umts', 'edge', 'gprs', 'none']).default('full'),

  // ── Device farm STUB (M4 không wire — Q2 sign-off; M5+ activate) ─
  BS_USERNAME: z.string().optional(),
  BS_ACCESS_KEY: z.string().optional(),
  BS_APP_URL: z.string().optional(),
  SAUCE_USERNAME: z.string().optional(),
  SAUCE_ACCESS_KEY: z.string().optional(),
  SAUCE_APP_STORAGE_ID: z.string().optional(),

  // ── Integration tests ────────────────────────────────────
  ALLOW_NETWORK_INTEGRATION: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),

  // ── Deprecated (D2 transition) ───────────────────────────
  TEST_USERNAME: z.string().optional(),
  TEST_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

/**
 * Load + validate env. Idempotent — cached sau call đầu.
 *
 * @param dotenvPath - Đường dẫn `.env` file. Default `<repoRoot>/.env.local`.
 *   Truyền explicit để force reload (vd. unit test với env tạm).
 */
export function loadEnv(dotenvPath?: string): Env {
  if (cachedEnv && !dotenvPath) {
    return cachedEnv;
  }

  const targetPath = dotenvPath ?? path.resolve(process.cwd(), '.env.local');
  dotenv.config({ path: targetPath, override: true });

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Env validation failed (file: ${targetPath}):\n${issues}\n\n` +
        `Copy .env.example → .env.local và điền giá trị thiếu (xem docs/runbook.md).`,
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/** Reset cache — chỉ dùng trong test. */
export function _resetEnvCache(): void {
  cachedEnv = null;
}
