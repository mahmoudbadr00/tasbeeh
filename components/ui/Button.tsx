// // src/components/ui/Button.tsx
// import React from 'react';
// import { ButtonProps } from '@/interfaces/types';

// const Button: React.FC<ButtonProps> = ({
//   onClick,
//   disabled = false,
//   children,
//   variant = 'primary',
//   className = ''
// }) => {
//   const baseClasses =
//     'px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2';
//   const variants = {
//     primary: 'bg-blue-600 text-white hover:bg-blue-700',
//     secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
//     danger: 'bg-red-600 text-white hover:bg-red-700',
//     ghost: 'bg-transparent text-gray-700 hover:bg-gray-100'
//   };

//   return (
//     <button
//       onClick={onClick}
//       disabled={disabled}
//       className={`${baseClasses} ${variants[variant]} ${className}`}
//     >
//       {children}
//     </button>
//   );
// };

// export default Button;


import { ButtonProps } from '@/interfaces/types';
import React from 'react';


const Button: React.FC<ButtonProps> = ({ onClick, disabled, variant = 'primary', children, className = '' }) => {
  const baseClasses = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variantClasses = variant === 'primary' 
    ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg"
    : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm hover:shadow";
  
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${variantClasses} ${className}`}>
      {children}
    </button>
  );
};

export default Button;