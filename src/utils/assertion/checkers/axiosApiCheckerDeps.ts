/**
 * Runtime adapter — bind Axios instance vào `ApiCheckerDeps.request`.
 *
 * Tách khỏi `ApiChecker.ts` để unit test KHÔNG cần Axios; tests inject mock
 * `ApiCheckerDeps` trực tiếp.
 */
import type { AxiosInstance } from '../../apiClient';
import type { ApiCheckerDeps, HttpRequestArgs, HttpResponse } from './ApiChecker';
import type { ZodTypeAny } from 'zod';

export function createAxiosApiCheckerDeps(
  client: AxiosInstance,
  schemaRegistry: Record<string, ZodTypeAny> = {},
): ApiCheckerDeps {
  return {
    schemaRegistry,
    async request(args: HttpRequestArgs): Promise<HttpResponse> {
      const res = await client.request({
        method: args.method,
        url: args.url,
        headers: args.headers,
        data: args.body,
      });
      return {
        status: res.status,
        data: res.data,
        headers: res.headers as Record<string, unknown> | undefined,
      };
    },
  };
}
