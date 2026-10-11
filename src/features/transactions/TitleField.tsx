import { useState } from 'react';
import { inputClass } from '../../components/ui';
import { matchTitleSuggestions, type TitleSuggestion } from '../../domain/transactions';

interface TitleFieldProps {
  value: string;
  onChange: (title: string) => void;
  suggestions: TitleSuggestion[];
  onPick: (suggestion: TitleSuggestion) => void;
  onFocus: () => void;
}

const suggestionClass = 'h-11 max-w-full truncate rounded-full bg-surface-2 px-4 text-[15px] active:bg-line';

export function TitleField({ value, onChange, suggestions, onPick, onFocus }: TitleFieldProps) {
  const [focused, setFocused] = useState(false);
  const matches = focused || value ? matchTitleSuggestions(suggestions, value) : [];

  return (
    <div>
      <input
        className={inputClass}
        placeholder="Título (opcional)"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          setFocused(true);
          onFocus();
        }}
        onBlur={() => setFocused(false)}
        enterKeyHint="done"
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        maxLength={80}
        autoComplete="off"
        aria-label="Título"
      />
      {matches.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {matches.map((suggestion) => (
            <button
              key={suggestion.title}
              type="button"
              // Keep the focus in the input, so the tap is not lost when the keyboard closes.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(suggestion)}
              className={suggestionClass}
            >
              {suggestion.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
