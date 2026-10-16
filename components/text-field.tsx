import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function TextField({ label, error, id, name, ...props }: TextFieldProps) {
  const inputId = id ?? name;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-[15px] placeholder:text-muted/70"
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
