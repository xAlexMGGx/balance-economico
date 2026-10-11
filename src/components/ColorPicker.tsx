import { PALETTE } from '../domain/palette';
import { Icon } from './Icon';

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Color">
      {PALETTE.map((color) => {
        const selected = color === value.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            onClick={() => onChange(color)}
            className="flex h-11 items-center justify-center"
          >
            <span
              className={`flex size-9 items-center justify-center rounded-full text-white ${
                selected ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface' : ''
              }`}
              style={{ backgroundColor: color }}
            >
              {selected && <Icon name="check" className="size-5" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
