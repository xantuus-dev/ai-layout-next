'use client';

/**
 * Personalization Modal
 *
 * Allows users to customize their profile with:
 * - Nickname (50 char limit)
 * - Occupation (100 char limit)
 * - Bio/About (2000 char limit)
 * - Custom Instructions for AI (3000 char limit)
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface PersonalizationModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormData {
  nickname: string;
  occupation: string;
  bio: string;
  customInstructions: string;
}

const CHARACTER_LIMITS = {
  nickname: 50,
  occupation: 100,
  bio: 2000,
  customInstructions: 3000,
};

/**
 * Character counter component with color-coded warnings
 */
function CharacterCounter({
  current,
  max,
  className = '',
}: {
  current: number;
  max: number;
  className?: string;
}) {
  const percentage = (current / max) * 100;
  const color =
    percentage > 90
      ? 'text-red-500'
      : percentage > 75
      ? 'text-yellow-500'
      : 'text-slate-400';

  return (
    <span className={`text-xs ${color} ${className}`}>
      {current} / {max}
    </span>
  );
}

export function PersonalizationModal({ open, onClose }: PersonalizationModalProps) {
  const [formData, setFormData] = useState<FormData>({
    nickname: '',
    occupation: '',
    bio: '',
    customInstructions: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current personalization data when modal opens
  useEffect(() => {
    if (open) {
      fetchPersonalizationData();
    } else {
      // Reset success/error states when modal closes
      setSuccess(false);
      setError(null);
    }
  }, [open]);

  const fetchPersonalizationData = async () => {
    setFetching(true);
    setError(null);

    try {
      const response = await fetch('/api/user/personalization');
      const result = await response.json();

      if (response.ok && result.success) {
        setFormData(result.data);
      } else {
        setError(result.error || 'Failed to load personalization data');
      }
    } catch (err: any) {
      setError('Failed to load personalization data');
      console.error('Fetch personalization error:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    // Enforce character limits on input
    const limit = CHARACTER_LIMITS[field];
    if (value.length <= limit) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/user/personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccess(true);
        // Auto-close after 1.5 seconds
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(result.error || 'Failed to save personalization');
      }
    } catch (err: any) {
      setError('Failed to save personalization');
      console.error('Save personalization error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle>Personalization</DialogTitle>
          <DialogDescription className="text-slate-400">
            Customize your profile and AI interaction preferences
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nickname */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="nickname" className="text-sm font-medium">
                  Nickname
                </Label>
                <CharacterCounter
                  current={formData.nickname.length}
                  max={CHARACTER_LIMITS.nickname}
                />
              </div>
              <Input
                id="nickname"
                value={formData.nickname}
                onChange={(e) => handleChange('nickname', e.target.value)}
                placeholder="Your preferred display name"
                className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                maxLength={CHARACTER_LIMITS.nickname}
              />
              <p className="text-xs text-slate-500">
                How you'd like to be addressed
              </p>
            </div>

            {/* Occupation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="occupation" className="text-sm font-medium">
                  Occupation
                </Label>
                <CharacterCounter
                  current={formData.occupation.length}
                  max={CHARACTER_LIMITS.occupation}
                />
              </div>
              <Input
                id="occupation"
                value={formData.occupation}
                onChange={(e) => handleChange('occupation', e.target.value)}
                placeholder="Your job title or role"
                className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                maxLength={CHARACTER_LIMITS.occupation}
              />
              <p className="text-xs text-slate-500">
                What you do professionally
              </p>
            </div>

            {/* Bio/About */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bio" className="text-sm font-medium">
                  Bio / About
                </Label>
                <CharacterCounter
                  current={formData.bio.length}
                  max={CHARACTER_LIMITS.bio}
                />
              </div>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                placeholder="Tell us about yourself, your interests, background..."
                className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 min-h-[100px] resize-y"
                maxLength={CHARACTER_LIMITS.bio}
              />
              <p className="text-xs text-slate-500">
                A brief description about yourself (~400 words)
              </p>
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="customInstructions" className="text-sm font-medium">
                  Custom Instructions for AI
                </Label>
                <CharacterCounter
                  current={formData.customInstructions.length}
                  max={CHARACTER_LIMITS.customInstructions}
                />
              </div>
              <Textarea
                id="customInstructions"
                value={formData.customInstructions}
                onChange={(e) => handleChange('customInstructions', e.target.value)}
                placeholder="How would you like the AI to respond? E.g., 'Be concise', 'Explain like I'm a beginner', 'Use technical jargon'..."
                className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 min-h-[120px] resize-y"
                maxLength={CHARACTER_LIMITS.customInstructions}
              />
              <p className="text-xs text-slate-500">
                Preferences for how AI should interact with you (~600 words)
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <p className="text-sm text-green-400">Saved successfully!</p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="border-slate-600 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
