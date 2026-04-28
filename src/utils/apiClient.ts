/**
 * apiClient — thin factory wrapping Axios cho ApiChecker + future UserFactory (M3).
 *
 * Spec ref: §10 (Axios + Zod), Decision §4.D5 — ApiChecker call HTTP từ Node,
 * không intercept app traffic. MSW (Decision §4.D9) sẽ intercept axios trong
 * integration test.
 *
 * Quan trọng: `validateStatus: () => true` để KHÔNG throw trên non-2xx — checker
 * cần inspect status code chính xác từ contract `expect.status`.
 */
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

export interface ApiClientOptions {
  baseURL?: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
}

export function createApiClient(opts: ApiClientOptions = {}): AxiosInstance {
  return axios.create({
    baseURL: opts.baseURL,
    timeout: opts.timeoutMs ?? 10_000,
    headers: opts.defaultHeaders,
    validateStatus: () => true,
  });
}

export type { AxiosInstance, AxiosRequestConfig };
