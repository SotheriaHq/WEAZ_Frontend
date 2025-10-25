
import React from 'react';


export type TagVariant = 'primary' | 'secondary' | 'dark' | 'outline';

interface TagProps {
  label: string;
  color?: 'purple' | 'blue' | 'gray';
  className?: string;
  variant?: TagVariant; 
}

const getVariantClasses = (variant: TagVariant): string => {
    switch (variant) {
        case 'primary':
            return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
        case 'secondary':
            return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        case 'dark':
            return 'bg-black text-white dark:bg-gray-100 dark:text-black';
        case 'outline':
            return 'border border-gray-400 text-gray-700 dark:border-gray-500 dark:text-gray-300 bg-transparent';
        default:
            return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    }
}


// 2. Adjust component to accept a default variant and merge with existing color logic (if needed)
const Tag: React.FC<TagProps> = ({ label, color = 'purple', className = '', variant }) => {
  // Fallback to color logic if variant is not provided
  const colorClasses = {
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };

  // Prioritize the 'variant' prop for styling if it exists, otherwise use 'color'
  const selectedClasses = variant ? getVariantClasses(variant) : colorClasses[color];

  const classes = `inline-block px-2.5 py-0.5 rounded-full text-sm font-medium ${selectedClasses} ${className}`;

  return (
    <span className={classes}>
      #{label}
    </span>
  );
};

export default Tag;
