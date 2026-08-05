'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, X } from 'lucide-react';

export default function PaymentFailedBanner() {
  const { data: session } = useSession();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (!session?.user?.paymentFailed || dismissed) {
    return null;
  }

  return (
    <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-3 relative z-30">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>
          Your last payment failed. Update your payment method to avoid losing access.
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => router.push('/settings/billing')}
          className="px-3 py-1 bg-white text-red-600 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
        >
          Update payment method
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="p-1 hover:bg-red-700 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
