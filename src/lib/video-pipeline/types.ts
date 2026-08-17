import type { VeoAspectRatio, VeoDurationSeconds } from '@/lib/video-generation';

export type VideoProjectStatus =
  | 'queued'
  | 'scripting'
  | 'generating'
  | 'stitching'
  | 'completed'
  | 'failed';

export type SceneStatus = 'pending' | 'generating' | 'done' | 'failed';

export interface SceneSpec {
  order: number;
  veoPrompt: string;
  voiceoverText: string;
  durationSeconds: VeoDurationSeconds;
  status: SceneStatus;
  clipUrl?: string;
  audioUrl?: string;
}

export interface BreakdownConceptInput {
  concept: string;
  targetDurationSeconds: number;
  aspectRatio: VeoAspectRatio;
  tone?: string;
}

export interface VideoPipelineJob {
  projectId: string;
  userId: string;
}
