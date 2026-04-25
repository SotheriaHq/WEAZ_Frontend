import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell, Sparkles, Clock, Rocket } from 'lucide-react';

interface ComingSoonProps {
  /** Page title */
  title: string;
  /** Page description */
  description: string;
  /** Primary emoji to display */
  emoji: string;
  /** Feature highlights */
  features?: string[];
  /** Expected launch timeframe */
  eta?: string;
  /** Show notify button */
  showNotify?: boolean;
  /** Custom back path */
  backPath?: string;
  /** Theme variant */
  variant?: 'default' | 'marketplace' | 'social' | 'creator';
  /** Custom className for the root container */
  className?: string;
  /** Minimum height override (default: min-h-screen) */
  minHeight?: string;
}

/**
 * ComingSoon - Premium placeholder for features under development
 * 
 * Design: Glassmorphism with animated gradients, floating elements,
 * and engaging micro-interactions. Supports both dark and light themes.
 */
const ComingSoon: React.FC<ComingSoonProps> = ({
  title,
  description,
  emoji,
  features = [],
  eta,
  showNotify = true,
  backPath = '/',
  variant = 'default',
  className = '',
  minHeight = 'min-h-screen',
}) => {
  const navigate = useNavigate();

  // Variant-based configurations
  const variantConfig = {
    default: {
      gradientDark: 'from-purple-600/20 via-indigo-600/20 to-blue-600/20',
      gradientLight: 'from-purple-400/30 via-indigo-400/30 to-blue-400/30',
      accentDark: 'text-purple-400',
      accentLight: 'text-purple-600',
      buttonDark: 'bg-purple-600 hover:bg-purple-700',
      buttonLight: 'bg-purple-600 hover:bg-purple-700',
    },
    marketplace: {
      gradientDark: 'from-emerald-600/20 via-teal-600/20 to-cyan-600/20',
      gradientLight: 'from-emerald-400/30 via-teal-400/30 to-cyan-400/30',
      accentDark: 'text-emerald-400',
      accentLight: 'text-emerald-600',
      buttonDark: 'bg-emerald-600 hover:bg-emerald-700',
      buttonLight: 'bg-emerald-600 hover:bg-emerald-700',
    },
    social: {
      gradientDark: 'from-pink-600/20 via-rose-600/20 to-red-600/20',
      gradientLight: 'from-pink-400/30 via-rose-400/30 to-red-400/30',
      accentDark: 'text-pink-400',
      accentLight: 'text-pink-600',
      buttonDark: 'bg-pink-600 hover:bg-pink-700',
      buttonLight: 'bg-pink-600 hover:bg-pink-700',
    },
    creator: {
      gradientDark: 'from-amber-600/20 via-orange-600/20 to-yellow-600/20',
      gradientLight: 'from-amber-400/30 via-orange-400/30 to-yellow-400/30',
      accentDark: 'text-amber-400',
      accentLight: 'text-amber-600',
      buttonDark: 'bg-amber-600 hover:bg-amber-700',
      buttonLight: 'bg-amber-600 hover:bg-amber-700',
    },
  };

  const config = variantConfig[variant];
  // Determine if we should show the back button.
  // If embedded (e.g. backPath is empty string or '#'), hide it? 
  // Or just always show unless explicit hide prop? For now, keep as is.

  return (
    <div className={`${minHeight} relative overflow-hidden transition-colors duration-300 ${className}`}>
      {/* Animated Background */}
      <div className="absolute inset-0">
        {/* Gradient orbs - Dark Theme */}
        <motion.div
          className={`hidden dark:block absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gradient-to-r ${config.gradientDark} blur-3xl opacity-50`}
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className={`hidden dark:block absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-gradient-to-l ${config.gradientDark} blur-3xl opacity-40`}
          animate={{
            x: [0, -40, 0],
            y: [0, 40, 0],
            scale: [1, 0.9, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Gradient orbs - Light Theme */}
        <motion.div
          className={`dark:hidden absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gradient-to-r ${config.gradientLight} blur-3xl opacity-60`}
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className={`dark:hidden absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-gradient-to-l ${config.gradientLight} blur-3xl opacity-50`}
          animate={{
            x: [0, -40, 0],
            y: [0, 40, 0],
            scale: [1, 0.9, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 dark:opacity-[0.02] opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Content */}
      <div className={`relative z-10 ${minHeight} flex flex-col items-center justify-center px-4 py-12`}>
        {/* Back button */}
        {backPath !== '#' && (
        <motion.div
          className="absolute top-6 left-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => navigate(backPath)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back</span>
          </button>
        </motion.div>
        )}

        {/* Main content */}
        <motion.div
          className="text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Icon with glow */}
          <motion.div
            className="relative inline-block mb-8"
            animate={{ 
              y: [0, -10, 0],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="relative">
              {/* Icon badge */}
              <div className={`w-32 h-32 rounded-3xl bg-white dark:bg-white/10 shadow-xl dark:shadow-none backdrop-blur-sm flex items-center justify-center border border-gray-200 dark:border-white/10`}>
                <span className="text-7xl">{emoji}</span>
              </div>
              {/* Glow effect */}
              <div className={`absolute inset-0 bg-gradient-to-r ${config.gradientLight} dark:${config.gradientDark} blur-2xl opacity-30 -z-10 scale-150`} />
            </div>
          </motion.div>

          {/* Title with sparkle */}
          <div className="relative inline-block mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
            <motion.div
              className="absolute -top-2 -right-6"
              animate={{ rotate: [0, 15, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className={`w-6 h-6 ${config.accentLight} dark:${config.accentDark}`} />
            </motion.div>
          </div>

          {/* Description */}
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            {description}
          </p>

          {/* ETA badge */}
          {eta && (
            <motion.div
              className="inline-flex items-center gap-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-4 py-2 mb-8 shadow-sm dark:shadow-none"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Clock className={`w-4 h-4 ${config.accentLight} dark:${config.accentDark}`} />
              <span className="text-sm text-gray-700 dark:text-gray-300">Expected: {eta}</span>
            </motion.div>
          )}

          {/* Features preview */}
          {features.length > 0 && (
            <motion.div
              className="mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-4">
                What's Coming
              </h3>
              <div className="flex flex-wrap justify-center gap-3">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature}
                    className="flex items-center gap-2 bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-full px-4 py-2 shadow-sm dark:shadow-none"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <Rocket className={`w-4 h-4 ${config.accentLight} dark:${config.accentDark}`} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Action buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {showNotify && (
              <button
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-white font-medium transition-all ${config.buttonDark} shadow-lg hover:shadow-xl hover:-translate-y-0.5`}
                onClick={() => {
                  // TODO: Implement notification signup
                  alert('You\'ll be notified when this feature launches! 🎉');
                }}
              >
                <Bell className="w-5 h-5" />
                Notify Me
              </button>
            )}
            <button
              onClick={() => navigate(backPath)}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-white/20 transition-all shadow-sm dark:shadow-none"
            >
              Back to Home
            </button>
          </motion.div>
        </motion.div>

        {/* Floating decorative elements */}
        <motion.div
          className="absolute bottom-10 left-10 text-4xl opacity-20 dark:opacity-20"
          animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
        >
          ✨
        </motion.div>
        <motion.div
          className="absolute top-20 right-20 text-3xl opacity-20 dark:opacity-20"
          animate={{ y: [0, 15, 0], rotate: [0, -15, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          🚀
        </motion.div>
        <motion.div
          className="absolute bottom-20 right-10 text-3xl opacity-20 dark:opacity-20"
          animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        >
          💫
        </motion.div>
      </div>
    </div>
  );
};

export default ComingSoon;
