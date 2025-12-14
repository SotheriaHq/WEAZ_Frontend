import React from 'react';
import { Store, Shirt, Layers, FileCheck, Camera, Plus } from 'lucide-react';

interface StoreWelcomeScreenProps {
  onGetStarted: () => void;
  onResumeDraft?: () => void;
  onStartFresh?: () => void;
  hasDraft?: boolean;
  hasLiveStore?: boolean;
}

const requirementItems = [
  { icon: Shirt, label: '3+ Hero Products' },
  { icon: Layers, label: '1 Collection or Look' },
  { icon: FileCheck, label: 'Store Policies' },
  { icon: Camera, label: 'Media Standards Met' },
];

/**
 * Store Creation Welcome Screen (Screen 1.1)
 * First screen users see when starting store creation
 * Features: Progress dots, requirements preview, Get Started CTA
 * Respects system theme (light/dark mode)
 */
const StoreWelcomeScreen: React.FC<StoreWelcomeScreenProps> = ({
  onGetStarted,
  onResumeDraft,
  onStartFresh,
  hasDraft,
  hasLiveStore,
}) => {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center relative overflow-hidden p-4 sm:p-6">
      {/* Removed ambient background effects - Layout provides unified gradient */}

      {/* Content Card - glassmorphism with theme adaptation */}
      <div className="w-full max-w-[600px] rounded-3xl p-8 md:p-12 relative z-10 
        bg-white/80 dark:bg-white/[0.03] 
        backdrop-blur-xl 
        border border-gray-200/50 dark:border-white/[0.08] 
        shadow-[0_20px_60px_-15px_rgba(147,51,234,0.2),0_10px_30px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_60px_-12px_rgba(147,51,234,0.25),0_15px_40px_-10px_rgba(0,0,0,0.5)]"
      >
        {/* Top Icon with Glow */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Glow behind icon */}
            <div className="absolute inset-0 bg-purple-500/30 dark:bg-purple-500/30 rounded-full blur-xl animate-pulse" />
            
            {/* Icon Container */}
            <div className="relative z-10 w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/10 dark:to-white/5 rounded-2xl border border-gray-200/50 dark:border-white/10 flex items-center justify-center backdrop-blur-md shadow-lg animate-bounce-slow">
              <Store className="w-8 h-8 text-purple-600 dark:text-purple-400 drop-shadow-lg" />
            </div>
            
            {/* Plus badge */}
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center border-2 border-white dark:border-[#1a1a1a]">
              <Plus className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>

        {/* Header Section */}
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
            Create Your Store
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg leading-relaxed max-w-md mx-auto font-light">
            Set up your fashion brand on Threadly in minutes. Reach style-conscious shoppers across Africa.
          </p>
        </div>

        {/* Progress Indicator - 6 steps */}
        <div className="flex justify-center items-center gap-3 mb-10">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.6)]" />
          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-white/20" />
        </div>

        {/* Requirements Checklist */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-500 font-semibold mb-4 text-center">
            Requirements Preview
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {requirementItems.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-xl px-4 py-3 flex items-center gap-3 group transition-colors duration-300
                  bg-gray-50/80 dark:bg-white/5 
                  hover:bg-purple-50 dark:hover:bg-white/10 
                  border border-gray-200/50 dark:border-white/5 
                  backdrop-blur-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {/* If user has a draft, show Continue as primary, else show Get Started */}
          {hasDraft ? (
            <>
              {/* Continue from Draft - Primary CTA */}
              <button
                onClick={onResumeDraft}
                className="w-full group relative overflow-hidden rounded-xl 
                  bg-gradient-to-r from-purple-600 to-purple-700 
                  px-8 py-4 
                  transition-all duration-300 
                  hover:brightness-110 hover:shadow-lg hover:shadow-purple-500/25
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-[#0f0f0f]"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="font-semibold text-white text-lg tracking-wide">Continue from Draft</span>
                  <svg className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </button>

              {/* Delete draft option */}
              {onStartFresh && (
                <div className="flex items-center justify-center">
                  <button
                    onClick={onStartFresh}
                    className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-rose-500 dark:hover:text-rose-300 transition-colors duration-300 py-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete draft & start fresh</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Get Started - Primary CTA (only when no draft) */}
              <button
                onClick={onGetStarted}
                disabled={hasLiveStore}
                className={`w-full group relative overflow-hidden rounded-xl 
                  px-8 py-4 
                  transition-all duration-300 
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-[#0f0f0f]
                  ${hasLiveStore 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:brightness-110 hover:shadow-lg hover:shadow-purple-500/25'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="font-semibold text-white text-lg tracking-wide">
                    {hasLiveStore ? 'Store Already Exists' : 'Get Started'}
                  </span>
                  {!hasLiveStore && (
                    <svg className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  )}
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default StoreWelcomeScreen;
