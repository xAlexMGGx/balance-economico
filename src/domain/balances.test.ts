import { describe, expect, it } from 'vitest';
import { makeAccount, makeTransaction as tx } from '../test/factories';
import { computeAccountBalances } from './balances';

describe('computeAccountBalances', () => {
  const bank = makeAccount({ id: 'bank', initialBalance: 100000 });
  const edenred = makeAccount({ id: 'edenred', initialBalance: -500 });

  it('adds income and subtracts expenses from the initial balance', () => {
    const balances = computeAccountBalances(
      [bank, edenred],
      [
        tx({ accountId: 'bank', type: 'income', amount: 200000 }),
        tx({ accountId: 'bank', amount: 5000 }),
        tx({ accountId: 'edenred', type: 'income', amount: 16000 }),
        tx({ accountId: 'edenred', amount: 1200 }),
      ],
    );
    expect(balances.get('bank')).toBe(295000);
    expect(balances.get('edenred')).toBe(14300);
  });

  it('ignores movements dated after asOf', () => {
    const balances = computeAccountBalances(
      [bank],
      [tx({ accountId: 'bank', amount: 1000, date: '2026-10-11' }), tx({ accountId: 'bank', amount: 5000, date: '2026-10-25' })],
      '2026-10-11',
    );
    expect(balances.get('bank')).toBe(99000);
  });

  it('ignores movements of unknown accounts and keeps accounts without movements', () => {
    const balances = computeAccountBalances([bank, edenred], [tx({ accountId: 'gone', amount: 1000 })]);
    expect(Object.fromEntries(balances)).toEqual({ bank: 100000, edenred: -500 });
  });
});
