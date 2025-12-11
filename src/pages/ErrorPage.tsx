import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FrostedButton } from '@/components/ui/FrostedButton';
import { Home, ArrowLeft, RefreshCcw, AlertTriangle, WifiOff, ServerCrash, ShieldX } from 'lucide-react';

/**
 * ErrorPage - Premium error boundary page
 * 
 * Handles different error types with appropriate messaging:
 * - 404: Not Found
 * - 401/403: Unauthorized/Forbidden
 * - 500: Server Error
 * - Network errors
 * - Unknown errors
 */
const ErrorPage: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();
  console.error('ErrorPage caught:', error);

  // Determine error type and customize display
  let status = 500;
  let title = 'Something Went Wrong';
  let message = 'An unexpected error occurred. Please try again.';
  let emoji = '😵';
  let Icon = AlertTriangle;
  let suggestion = 'Try refreshing the page or going back home.';
  let accentColor = 'text-red-400';
  let bgGradient = 'from-red-600/20 via-orange-600/15 to-yellow-600/10';

  if (isRouteErrorResponse(error)) {
    status = error.status;
    
    switch (error.status) {
      case 404:
        title = 'Page Not Found';
        message = 'The page you\'re looking for doesn\'t exist or has been moved.';
        emoji = '👻';
        Icon = AlertTriangle;
        suggestion = 'Check the URL or navigate back home.';
        accentColor = 'text-purple-400';
        bgGradient = 'from-purple-600/20 via-indigo-600/15 to-blue-600/10';
        break;
      case 401:
        title = 'Not Authenticated';
        message = 'You need to be logged in to access this page.';
        emoji = '🔐';
        Icon = ShieldX;
        suggestion = 'Please log in to continue.';
        accentColor = 'text-amber-400';
        bgGradient = 'from-amber-600/20 via-orange-600/15 to-red-600/10';
        break;
      case 403:
        title = 'Access Denied';
        message = 'You don\'t have permission to view this page.';
        emoji = '🚫';
        Icon = ShieldX;
        suggestion = 'Contact support if you believe this is an error.';
        accentColor = 'text-orange-400';
        bgGradient = 'from-orange-600/20 via-red-600/15 to-pink-600/10';
        break;
      case 500:
      case 502:
      case 503:
        title = 'Server Error';
        message = 'Our servers are having a moment. We\'re working on it!';
        emoji = '🔧';
        Icon = ServerCrash;
        suggestion = 'Try again in a few minutes.';
        accentColor = 'text-red-400';
        bgGradient = 'from-red-600/20 via-rose-600/15 to-pink-600/10';
        break;
      default:
        message = error.statusText || error.data || 'An error occurred.';
    }
  } else if (error instanceof Error) {
    // Network or runtime errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      title = 'Connection Lost';
      message = 'Unable to connect to the server. Check your internet connection.';
      emoji = '📡';
      Icon = WifiOff;
      suggestion = 'Check your internet and try again.';
      accentColor = 'text-blue-400';
      bgGradient = 'from-blue-600/20 via-cyan-600/15 to-teal-600/10';
    } else {
      message = error.message;
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <motion.div
          className={`absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-r ${bgGradient} blur-3xl`}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-lg mx-auto">
        {/* Error Icon/Emoji */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', bounce: 0.4 }}
        >
          <motion.span
            className="text-8xl inline-block"
            animate={{
              y: [0, -10, 0],
              rotate: [0, 3, -3, 0],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {emoji}
          </motion.span>
        </motion.div>

        {/* Status code badge */}
        <motion.div
          className={`inline-flex items-center gap-2 ${accentColor} bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-6`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Icon className="w-4 h-4" />
          <span className="font-mono font-bold">{status}</span>
        </motion.div>

        {/* Title & Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {title}
          </h1>
          <p className="text-gray-400 mb-3 text-lg">
            {message}
          </p>
          <p className="text-gray-500 mb-8 text-sm">
            💡 {suggestion}
          </p>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <button
            onClick={() => window.location.reload()}
            className={`flex items-center gap-2 px-6 py-3 rounded-full bg-white text-gray-900 font-medium hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5`}
          >
            <RefreshCcw className="w-5 h-5" />
            Try Again
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-all"
          >
            <Home className="w-5 h-5" />
            Go Home
          </button>
        </motion.div>

        {/* Technical details (collapsed) */}
        {process.env.NODE_ENV === 'development' && error instanceof Error && (
          <motion.details
            className="mt-8 text-left bg-white/5 border border-white/10 rounded-xl p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <summary className="text-gray-400 text-sm cursor-pointer hover:text-white transition-colors">
              🔍 Technical Details (Dev Mode)
            </summary>
            <pre className="mt-3 text-xs text-red-400 bg-black/50 rounded-lg p-3 overflow-x-auto">
              {error.stack || error.message}
            </pre>
          </motion.details>
        )}
      </div>
    </div>
  );
};

export default ErrorPage;
