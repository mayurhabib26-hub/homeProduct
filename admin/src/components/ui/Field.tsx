/**
 * Form primitives.
 *
 * Every control here gets a real <label htmlFor>, not a placeholder standing
 * in for one — a placeholder disappears the moment someone types and was
 * never announced as a name. Errors are wired through aria-describedby and
 * aria-invalid so they are heard, not just seen, and inputs clear the 44px
 * floor.
 *
 * The id is derived from the name, so a label and its control cannot drift
 * apart the way they did on the storefront's contact form.
 */
import React, { useId } from 'react';
import { cn } from '../../lib/cn';

const base =
  'w-full min-h-11 rounded-md border bg-white px-3 py-2 text-sm text-[#483828] ' +
  'placeholder:text-[#483828]/40 focus:outline-none focus:border-[#87380F] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

interface BaseProps {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

const Shell: React.FC<BaseProps & { id: string; children: React.ReactNode }> = ({
  label, id, error, hint, required, className, children,
}) => (
  <div className={cn('space-y-1.5', className)}>
    <label htmlFor={id} className="block font-sans text-xs font-semibold tracking-wide text-[#483828]">
      {label}
      {required && <span className="ml-1 text-[#A33A28]" aria-hidden="true">*</span>}
      {required && <span className="sr-only"> (required)</span>}
    </label>
    {children}
    {hint && !error && (
      <p id={`${id}-hint`} className="text-[11px] leading-relaxed text-[#483828]/60">{hint}</p>
    )}
    {error && (
      // Announced when it appears, rather than only turning the border red —
      // colour alone is not an error message.
      <p id={`${id}-error`} role="alert" className="text-[11px] font-medium text-[#A33A28]">
        {error}
      </p>
    )}
  </div>
);

const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

type InputProps = BaseProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'id'>;

export const Field: React.FC<InputProps> = ({ label, name, error, hint, required, className, ...rest }) => {
  const id = `f-${name}-${useId().replace(/:/g, '')}`;
  return (
    <Shell label={label} name={name} id={id} error={error} hint={hint} required={required} className={className}>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(base, error ? 'border-[#A33A28]' : 'border-[#EBD9BC]')}
        {...rest}
      />
    </Shell>
  );
};

type AreaProps = BaseProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name' | 'id'>;

export const TextArea: React.FC<AreaProps> = ({ label, name, error, hint, required, className, rows = 4, ...rest }) => {
  const id = `t-${name}-${useId().replace(/:/g, '')}`;
  return (
    <Shell label={label} name={name} id={id} error={error} hint={hint} required={required} className={className}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(base, 'py-2.5 leading-relaxed', error ? 'border-[#A33A28]' : 'border-[#EBD9BC]')}
        {...rest}
      />
    </Shell>
  );
};

type SelectProps = BaseProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'name' | 'id'> & {
  options: { value: string; label: string }[];
};

export const Select: React.FC<SelectProps> = ({ label, name, error, hint, required, className, options, ...rest }) => {
  const id = `s-${name}-${useId().replace(/:/g, '')}`;
  return (
    <Shell label={label} name={name} id={id} error={error} hint={hint} required={required} className={className}>
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(base, error ? 'border-[#A33A28]' : 'border-[#EBD9BC]')}
        {...rest}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Shell>
  );
};

/**
 * A list of short strings — ingredients, steps.
 *
 * One input per line rather than a comma-separated box: the data is an array,
 * and asking someone to encode an array as a string is how "salt, pepper" ends
 * up as a single ingredient.
 */
export const ListField: React.FC<{
  label: string;
  name: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
}> = ({ label, name, values, onChange, placeholder, hint, error }) => {
  const id = `l-${name}-${useId().replace(/:/g, '')}`;
  const rows = values.length ? values : [''];

  const set = (i: number, v: string) => onChange(rows.map((r, j) => (j === i ? v : r)));
  const add = () => onChange([...rows, '']);
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i).length ? rows.filter((_, j) => j !== i) : ['']);

  return (
    <div className="space-y-1.5">
      <span id={id} className="block font-sans text-xs font-semibold tracking-wide text-[#483828]">{label}</span>
      {hint && !error && <p className="text-[11px] text-[#483828]/60">{hint}</p>}
      {error && <p role="alert" className="text-[11px] font-medium text-[#A33A28]">{error}</p>}

      <ul className="space-y-2" aria-labelledby={id}>
        {rows.map((v, i) => (
          <li key={i} className="flex gap-2">
            <input
              value={v}
              onChange={(e) => set(i, e.target.value)}
              placeholder={placeholder}
              aria-label={`${label} ${i + 1}`}
              className={cn(base, 'flex-1', error ? 'border-[#A33A28]' : 'border-[#EBD9BC]')}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              className="grid min-h-11 min-w-11 place-items-center rounded-md border border-[#EBD9BC] text-[#483828]/70 transition-colors hover:border-[#A33A28] hover:text-[#A33A28]"
            >
              &times;
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={add}
        className="inline-flex min-h-11 items-center px-1 text-xs font-semibold text-[#87380F] hover:underline"
      >
        + Add {label.toLowerCase().replace(/s$/, '')}
      </button>
    </div>
  );
};
