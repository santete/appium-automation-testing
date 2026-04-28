/**
 * Sleep helper cho retry/poll scenarios (KHÔNG cho test pause).
 *
 * ESLint blanket-cấm `setTimeout` để enforce no-pause trong tests (spec §3.4c).
 * Helper này centralize ngoại lệ: chỉ dùng cho lock retry, network sim throttle,
 * polling — KHÔNG cho test orchestration. Test code phải dùng `waitUntil`
 * trong `src/utils/wait.ts`.
 *
 * Plan ref: M3 — used bởi AccountPool retry-with-poll (Acceptance §2.4).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    // eslint-disable-next-line no-restricted-syntax
    setTimeout(resolve, ms);
  });
}
