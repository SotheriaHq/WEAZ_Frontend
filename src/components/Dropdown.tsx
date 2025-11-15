import React, { useState, useRef, useEffect } from 'react';
import Button from './Button';

type DropdownOption = { label: string; onClick: () => void };

interface DropdownProps {
  buttonLabel: React.ReactNode;
  options: DropdownOption[];
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  className?: string;
  hideCaret?: boolean; // when true, do not render the caret icon
  buttonClassName?: string; // extra classes for the button (e.g., to remove focus borders)
}

const Dropdown: React.FC<DropdownProps> = ({ buttonLabel, options, variant = 'primary', className = '', hideCaret = false, buttonClassName = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setIsOpen((s) => !s);
  };

  const handleOption = (fn: () => void) => {
    try {
      fn();
    } finally {
      setIsOpen(false);
    }
  };

  return (
    <div ref={ref} className={`relative inline-block text-left ${className}`}>
      <Button
        variant={variant}
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={buttonClassName}
      >
        {buttonLabel}
        {!hideCaret && (
          <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </Button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleOption(opt.onClick)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;
