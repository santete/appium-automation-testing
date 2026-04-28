/**
 * Assertion Contract Zod schema — single source of truth.
 *
 * Spec ref: §5.2 Assertion Contract structure.
 * Decision §4.D8 (M2 plan): structured discriminated union, no eval.
 *
 * Mỗi `type` trong các Zod discriminated union map 1-1 với 1 method
 * trong checker tương ứng (`UiChecker`, `ApiChecker`, ...). Thêm type
 * mới = thêm Zod variant + checker method (intentional friction).
 */
import { z } from 'zod';

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type Severity = z.infer<typeof SeveritySchema>;

const idSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_.]*$/, {
    message: 'id must be lowercase snake_case with optional dots (e.g. "ui.cart_visible")',
  });
const locatorSchema = z.string().min(1);
const baseSeverity = { id: idSchema, severity: SeveritySchema };

// ─────────────────────────────────────────────────────────────────────────────
// UI layer
// ─────────────────────────────────────────────────────────────────────────────
export const UiCheckSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseSeverity,
    type: z.literal('element_visible'),
    locator: locatorSchema,
  }),
  z.object({
    ...baseSeverity,
    type: z.literal('element_absent'),
    locator: locatorSchema,
  }),
  z.object({
    ...baseSeverity,
    type: z.literal('text_equals'),
    locator: locatorSchema,
    expected: z.string(),
  }),
  z.object({
    ...baseSeverity,
    type: z.literal('attribute_match'),
    locator: locatorSchema,
    attribute: z.string().min(1),
    regex: z.string().min(1),
  }),
]);
export type UiCheck = z.infer<typeof UiCheckSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// API layer
// ─────────────────────────────────────────────────────────────────────────────
const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const HttpExpectSchema = z
  .object({
    status: z.number().int().min(100).max(599).optional(),
    schema_ref: z.string().min(1).optional(),
    body_contains: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (e) => e.status !== undefined || e.schema_ref !== undefined || e.body_contains !== undefined,
    {
      message: 'http expect must have at least one of: status, schema_ref, body_contains',
    },
  );

export const ApiCheckSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseSeverity,
    type: z.literal('http_request'),
    method: HttpMethodSchema,
    url: z.string().min(1),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.unknown().optional(),
    expect: HttpExpectSchema,
  }),
]);
export type ApiCheck = z.infer<typeof ApiCheckSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// State layer
// ─────────────────────────────────────────────────────────────────────────────
const StateSourceSchema = z.enum(['shared_prefs', 'secure_storage', 'sqlite', 'debug_api']);

const StateExpectSchema = z.union([
  z.object({ equals: z.unknown() }),
  z.object({ not_null: z.literal(true) }),
  z.object({ regex: z.string().min(1) }),
]);

export const StateCheckSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...baseSeverity,
      type: z.literal('state_property'),
      source: StateSourceSchema,
      package: z.string().optional(),
      key: z.string().min(1),
      expect: StateExpectSchema,
    })
    .refine(
      (s) => !(['shared_prefs', 'secure_storage', 'sqlite'].includes(s.source) && !s.package),
      {
        message:
          "state_property: 'package' is required when source is shared_prefs/secure_storage/sqlite",
      },
    ),
]);
export type StateCheck = z.infer<typeof StateCheckSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Negative
// ─────────────────────────────────────────────────────────────────────────────
export const NegativeCheckSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseSeverity,
    type: z.literal('log_pattern_absent'),
    log_source: z.enum(['logcat', 'syslog']),
    pattern: z.string().min(1),
    securityImpact: z.boolean().optional(),
  }),
  z.object({
    ...baseSeverity,
    type: z.literal('process_alive'),
    package: z.string().min(1),
  }),
]);
export type NegativeCheck = z.infer<typeof NegativeCheckSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Performance
// ─────────────────────────────────────────────────────────────────────────────
export const PerfCheckSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseSeverity,
    type: z.literal('time_between'),
    start_marker: z.string().min(1),
    end_marker: z.string().min(1),
    max_ms: z.number().int().positive(),
  }),
]);
export type PerfCheck = z.infer<typeof PerfCheckSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Full contract
// ─────────────────────────────────────────────────────────────────────────────
export const PositiveBlockSchema = z
  .object({
    ui_layer: z.array(UiCheckSchema).optional(),
    api_layer: z.array(ApiCheckSchema).optional(),
    state_layer: z.array(StateCheckSchema).optional(),
  })
  .refine(
    (p) =>
      (p.ui_layer?.length ?? 0) + (p.api_layer?.length ?? 0) + (p.state_layer?.length ?? 0) > 0,
    {
      message:
        'positive block must have at least 1 assertion across ui_layer/api_layer/state_layer',
    },
  );

export const AssertionContractSchema = z.object({
  contract_id: z.string().regex(/^AC_[A-Z0-9_]+$/, {
    message: 'contract_id must match /^AC_[A-Z0-9_]+$/ (e.g. AC_LOGIN_001)',
  }),
  test_scenario: z.string().regex(/^TC_[A-Z0-9_]+$/, {
    message: 'test_scenario must match /^TC_[A-Z0-9_]+$/ (e.g. TC_LOGIN_001)',
  }),
  schema_version: z.literal('v1'),
  description: z.string().min(1),
  positive: PositiveBlockSchema,
  negative: z.array(NegativeCheckSchema).optional().default([]),
  performance: z.array(PerfCheckSchema).optional().default([]),
  // visual: deferred M5/M6
});
export type AssertionContract = z.infer<typeof AssertionContractSchema>;

/**
 * All concrete assertion shapes union — useful for runner dispatch.
 * Layer info NOT in contract object itself; runner injects when iterating.
 */
export type AnyCheck = UiCheck | ApiCheck | StateCheck | NegativeCheck | PerfCheck;
