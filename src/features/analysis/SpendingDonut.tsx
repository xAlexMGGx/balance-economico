import { Pie, PieChart } from 'recharts';
import { Icon } from '../../components/Icon';
import { ColorDot } from '../../components/ui';
import { useThemeColors } from '../../components/useThemeColors';
import type { Slice } from '../../domain/analytics';
import { formatCents, formatPercent } from '../../domain/money';
import { DASH } from './format';

const SIZE = 200;

interface SpendingDonutProps {
  slices: Slice[];
  /** Tapping a group opens its categories. Not set when already showing categories. */
  onSelect?: (id: string) => void;
  /** Set when showing the categories of one group. */
  drilledInto?: { name: string; color: string; onBack: () => void };
  emptyHint?: string;
}

/** Ring of spending with its legend, which doubles as the table of values. */
export function SpendingDonut({ slices, onSelect, drilledInto, emptyHint }: SpendingDonutProps) {
  const colors = useThemeColors();
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const hasData = total > 0;
  // Without spending, draw the empty ring so the chart keeps its place.
  const data = hasData
    ? slices.filter((s) => s.value > 0).map((s) => ({ id: s.id, name: s.name, value: s.value, fill: s.color }))
    : [{ id: 'empty', name: 'Sin gasto', value: 1, fill: colors.track }];

  return (
    <div className="rounded-2xl bg-surface p-4">
      {drilledInto && (
        <div className="-mt-1 mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={drilledInto.onBack}
            className="-ml-2 flex h-11 items-center gap-1 rounded-full pr-3 pl-1 text-[15px] font-medium text-accent active:bg-surface-2"
          >
            <Icon name="back" className="size-5" />
            Todos los grupos
          </button>
          <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold">
            <ColorDot color={drilledInto.color} />
            <span className="truncate">{drilledInto.name}</span>
          </span>
        </div>
      )}

      <div
        className="relative mx-auto"
        style={{ width: SIZE, height: SIZE }}
        role="img"
        aria-label={hasData ? `Gasto total ${formatCents(total)}` : 'Sin gasto en este periodo'}
      >
        <PieChart width={SIZE} height={SIZE} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={64}
            outerRadius={96}
            startAngle={90}
            endAngle={-270}
            // A 2px line in the surface colour separates the slices; a full ring needs no seam.
            stroke={colors.surface}
            strokeWidth={data.length > 1 ? 2 : 0}
            isAnimationActive={false}
            onClick={hasData && onSelect ? (sector) => onSelect((sector.payload as { id: string }).id) : undefined}
            style={{ cursor: hasData && onSelect ? 'pointer' : 'default', outline: 'none' }}
          />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] text-muted">Gastado</span>
          <span className={`text-xl font-semibold ${hasData ? 'text-fg' : 'text-muted'}`}>
            {hasData ? formatCents(total) : DASH}
          </span>
        </div>
      </div>

      {slices.length === 0 ? (
        <p className="mt-4 text-center text-sm text-muted">{emptyHint}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {slices.map((slice) => {
            const content = (
              <>
                <ColorDot color={slice.color} />
                <span className="min-w-0 flex-1 truncate text-[15px]">{slice.name}</span>
                {hasData && slice.value > 0 && (
                  <span className="text-[13px] text-muted tabular-nums">{formatPercent(slice.share)}</span>
                )}
                <span className={`w-28 text-right text-[15px] tabular-nums ${slice.value > 0 ? 'font-medium' : 'text-muted'}`}>
                  {hasData ? formatCents(slice.value) : DASH}
                </span>
                {onSelect && <Icon name="chevronRight" className="size-4 shrink-0 text-muted" />}
              </>
            );
            return (
              <li key={slice.id}>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(slice.id)}
                    className="flex min-h-11 w-full items-center gap-2.5 py-1.5 text-left active:opacity-60"
                    aria-label={`${slice.name}: ${hasData ? formatCents(slice.value) : 'sin gasto'}. Ver categorías`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex min-h-11 items-center gap-2.5 py-1.5">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
