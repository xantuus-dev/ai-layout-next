'use client';

/**
 * Personalization Section
 *
 * Section component for personalization settings
 * Reuses logic from PersonalizationModal
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

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
      ? 'text-red-400'
      : percentage > 75
      ? 'text-yellow-400'
      : 'text-gray-500';

  return (
    <span className={`text-xs ${color} ${className}`}>
      {current} / {max}
    </span>
  );
}

export function PersonalizationSection() {
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

  useEffect(() => {
    fetchPersonalizationData();
  }, []);

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
    const limit = CHARACTER_LIMITS[field];
    if (value.length <= limit) {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear success message when user starts editing
      if (success) setSuccess(false);
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
        // Auto-hide success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
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

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">Personalization</h2>
        <p className="text-sm text-gray-400">
          Customize your profile and AI interaction preferences
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nickname */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="nickname" className="text-sm font-medium text-gray-200">
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
            className="bg-[#252525] border-gray-700 text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:ring-blue-500"
            maxLength={CHARACTER_LIMITS.nickname}
          />
          <p className="text-xs text-gray-500">
            How you'd like to be addressed
          </p>
        </div>

        {/* Occupation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="occupation" className="text-sm font-medium text-gray-200">
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
            className="bg-[#252525] border-gray-700 text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:ring-blue-500"
            maxLength={CHARACTER_LIMITS.occupation}
          />
          <p className="text-xs text-gray-500">
            What you do professionally
          </p>
        </div>

        {/* Bio/About */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="bio" className="text-sm font-medium text-gray-200">
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
            className="bg-[#252525] border-gray-700 text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:ring-blue-500 min-h-[120px] resize-y"
            maxLength={CHARACTER_LIMITS.bio}
          />
          <p className="text-xs text-gray-500">
            A brief description about yourself (~400 words)
          </p>
        </div>

        {/* Custom Instructions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="customInstructions" className="text-sm font-medium text-gray-200">
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
            className="bg-[#252525] border-gray-700 text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:ring-blue-500 min-h-[140px] resize-y"
            maxLength={CHARACTER_LIMITS.customInstructions}
          />
          <p className="text-xs text-gray-500">
            Preferences for how AI should interact with you (~600 words)
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <p className="text-sm text-green-400">Saved successfully!</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
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
        </div>
      </form>
    </div>
  );
}
