import React from 'react';
import StudioSidebar from '@/components/studio/StudioSidebar';
import { Navbar } from '@/components/Navbar';

type StudioScaffoldProps = {
  active: string;
  onSelect: (key: string) => void;
  children: React.ReactNode;
};

const StudioScaffold: React.FC<StudioScaffoldProps> = ({ active, onSelect, children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8ff] via-[#f5f0ff] to-[#ede9f7] dark:from-[#0f0f0f] dark:via-[#0a0a0a] dark:to-[#000000]">
      <Navbar minimal={false} />
      <StudioSidebar active={active} onSelect={onSelect} />

      <div className="min-h-screen pb-10 px-4 md:pl-[220px] pt-20">
        <div className="max-w-6xl mx-auto">{children}</div>
      </div>
    </div>
  );
};

export default StudioScaffold;
