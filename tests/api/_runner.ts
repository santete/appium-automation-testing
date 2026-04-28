/**
 * Shared API spec runner — execute Assertion Contract qua AssertionRunner với
 * chỉ ApiChecker injected (no Appium, no UI/State checkers).
 *
 * Plan ref: M3 Task 16, D3 repay path B.
 *
 * Dùng cho `tests/api/*.spec.ts` — verify framework's API layer hoạt động
 * end-to-end với real public HTTP endpoint. Tách khỏi `tests/integration/`
 * vì integration suite dùng MSW (offline), API suite hit real network.
 */
import { z } from 'zod';
import { AssertionRunner } from '../../src/utils/assertion/AssertionRunner';
import { ApiChecker } from '../../src/utils/assertion/checkers/ApiChecker';
import { createApiClient } from '../../src/utils/apiClient';
import { createAxiosApiCheckerDeps } from '../../src/utils/assertion/checkers/axiosApiCheckerDeps';
import type { VerdictResult } from '../../src/utils/assertion/types';

/**
 * Schema registry cho tests/api specs. Mỗi `schema_ref` dùng trong contract YAML
 * dưới `tests/api/` phải register ở đây (no eval, boot-time mapping).
 */
const HttpbinSlideshowSchema = z.object({
  slideshow: z.object({
    author: z.string(),
    date: z.string(),
    title: z.string(),
    slides: z.array(
      z.object({
        title: z.string(),
        type: z.string(),
        items: z.array(z.string()).optional(),
      }),
    ),
  }),
});

export const apiSchemaRegistry = {
  HttpbinSlideshow: HttpbinSlideshowSchema,
};

export async function runApiContract(contractId: string): Promise<VerdictResult> {
  const apiChecker = new ApiChecker(
    createAxiosApiCheckerDeps(createApiClient(), apiSchemaRegistry),
  );
  const runner = new AssertionRunner({ api: apiChecker });
  return runner.runContractById(contractId);
}
