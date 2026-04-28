/**
 * Unit test cho NetworkSim — DI adapter receive đúng command + args.
 *
 * Plan ref: M3 Task 12.
 */
import { expect } from 'chai';
import { NetworkSim, type NetworkSimDeps } from '../../src/utils/networkSim';

describe('NetworkSim', () => {
  it('setSpeed forwards command + args to deps', async () => {
    const calls: { command: string; args: Record<string, unknown> }[] = [];
    const deps: NetworkSimDeps = {
      async executeMobileCommand(command, args) {
        calls.push({ command, args });
        return undefined;
      },
    };

    const sim = new NetworkSim(deps);
    await sim.setSpeed('edge');

    expect(calls).to.have.lengthOf(1);
    expect(calls[0].command).to.equal('mobile: networkSpeed');
    expect(calls[0].args).to.deep.equal({ speed: 'edge' });
  });

  it('setSpeed propagates deps error', async () => {
    const deps: NetworkSimDeps = {
      async executeMobileCommand() {
        throw new Error('emulator not Android');
      },
    };
    const sim = new NetworkSim(deps);

    let err: Error | undefined;
    try {
      await sim.setSpeed('lte');
    } catch (e) {
      err = e as Error;
    }
    expect(err?.message).to.match(/emulator not Android/);
  });
});
