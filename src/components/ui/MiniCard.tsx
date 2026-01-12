import { ReactNode } from 'react';

interface MiniCardProps {
  title: string;
  children: ReactNode;
  badges?: string[];
  cta?: {
    text: string;
    href: string;
    variant?: 'primary' | 'secondary';
  }[];
}

export default function MiniCard({ title, children, badges, cta }: MiniCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg">
      <h3 className="mb-1.5 text-lg font-bold">{title}</h3>
      <p className="mb-4 text-sm text-gray-600">{children}</p>
      
      {badges && badges.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {badges.map((badge, index) => (
            <span 
              key={index}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
      
      {cta && cta.length > 0 && (
        <div className="mt-4 flex gap-3">
          {cta.map((button, index) => (
            <a
              key={index}
              href={button.href}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                button.variant === 'primary'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:opacity-90'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {button.text}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
