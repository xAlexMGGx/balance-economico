import { useMemo } from 'react';
import { isValidISODate } from '../domain/dates';
import { isSamePeriod, periodContaining, shiftPeriod, type PeriodKind } from '../domain/periods';
import type { ISODate } from '../domain/types';
import { useSessionState } from './useSessionState';

interface PeriodState {
  kind: PeriodKind;
  /** Any day inside the period shown. */
  anchor: ISODate;
}

const isPeriodState = (value: unknown): value is PeriodState => {
  const v = value as PeriodState;
  return (v?.kind === 'week' || v?.kind === 'month') && typeof v.anchor === 'string' && isValidISODate(v.anchor);
};

/** Week or month being viewed in a section, kept while the app stays open. Starts on the current month. */
export function usePeriodState(storageKey: string, today: ISODate) {
  const [state, setState] = useSessionState<PeriodState>(storageKey, () => ({ kind: 'month', anchor: today }), isPeriodState);
  const period = useMemo(() => periodContaining(state.kind, state.anchor), [state.kind, state.anchor]);
  const currentPeriod = periodContaining(state.kind, today);

  return {
    period,
    isCurrent: isSamePeriod(period, currentPeriod),
    isBeforeCurrent: period.start < currentPeriod.start,
    shift: (steps: number) => setState({ kind: state.kind, anchor: shiftPeriod(period, steps).start }),
    goToCurrent: () => setState({ kind: state.kind, anchor: today }),
    /** Keeps looking at the same moment: the last day shown, but never past today. */
    setKind: (kind: PeriodKind) => setState({ kind, anchor: period.end < today ? period.end : today }),
  };
}
