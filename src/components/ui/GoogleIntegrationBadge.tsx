'use client';

import { Badge } from '@/components/ui/badge';
import { Mail, HardDrive, Calendar } from 'lucide-react';

interface GoogleIntegrationBadgeProps {
  service: 'drive' | 'gmail' | 'calendar';
  size?: 'sm' | 'md' | 'lg';
}

const serviceConfig = {
  drive: {
    icon: HardDrive,
    label: 'Drive',
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  gmail: {
    icon: Mail,
    label: 'Gmail',
    color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
  calendar: {
    icon: Calendar,
    label: 'Calendar',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
};

export function GoogleIntegrationBadge({ service, size = 'sm' }: GoogleIntegrationBadgeProps) {
  const config = serviceConfig[service];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <Badge
      variant="secondary"
      className={`${config.color} ${sizeClasses[size]} flex items-center gap-1.5 font-medium`}
    >
      <Icon className={iconSizes[size]} />
      {config.label}
    </Badge>
  );
}
