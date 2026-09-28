import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface SectionTitleProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  linkText?: string;
  linkHref?: string;
  className?: string;
  action?: React.ReactNode;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  subtitle,
  icon: Icon,
  linkText,
  linkHref,
  className = '',
  action
}) => {
  return (
    <div className={`flex items-end justify-between mb-4 ${className}`}>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {action}
        {linkHref && linkText && (
          <Link
            to={linkHref}
            className="text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors"
          >
            {linkText} &rarr;
          </Link>
        )}
      </div>
    </div>
  );
};

export default SectionTitle;
