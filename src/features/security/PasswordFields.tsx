import { Field, inputClass } from '../../components/ui';

/**
 * iOS only offers to save or fill a password when the form has a user name. The app has a single
 * user, so this invisible field always says "Balance".
 */
export function HiddenUsername() {
  return (
    <input
      type="text"
      name="username"
      autoComplete="username"
      value="Balance"
      readOnly
      tabIndex={-1}
      aria-hidden="true"
      className="sr-only"
    />
  );
}

export function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  autoFocus = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="password"
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
      />
    </Field>
  );
}
