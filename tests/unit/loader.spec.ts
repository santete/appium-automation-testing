/**
 * Unit tests cho contract loader — Zod fail-fast paths.
 *
 * Plan ref: M2 Task 10.
 */
import { expect } from 'chai';
import { ContractValidationError, validateContract } from '../../src/utils/assertion/loader';

describe('Contract loader (validateContract)', () => {
  it('rejects missing schema_version', () => {
    const fn = () =>
      validateContract({
        contract_id: 'AC_X_001',
        test_scenario: 'TC_X_001',
        description: 'no schema_version',
        positive: {
          ui_layer: [{ id: 'ui.a', type: 'element_visible', severity: 'high', locator: '~a' }],
        },
      });
    expect(fn).to.throw(ContractValidationError);
  });

  it('rejects bad contract_id pattern', () => {
    const fn = () =>
      validateContract({
        contract_id: 'login_001',
        test_scenario: 'TC_X_001',
        schema_version: 'v1',
        description: 'bad id',
        positive: {
          ui_layer: [{ id: 'ui.a', type: 'element_visible', severity: 'high', locator: '~a' }],
        },
      });
    expect(fn).to.throw(/contract_id/);
  });

  it('rejects empty positive block', () => {
    const fn = () =>
      validateContract({
        contract_id: 'AC_X_001',
        test_scenario: 'TC_X_001',
        schema_version: 'v1',
        description: 'empty positive',
        positive: {},
      });
    expect(fn).to.throw(/at least 1 assertion/);
  });

  it('rejects state_property without package for shared_prefs', () => {
    const fn = () =>
      validateContract({
        contract_id: 'AC_X_001',
        test_scenario: 'TC_X_001',
        schema_version: 'v1',
        description: 'missing pkg',
        positive: {
          state_layer: [
            {
              id: 'state.x',
              type: 'state_property',
              severity: 'high',
              source: 'shared_prefs',
              key: 'k',
              expect: { not_null: true },
            },
          ],
        },
      });
    expect(fn).to.throw(/package/);
  });

  it('accepts minimal valid contract', () => {
    const c = validateContract({
      contract_id: 'AC_OK_001',
      test_scenario: 'TC_OK_001',
      schema_version: 'v1',
      description: 'minimal',
      positive: {
        ui_layer: [{ id: 'ui.a', type: 'element_visible', severity: 'high', locator: '~a' }],
      },
    });
    expect(c.contract_id).to.equal('AC_OK_001');
    expect(c.negative).to.deep.equal([]);
  });
});
