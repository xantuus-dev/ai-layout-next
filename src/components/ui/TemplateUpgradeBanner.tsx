'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles, Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface TemplateUpgradeBannerProps {
  templateTitle: string;
  templateTier: 'pro' | 'enterprise';
  userTier: 'free' | 'pro' | 'enterprise';
  onClose: () => void;
  missingIntegrations?: string[];
}

export function TemplateUpgradeBanner({
  templateTitle,
  templateTier,
  userTier,
  onClose,
  missingIntegrations,
}: TemplateUpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check if user has dismissed this banner before (localStorage)
  useEffect(() => {
    const dismissedBanners = localStorage.getItem('dismissedTemplateBanners');
    if (dismissedBanners) {
      const dismissed = JSON.parse(dismissedBanners);
      if (dismissed.includes(`${templateTitle}-${templateTier}`)) {
        setDismissed(true);
      }
    }
  }, [templateTitle, templateTier]);

  const handleDismiss = () => {
    const dismissedBanners = localStorage.getItem('dismissedTemplateBanners');
    const dismissed = dismissedBanners ? JSON.parse(dismissedBanners) : [];
    dismissed.push(`${templateTitle}-${templateTier}`);
    localStorage.setItem('dismissedTemplateBanners', JSON.stringify(dismissed));
    setDismissed(true);
    onClose();
  };

  if (dismissed) {
    return null;
  }

  const tierInfo = {
    pro: {
      name: 'Pro',
      price: '$29',
      color: 'blue',
      benefits: [
        'Access to 20+ Pro templates',
        '12,000 credits per month',
        'Gmail & Drive integration',
        'Priority support',
      ],
    },
    enterprise: {
      name: 'Enterprise',
      price: '$199',
      color: 'purple',
      benefits: [
        'All Pro features',
        'Access to Enterprise templates',
        '40,000 credits per month',
        'Google Calendar integration',
        'Advanced automation',
        'Dedicated support',
      ],
    },
  };

  const info = tierInfo[templateTier];
  const colorClasses = {
    blue: {
      badge: 'bg-blue-500',
      button: 'bg-blue-500 hover:bg-blue-600',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'text-blue-500',
    },
    purple: {
      badge: 'bg-purple-500',
      button: 'bg-purple-500 hover:bg-purple-600',
      border: 'border-purple-200 dark:border-purple-800',
      icon: 'text-purple-500',
    },
  };

  const colors = colorClasses[info.color as keyof typeof colorClasses];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className={`max-w-2xl w-full border-2 ${colors.border}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className={`w-5 h-5 ${colors.icon}`} />
                <Badge className={`${colors.badge} text-white`}>
                  {info.name} Template
                </Badge>
              </div>
              <CardTitle className="text-2xl mb-2">
                Upgrade to access "{templateTitle}"
              </CardTitle>
              <CardDescription>
                This is a premium {info.name} template. Upgrade your plan to unlock this and many other advanced templates.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="ml-4"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Integration Requirements */}
          {missingIntegrations && missingIntegrations.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-900 dark:text-amber-200 font-medium mb-2">
                This template also requires:
              </p>
              <div className="flex flex-wrap gap-2">
                {missingIntegrations.map((integration) => (
                  <Badge key={integration} variant="secondary" className="text-xs">
                    {integration}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                Google integrations are included with {info.name} plan
              </p>
            </div>
          )}

          {/* Benefits List */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
              {info.name} Plan includes:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {info.benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className={`w-4 h-4 mt-0.5 ${colors.icon} flex-shrink-0`} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {benefit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Starting at
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {info.price}
                <span className="text-base font-normal text-gray-500">/month</span>
              </p>
            </div>
            <Link href="/pricing">
              <Button className={colors.button}>
                Upgrade Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-gray-500"
            >
              Don't show again
            </Button>
            <Link href="/pricing" className="text-sm text-blue-500 hover:text-blue-600 font-medium">
              Compare all plans →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
