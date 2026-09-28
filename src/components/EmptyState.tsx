import React from 'react';
import { Link } from 'react-router-dom';

interface Props {
  icon?: string | React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

export default function EmptyState({ icon = '📭', title, description, actionLabel, actionHref }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-6xl mb-4 select-none">
        {typeof icon === 'string' ? icon : icon}
      </div>
      <h3 className="text-white text-xl font-semibold mb-2">{title}</h3>
      {description && <p className="text-gray-400 text-sm max-w-md mb-6">{description}</p>}
      {actionLabel && actionHref && (
        actionHref.startsWith('http') ? (
          <a
            href={actionHref}
            className="bg-amber-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition shadow-lg cursor-pointer"
          >
            {actionLabel}
          </a>
        ) : (
          <Link
            to={actionHref}
            className="bg-amber-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition shadow-lg cursor-pointer inline-block"
          >
            {actionLabel}
          </Link>
        )
      )}
    </div>
  );
}
