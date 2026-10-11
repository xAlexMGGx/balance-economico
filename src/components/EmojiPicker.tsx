import { useState } from 'react';
import { inputClass } from './ui';

const EMOJI = [
  // Comida y bebida
  '🛒', '🍽️', '🍔', '🍕', '🥗', '☕', '🍺', '🍷', '🥐', '🍣', '🍦', '🥡',
  // Casa y suministros
  '🏠', '💡', '💧', '🔥', '📶', '📱', '🧺', '🛋️', '🧹', '🔧', '🪴', '🐶',
  // Transporte
  '🚗', '⛽', '🅿️', '🚌', '🚇', '🚆', '🚕', '🛵', '🚲', '✈️', '🛣️', '🔩',
  // Ocio
  '🎬', '🎮', '🎵', '📚', '🎉', '🏖️', '🏨', '🎟️', '🎨', '⚽', '🏋️', '🎁',
  // Salud y cuidado
  '💊', '🏥', '🦷', '👓', '💇', '🧴', '👕', '👟', '💄', '🧘', '🩺', '🐾',
  // Dinero y trabajo
  '💼', '💰', '💶', '🏦', '📈', '🧾', '💳', '🎓', '💻', '📦', '🔁', '❓',
];

/** First visible character of a text, so a pasted or typed emoji is kept whole. */
function firstGrapheme(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (typeof Intl.Segmenter === 'function') {
    const first = new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(trimmed)[Symbol.iterator]().next();
    return first.done ? '' : first.value.segment;
  }
  return Array.from(trimmed)[0] ?? '';
}

export function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const [custom, setCustom] = useState('');
  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1" role="radiogroup" aria-label="Icono">
        {EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            role="radio"
            aria-checked={emoji === value}
            onClick={() => onChange(emoji)}
            className={`flex h-11 items-center justify-center rounded-xl text-2xl leading-none ${
              emoji === value ? 'bg-accent/20 ring-2 ring-accent' : 'active:bg-surface-2'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <input
        className={`${inputClass} mt-2`}
        placeholder="O escribe otro emoji"
        value={custom}
        onChange={(event) => {
          const emoji = firstGrapheme(event.target.value);
          setCustom(emoji);
          if (emoji) onChange(emoji);
        }}
        aria-label="Otro emoji"
      />
    </div>
  );
}
