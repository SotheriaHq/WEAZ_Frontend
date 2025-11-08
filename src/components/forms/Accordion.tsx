import React from 'react';

type Section = {
  id: string;
  title: string;
  content: React.ReactNode;
  required?: boolean;
};

interface AccordionProps {
  sections: Section[];
  openId: string;
  onOpen: (id: string) => void;
}

const Accordion: React.FC<AccordionProps> = ({ sections, openId, onOpen }) => {
  return (
    <div className="rounded-lg divide-y divide-white/10 bg-white/5 backdrop-blur-md border border-white/10">
      {sections.map((s) => {
        const open = s.id === openId;
        return (
          <div key={s.id} className="group">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
              onClick={() => onOpen(open ? '' : s.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/90">{s.title}</span>
                {s.required && <span className="text-[10px] text-white/60">(required)</span>}
              </div>
              <span className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>▾</span>
            </button>
            <div
              className={`px-4 overflow-hidden transition-all duration-300 ease-out ${
                open ? 'max-h-[1000px] opacity-100 py-3' : 'max-h-0 opacity-0'
              }`}
            >
              {open && <div className="space-y-3">{s.content}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Accordion;

