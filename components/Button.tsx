
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseClasses = 'font-display text-2xl px-8 py-3 rounded-full shadow-lg transform transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-opacity-50';
  
  const variantClasses = {
    primary: 'bg-orange-500 hover:bg-orange-600 text-white focus:ring-orange-400 active:scale-95',
    secondary: 'bg-cyan-400 hover:bg-cyan-500 text-white focus:ring-cyan-300 active:scale-95',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
