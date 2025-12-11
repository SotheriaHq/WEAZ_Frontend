import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FrostedButton } from '@/components/ui/FrostedButton';
import { Home, Search, ArrowLeft, MapPin } from 'lucide-react';

/**
 * NotFound - Premium 404 page with engaging design
 * 
 * Shows when users navigate to a non-existent route.
 * Features animated elements and helpful navigation options.
 */
const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {/* Lost in space gradient */}
        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-blue-600/10 via-purple-600/15 to-pink-600/10 blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Subtle stars */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-lg mx-auto">
        {/* Animated 404 */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="relative inline-block">
            {/* Ghost emoji floating */}
            <motion.span
              className="absolute -top-16 left-1/2 -translate-x-1/2 text-6xl"
              animate={{
                y: [0, -15, 0],
                rotate: [0, 5, -5, 0],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              👻
            </motion.span>
            
            {/* 404 Number */}
            <h1 className="text-[150px] md:text-[200px] font-black text-transparent bg-clip-text bg-gradient-to-b from-white/80 to-white/20 leading-none select-none">
              404
            </h1>
            
            {/* Glitch effect line */}
            <motion.div
              className="absolute inset-0 overflow-hidden"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 3 }}
            >
              <div className="absolute top-1/2 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            </motion.div>
          </div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Page Not Found
          </h2>
          <p className="text-gray-400 mb-2 text-lg">
            Looks like you've wandered into uncharted territory! 🗺️
          </p>
          <p className="text-gray-500 mb-8 text-sm">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </motion.div>

        {/* Helpful info card */}
        <motion.div
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-left">
              <h3 className="text-white font-medium">Lost? Here's what you can do:</h3>
            </div>
          </div>
          <ul className="text-left text-gray-400 text-sm space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              Check if the URL is spelled correctly
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              Go back to the homepage
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              Use the search to find what you need
            </li>
          </ul>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-gray-900 font-medium hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Home className="w-5 h-5" />
            Go Home
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </motion.div>

        {/* Fun footer */}
        <motion.p
          className="mt-12 text-gray-600 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Error Code: 404 • Maybe it's on vacation? 🏖️
        </motion.p>
      </div>
    </div>
  );
};

export default NotFound;
