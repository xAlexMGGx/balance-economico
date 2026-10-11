import { Icon } from '../../components/Icon';
import { INTENSITY_LEVELS } from '../../domain/calendar';
import { intensityStyle } from './intensity';

/** Key for the colour scale and the symbols used in the calendar. */
export function CalendarLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        Gasto: menos
        {Array.from({ length: INTENSITY_LEVELS }, (_, i) => (
          <span key={i} className="size-3.5 rounded-[4px]" style={intensityStyle(i + 1)} />
        ))}
        más
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-income" />
        Ingreso
      </span>
      <span className="flex items-center gap-1">
        <Icon name="repeat" className="size-3" />
        Recurrente
      </span>
    </div>
  );
}
