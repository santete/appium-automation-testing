/**
 * Abstract Factory base.
 *
 * Plan ref: M3 Decision 1-3, deliverable §3.
 *
 * Rationale: M3 chỉ có UserFactory (lease/release từ pool, không real
 * create/delete API — Decision 3). Base class set up shape cho M4+ factories
 * khi có real backend (CartFactory, OrderFactory, …).
 */
export interface FactorySetupContext {
  /** Identifier để log + debug. Vd: "TC_LOGIN_001 #worker-0". */
  testId: string;
}

export interface FactoryArtifact {
  cleanup(): Promise<void>;
}

export abstract class Factory<TArtifact extends FactoryArtifact, TOptions = void> {
  abstract setup(ctx: FactorySetupContext, options: TOptions): Promise<TArtifact>;
}
