interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
  icon?: React.ReactNode;
  active?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'sm', 
  onClick, 
  className = '',
  icon,
  active = false
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-full border';
  
  const variants = {
    primary: active 
      ? 'bg-[#000000] text-white border-[#000000] shadow-sm' 
      : 'bg-[#000000] text-white border-[#000000] hover:bg-[#000000] shadow-sm',
    secondary: active
      ? 'bg-purple-100 text-purple-900 border-gray-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-white/10'
      : 'bg-purple-50 text-purple-700 border-gray-200 hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:border-white/10',
    outline: active
      ? 'bg-purple-50 text-purple-700 border-gray-300 dark:bg-purple-500/10 dark:text-purple-300 dark:border-white/20'
      : 'bg-transparent text-purple-600 border-gray-300 hover:bg-purple-50 dark:border-white/20',
    ghost: active
      ? 'bg-purple-100 text-purple-800 border-transparent dark:bg-purple-500/20 dark:text-purple-300'
      : 'bg-transparent text-purple-600 border-transparent hover:bg-purple-50'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2'
  };
  
  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;
  
  return (
    <button onClick={onClick} className={classes}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
