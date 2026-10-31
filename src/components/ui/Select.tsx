import React, { forwardRef, useMemo, useState } from "react";
import {
  Dropdown,
  DropdownMenu,
  DropdownTrigger,
  DropdownItem,
} from "./Dropdown";

export type SelectVariant = "default" | "filter" | "compact";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  /** Visual variant: 'default' for forms, 'filter' for filter bars, 'compact' for inline */
  variant?: SelectVariant;
}

const variantStyles: Record<SelectVariant, string> = {
  default: `
    px-4 py-3 text-sm font-medium
    bg-[color:var(--surface-primary)]
    border border-purple-500/15 dark:border-white/[0.08]
    rounded-2xl
    text-[color:var(--wiez-text-primary,var(--text-primary))]
    shadow-[0_2px_8px_rgba(124,58,237,0.04),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_2px_8px_rgba(124,58,237,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]
    hover:shadow-[0_4px_16px_rgba(124,58,237,0.08),0_1px_4px_rgba(168,85,247,0.04)] dark:hover:shadow-[0_4px_20px_rgba(147,51,234,0.3)]
    hover:border-purple-500/30 dark:hover:border-purple-400/30
    hover:scale-[1.005]
    focus:outline-none focus:shadow-[0_0_0_1px_rgba(168,85,247,0.22),0_4px_20px_-2px_rgba(168,85,247,0.20),inset_0_1px_0_rgba(255,255,255,1)]
    transition-all duration-200
    cursor-pointer
  `,
  filter: `
    px-3.5 py-2 text-xs font-semibold
    bg-white/80 dark:bg-[#181322]/80 backdrop-blur-md
    border border-purple-500/15 dark:border-white/[0.08]
    rounded-xl
    text-[color:var(--wiez-text-primary,var(--text-primary))]
    shadow-[0_2px_8px_rgba(124,58,237,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_8px_rgba(124,58,237,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]
    hover:shadow-[0_4px_14px_rgba(124,58,237,0.08),0_1px_3px_rgba(168,85,247,0.04)] dark:hover:shadow-[0_4px_18px_rgba(147,51,234,0.3)]
    hover:border-purple-400/40 dark:hover:border-purple-400/30
    hover:scale-[1.01]
    active:scale-[0.99]
    focus:outline-none focus:shadow-[0_0_0_1px_rgba(168,85,247,0.22),0_4px_20px_-2px_rgba(168,85,247,0.20),inset_0_1px_0_rgba(255,255,255,1)]
    transition-all duration-200
    cursor-pointer
  `,
  compact: `
    px-2.5 py-1.5 text-xs font-medium
    bg-white/80 dark:bg-[#181322]/80 backdrop-blur-md
    border border-purple-500/15 dark:border-white/[0.08]
    rounded-lg
    text-[color:var(--text-secondary)]
    shadow-[0_1px_4px_rgba(124,58,237,0.04)] dark:shadow-[0_1px_4px_rgba(124,58,237,0.18)]
    hover:shadow-[0_3px_10px_rgba(124,58,237,0.08)] dark:hover:shadow-[0_3px_12px_rgba(147,51,234,0.25)]
    hover:scale-[1.01]
    focus:outline-none focus:shadow-[0_0_0_1px_rgba(168,85,247,0.22),0_4px_20px_-2px_rgba(168,85,247,0.20),inset_0_1px_0_rgba(255,255,255,1)]
    transition-all duration-150
    cursor-pointer
  `,
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      required,
      error,
      helperText,
      fullWidth = true,
      variant = "default",
      className = "",
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const valueProp = props.value;
    const defaultValueProp = props.defaultValue;
    const isControlled = valueProp !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState<
      string | number | readonly string[] | undefined
    >(defaultValueProp as string | number | readonly string[] | undefined);
    const currentValue = isControlled ? valueProp : uncontrolledValue;

    const options = useMemo(() => {
      const collected: Array<{
        value: string;
        label: string;
        disabled: boolean;
      }> = [];
      const visit = (nodeChildren: React.ReactNode) => {
        React.Children.forEach(nodeChildren, (node) => {
          if (!React.isValidElement(node)) return;

          if (node.type === React.Fragment) {
            const fragmentNode = node as React.ReactElement<{
              children?: React.ReactNode;
            }>;
            visit(fragmentNode.props.children);
            return;
          }

          if (node.type === "option") {
            const option = node as React.ReactElement<
              React.OptionHTMLAttributes<HTMLOptionElement>
            >;
            const rawLabel = option.props.children;
            const labelText =
              typeof rawLabel === "string"
                ? rawLabel
                : Array.isArray(rawLabel)
                  ? rawLabel.join("")
                  : `${rawLabel ?? ""}`;
            collected.push({
              value: String(option.props.value ?? labelText),
              label: labelText,
              disabled: option.props.disabled ?? false,
            });
          }
        });
      };

      visit(children);
      return collected;
    }, [children]);

    const selectedOption =
      options.find((opt) => `${opt.value}` === `${currentValue ?? ""}`) ??
      options[0];
    const selectedLabel = selectedOption?.label ?? "";

    const baseClasses = `
      ${fullWidth ? "w-full" : ""}
      ${variantStyles[variant]}
      ${
        error
          ? "!border-red-500 dark:!border-red-500 !shadow-[0_2px_12px_rgba(239,68,68,0.2)]"
          : ""
      }
      ${disabled ? "opacity-60 cursor-not-allowed bg-[color:var(--surface-muted)]" : ""}
    `;

    const showChevron = true;
    const handleSelect = (value: string) => {
      if (!isControlled) {
        setUncontrolledValue(value);
      }
      if (props.onChange) {
        props.onChange({
          target: { value },
        } as React.ChangeEvent<HTMLSelectElement>);
      }
      setOpen(false);
    };

    return (
      <div
        className={`${fullWidth ? "w-full" : ""} ${variant !== "default" ? "relative inline-block" : ""} ${className}`}
      >
        {label && (
          <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)] mb-2">
            {label}
            {required && <span className="text-purple-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <Dropdown
            open={open}
            onOpenChange={setOpen}
            placement="bottom-start"
            className={fullWidth ? "w-full" : ""}
          >
            <DropdownTrigger
              type="button"
              disabled={disabled}
              className={`${baseClasses} flex items-center justify-between gap-2.5 text-left ${disabled ? "pointer-events-none" : ""}`}
              aria-label={label}
            >
              <span className="leading-tight break-words">{selectedLabel}</span>
              {showChevron ? (
                <span
                  aria-hidden="true"
                  className={`shrink-0 text-[color:var(--text-secondary)] transition-transform duration-200 ${
                    open ? "rotate-180" : ""
                  } ${variant === "compact" ? "text-xs" : "text-xs"}`}
                >
                  ⌄
                </span>
              ) : null}
            </DropdownTrigger>
            <DropdownMenu className="min-w-[200px]">
              {options.map((opt) => {
                const isActive = `${opt.value}` === `${currentValue ?? ""}`;
                return (
                  <DropdownItem
                    key={`${opt.value}`}
                    disabled={opt.disabled}
                    onClick={() =>
                      !opt.disabled && handleSelect(`${opt.value}`)
                    }
                    className={opt.disabled ? "opacity-60 cursor-not-allowed" : ""}
                    selected={isActive}
                  >
                    {opt.label}
                  </DropdownItem>
                );
              })}
            </DropdownMenu>
          </Dropdown>
          <select
            ref={ref}
            disabled={disabled}
            className="sr-only"
            value={
              currentValue as string | number | readonly string[] | undefined
            }
            {...props}
            tabIndex={-1}
          >
            {children}
          </select>
        </div>
        {(helperText || error) && (
          <div className="mt-1.5">
            {error ? (
              <p className="text-xs text-red-500">{error}</p>
            ) : helperText ? (
              <p className="text-xs text-[color:var(--text-secondary)]">
                {helperText}
              </p>
            ) : null}
          </div>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";

export default Select;
