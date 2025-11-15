/**
 * PHASE 4: Simple Accordion Component
 * Single-section collapsible with controlled state
 */
import React, { useState, useCallback, useMemo } from 'react';

interface SimpleAccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const SimpleAccordion: React.FC<SimpleAccordionProps> = ({ title, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const containerClass = useMemo(() => 
    `rounded-xl border border-white/20 bg-white/5 px-1 py-3 backdrop-blur-md transition-all duration-300 ${isOpen ? 'pb-3' : ''}`,
    [isOpen]
  );

  const chevronClass = useMemo(() => 
    `transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`,
    [isOpen]
  );

  return (
    <div className={containerClass}>
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-gray-800 dark:text-white focus:outline-none"
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <span className={chevronClass}>▾</span>
      </button>
      
      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{
          gridTemplateRows: isOpen ? '1fr' : '0fr',
        }}
      >
        <div className="overflow-hidden">
          {isOpen && (
            <div className="mt-3 space-y-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleAccordion;
