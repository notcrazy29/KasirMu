import React, { HTMLAttributes } from 'react';

export const Card = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={`p-5 border-b border-slate-100 dark:border-slate-800/60 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardTitle = ({ className = '', children, ...props }: HTMLAttributes<HTMLHeadingElement>) => {
  return (
    <h3 className={`text-base font-bold text-slate-900 dark:text-white leading-none ${className}`} {...props}>
      {children}
    </h3>
  );
};

export const CardDescription = ({ className = '', children, ...props }: HTMLAttributes<HTMLParagraphElement>) => {
  return (
    <p className={`text-xs text-slate-500 dark:text-slate-400 mt-1.5 ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={`p-5 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/60 ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card;

