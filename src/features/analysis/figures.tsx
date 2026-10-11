import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import type { Tone, Variation } from '../../domain/analytics';
import { formatCents } from '../../domain/money';
import type { Cents } from '../../domain/types';
import { DASH } from '../../components/ui';

// Number blocks of the Análisis section: stat tiles, metric rows and the variation line.

const TONE_CLASS: Record<Tone, string> = { good: 'text-income', bad: 'text-expense', neutral: 'text-muted' };

/** "↑ +120,00 € vs septiembre", green or red depending on whether the change is good. A dash without data. */
export function DeltaLine({
  variation,
  format,
  caption,
}: {
  variation: Variation | null;
  format: (variation: Variation) => string;
  caption?: string;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-snug">
      {variation ? (
        <span className={`inline-flex items-center gap-0.5 font-semibold ${TONE_CLASS[variation.tone]}`}>
          {variation.delta > 0 && <Icon name="arrowUp" className="size-3.5" />}
          {variation.delta < 0 && <Icon name="arrowDown" className="size-3.5" />}
          {format(variation)}
        </span>
      ) : (
        <span className="font-semibold text-muted">{DASH}</span>
      )}
      {caption && <span className="text-muted">{caption}</span>}
    </p>
  );
}

export function StatTile({
  label,
  value,
  valueClass,
  delta,
}: {
  label: string;
  value: string | null;
  valueClass: string;
  delta: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className={`text-2xl leading-tight font-semibold ${value === null ? 'text-muted' : valueClass}`}>{value ?? DASH}</p>
      {delta}
    </div>
  );
}

/** One line of a comparison card: value now, value before and the change. */
export function MetricRow({
  label,
  value,
  valueClass,
  previous,
  previousLabel,
  variation,
  formatDelta,
}: {
  label: string;
  value: Cents | null;
  valueClass: string;
  previous: Cents | null;
  previousLabel: string;
  variation: Variation | null;
  formatDelta: (variation: Variation) => string;
}) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium">{label}</span>
        <span className={`text-lg font-semibold ${value === null ? 'text-muted' : valueClass}`}>
          {value === null ? DASH : formatCents(value)}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-[13px] text-muted">
          {previousLabel}: {previous === null ? DASH : formatCents(previous)}
        </span>
        <DeltaLine variation={variation} format={formatDelta} />
      </div>
    </li>
  );
}

export function SectionHeader({ title, caption }: { title: string; caption?: ReactNode }) {
  return (
    <div className="mb-2 px-1">
      <h2 className="text-lg font-bold">{title}</h2>
      {caption && <p className="text-[13px] text-muted">{caption}</p>}
    </div>
  );
}
