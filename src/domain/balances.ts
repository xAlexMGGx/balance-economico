import { signedAmount } from './transactions';
import type { Account, Cents, ISODate, Transaction } from './types';

/**
 * Balance of every account: initial balance + income − expenses.
 * With `asOf`, movements dated after that day are left out (for example, a payroll already
 * generated for the 25th does not count until the 25th).
 */
export function computeAccountBalances(
  accounts: readonly Account[],
  txs: readonly Transaction[],
  asOf?: ISODate,
): Map<string, Cents> {
  const balances = new Map<string, Cents>(accounts.map((a) => [a.id, a.initialBalance]));
  for (const tx of txs) {
    if (asOf !== undefined && tx.date > asOf) continue;
    const current = balances.get(tx.accountId);
    if (current !== undefined) balances.set(tx.accountId, current + signedAmount(tx));
  }
  return balances;
}
