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
    bg-white dark:bg-zinc-900/60
    border rounded-xl
    text-gray-900 dark:text-white
    shadow-sm
    focus:outline-none focus:ring-0 focus:border-transparent
    transition-colors duration-200
    appearance-none pr-10 cursor-pointer
  `,
  filter: `
    px-3 py-2 text-sm font-medium
    bg-white dark:bg-zinc-900/80
    border border-gray-200 dark:border-white/10
    rounded-lg
    text-gray-700 dark:text-gray-200
    shadow-sm
    hover:border-purple-300 dark:hover:border-purple-500/50
    focus:outline-none focus:ring-0 focus:border-transparent
    transition-colors duration-200
    cursor-pointer
    appearance-none
    pr-8
  `,
  compact: `
    px-2.5 py-1.5 text-xs font-medium
    bg-white/80 dark:bg-zinc-900/60
    border border-gray-200 dark:border-white/10
    rounded-md
    text-gray-600 dark:text-gray-300
    hover:bg-gray-50 dark:hover:bg-white/5
    focus:outline-none focus:ring-0 focus:border-transparent
    transition-colors duration-150
    cursor-pointer
    appearance-none
    pr-6
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
          ? "border-red-500 dark:border-red-500"
          : ""
      }
      ${disabled ? "opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-800/50" : ""}
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
          <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
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
              className={`${baseClasses} flex items-center justify-between gap-3 text-left ${disabled ? "pointer-events-none" : ""}`}
              aria-label={label}
            >
              <span className="truncate">{selectedLabel}</span>
              {showChevron ? <span aria-hidden="true" className={`shrink-0 text-gray-400 ${variant === "compact" ? 'text-xs' : 'text-base'}`}>{open ? '⌃' : '⌄'}</span> : null}
            </DropdownTrigger>
            <DropdownMenu className="min-w-[220px]">
              {options.map((opt) => {
                const isActive = `${opt.value}` === `${currentValue ?? ""}`;
                return (
                  <DropdownItem
                    key={`${opt.value}`}
                    disabled={opt.disabled}
                    onClick={() =>
                      !opt.disabled && handleSelect(`${opt.value}`)
                    }
                    className={`${isActive ? "bg-white/30 dark:bg-white/10" : ""} ${opt.disabled ? "opacity-60 cursor-not-allowed" : ""}`}
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
              <p className="text-xs text-gray-500 dark:text-zinc-500">
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
