# 🎬 YouTube Channel Analyzer - Implementation Plan (Hybrid Approach)

**Timeline:** 2-3 weeks
**Approach:** Hybrid integration with ai-layout-next platform
**Goal:** Automated YouTube channel analysis with scheduled execution

---

## 📋 Executive Summary

This plan details how to add YouTube channel analysis capabilities to ai-layout-next using a hybrid approach that:

1. **Leverages existing infrastructure** (database, auth, credit system)
2. **Adds YouTube API integration** as a new tool
3. **Implements basic scheduling** with Bull queue
4. **Delivers MVP quickly** (2-3 weeks vs 4-6 weeks full integration)
5. **Enables immediate customer sales** with core features

**Core Value Proposition:**
Replace manual student work analyzing YouTube channels with automated, scheduled analysis that runs daily/weekly and exports to spreadsheets.

---

## 🗄️ Database Schema Design

### New Models to Add to `prisma/schema.prisma`

```prisma
// YouTube Channel Analysis Models

model YouTubeChannel {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // YouTube Channel Info
  channelId         String   // YouTube's channel ID
  channelHandle     String?  // @username
  channelUrl        String   // Full URL
  title             String
  description       String?  @db.Text
  customUrl         String?
  thumbnailUrl      String?

  // Statistics (latest snapshot)
  subscriberCount   Int      @default(0)
  videoCount        Int      @default(0)
  totalViews        BigInt   @default(0)
  averageViews      Float    @default(0)

  // Metadata
  category          String?
  country           String?
  publishedAt       DateTime?

  // Tracking
  lastAnalyzed      DateTime?
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  videos            YouTubeVideo[]
  analysisjobs      YouTubeAnalysisJob[]
  snapshots         ChannelSnapshot[]

  @@unique([userId, channelId])
  @@index([userId])
  @@index([channelId])
  @@index([lastAnalyzed])
}

model YouTubeVideo {
  id                String   @id @default(cuid())
  channelId         String
  channel           YouTubeChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  // YouTube Video Info
  videoId           String   // YouTube's video ID
  videoUrl          String
  title             String
  description       String?  @db.Text
  thumbnailUrl      String?

  // Statistics
  viewCount         Int      @default(0)
  likeCount         Int      @default(0)
  commentCount      Int      @default(0)

  // Metadata
  duration          Int?     // In seconds
  tags              String[] // Array of tags
  categoryId        String?

  // Publishing
  publishedAt       DateTime
  capturedAt        DateTime @default(now()) // When we fetched this data

  // Relations
  snapshots         VideoSnapshot[]

  @@unique([channelId, videoId])
  @@index([channelId])
  @@index([videoId])
  @@index([publishedAt])
}

model YouTubeAnalysisJob {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Job Configuration
  name              String   // User-friendly name
  description       String?  @db.Text

  // Channels to analyze
  channelIds        String[] // Array of YouTube channel IDs or URLs

  // Filters
  dateRangeStart    DateTime?
  dateRangeEnd      DateTime?
  categories        String[] // Filter by video categories
  minViews          Int?
  maxViews          Int?

  // Scheduling
  schedule          String?  // Cron expression (e.g., "0 2 * * *" = 2 AM daily)
  isRecurring       Boolean  @default(false)
  nextRunAt         DateTime?

  // Status
  status            String   @default("pending") // pending, running, completed, failed
  lastRunAt         DateTime?
  lastRunStatus     String?

  // Results Summary
  channelsAnalyzed  Int      @default(0)
  videosAnalyzed    Int      @default(0)
  totalCreditsUsed  Int      @default(0)

  // Metadata
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  channels          YouTubeChannel[]
  executions        AnalysisJobExecution[]

  @@index([userId])
  @@index([status])
  @@index([nextRunAt])
}

model AnalysisJobExecution {
  id                String   @id @default(cuid())
  jobId             String
  job               YouTubeAnalysisJob @relation(fields: [jobId], references: [id], onDelete: Cascade)

  // Execution Details
  status            String   // running, completed, failed, cancelled
  startedAt         DateTime @default(now())
  completedAt       DateTime?

  // Results
  channelsProcessed Int      @default(0)
  videosProcessed   Int      @default(0)
  creditsUsed       Int      @default(0)

  // Output
  resultData        Json?    // Aggregated results
  errorMessage      String?  @db.Text

  // Metadata
  triggeredBy       String   @default("scheduled") // scheduled, manual, api

  @@index([jobId])
  @@index([startedAt])
}

// Historical snapshots for trend tracking
model ChannelSnapshot {
  id                String   @id @default(cuid())
  channelId         String
  channel           YouTubeChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  subscriberCount   Int
  videoCount        Int
  totalViews        BigInt
  averageViews      Float

  capturedAt        DateTime @default(now())

  @@index([channelId, capturedAt])
}

model VideoSnapshot {
  id                String   @id @default(cuid())
  videoId           String
  video             YouTubeVideo @relation(fields: [videoId], references: [id], onDelete: Cascade)

  viewCount         Int
  likeCount         Int
  commentCount      Int

  capturedAt        DateTime @default(now())

  @@index([videoId, capturedAt])
}

// YouTube API Credentials (add to User model)
model User {
  // ... existing fields ...

  // YouTube Integration
  youtubeAccessToken       String?  @db.Text
  youtubeRefreshToken      String?  @db.Text
  youtubeTokenExpiry       DateTime?
  youtubeApiQuotaUsed      Int      @default(0)
  youtubeApiQuotaResetAt   DateTime?

  // Relations
  youtubeChannels          YouTubeChannel[]
  youtubeAnalysisJobs      YouTubeAnalysisJob[]
}
```

### Migration Command
```bash
npx prisma migrate dev --name add_youtube_analysis
npx prisma generate
```

---

## 🔌 API Endpoints Specification

### 1. YouTube OAuth & Setup

#### `POST /api/integrations/youtube/connect`
**Purpose:** Initiate YouTube OAuth flow

**Request:**
```typescript
// No body needed
```

**Response:**
```typescript
{
  authUrl: string; // Redirect user to this URL
}
```

**Implementation:**
```typescript
// src/app/api/integrations/youtube/connect/route.ts
import { google } from 'googleapis';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/youtube/callback`
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtubepartner'
    ],
    state: session.user.id, // For CSRF protection
  });

  return Response.json({ authUrl });
}
```

---

#### `GET /api/integrations/youtube/callback`
**Purpose:** Handle OAuth callback and store tokens

**Query Params:**
- `code` - Authorization code
- `state` - User ID for CSRF validation

**Implementation:**
```typescript
// src/app/api/integrations/youtube/callback/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // userId

  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);

  // Store in database
  await prisma.user.update({
    where: { id: state },
    data: {
      youtubeAccessToken: tokens.access_token,
      youtubeRefreshToken: tokens.refresh_token,
      youtubeTokenExpiry: new Date(tokens.expiry_date),
    },
  });

  return Response.redirect('/settings/integrations?youtube=connected');
}
```

---

### 2. Channel Management

#### `POST /api/youtube/channels/add`
**Purpose:** Add YouTube channel(s) to track

**Request:**
```typescript
{
  channels: string[]; // Array of channel URLs or IDs
}
```

**Response:**
```typescript
{
  added: number;
  failed: number;
  channels: Array<{
    id: string;
    title: string;
    channelId: string;
    subscriberCount: number;
  }>;
}
```

**Implementation:**
```typescript
// src/app/api/youtube/channels/add/route.ts
import { getYouTubeClient } from '@/lib/youtube-client';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const { channels } = await req.json();

  const youtube = await getYouTubeClient(session.user.id);
  const addedChannels = [];

  for (const channelUrl of channels) {
    const channelId = extractChannelId(channelUrl);

    // Fetch channel data from YouTube API
    const response = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      id: [channelId],
    });

    const channelData = response.data.items[0];

    // Store in database
    const channel = await prisma.youTubeChannel.create({
      data: {
        userId: session.user.id,
        channelId: channelData.id,
        title: channelData.snippet.title,
        description: channelData.snippet.description,
        subscriberCount: parseInt(channelData.statistics.subscriberCount),
        videoCount: parseInt(channelData.statistics.videoCount),
        totalViews: BigInt(channelData.statistics.viewCount),
        thumbnailUrl: channelData.snippet.thumbnails.default.url,
        publishedAt: new Date(channelData.snippet.publishedAt),
      },
    });

    addedChannels.push(channel);
  }

  return Response.json({
    added: addedChannels.length,
    failed: 0,
    channels: addedChannels,
  });
}
```

---

#### `GET /api/youtube/channels`
**Purpose:** List user's tracked channels

**Query Params:**
- `page` (optional) - Page number
- `limit` (optional) - Results per page

**Response:**
```typescript
{
  channels: Array<{
    id: string;
    title: string;
    subscriberCount: number;
    videoCount: number;
    averageViews: number;
    lastAnalyzed: string | null;
  }>;
  total: number;
  page: number;
}
```

---

#### `DELETE /api/youtube/channels/[id]`
**Purpose:** Remove channel from tracking

---

### 3. Analysis Jobs

#### `POST /api/youtube/analysis/create`
**Purpose:** Create new analysis job

**Request:**
```typescript
{
  name: string;
  description?: string;
  channelIds: string[];
  filters?: {
    dateRangeStart?: string;
    dateRangeEnd?: string;
    categories?: string[];
    minViews?: number;
    maxViews?: number;
  };
  schedule?: {
    isRecurring: boolean;
    cronExpression?: string; // e.g., "0 2 * * *"
  };
}
```

**Response:**
```typescript
{
  jobId: string;
  status: string;
  estimatedCredits: number;
  nextRunAt: string | null;
}
```

**Credit Estimation:**
```typescript
function estimateCredits(channelCount: number, filters: any) {
  const baseCreditsPerChannel = 50; // Base cost
  const videoFetchCost = 10; // Per video batch
  const aggregationCost = 20; // Data processing

  // Estimate videos per channel based on filters
  const estimatedVideosPerChannel = filters?.dateRangeStart
    ? 50  // Recent videos
    : 200; // All videos

  const totalCost =
    (channelCount * baseCreditsPerChannel) +
    (channelCount * Math.ceil(estimatedVideosPerChannel / 50) * videoFetchCost) +
    aggregationCost;

  return totalCost;
}
```

---

#### `POST /api/youtube/analysis/[id]/run`
**Purpose:** Execute analysis job immediately

**Response:**
```typescript
{
  executionId: string;
  status: string;
  creditsReserved: number;
}
```

**Implementation:**
```typescript
// src/app/api/youtube/analysis/[id]/run/route.ts
import { analyzeChannelsJob } from '@/lib/queue/youtube-jobs';

export async function POST(req: Request, { params }) {
  const session = await getServerSession(authOptions);
  const job = await prisma.youTubeAnalysisJob.findUnique({
    where: { id: params.id },
    include: { channels: true },
  });

  // Check user has enough credits
  const estimatedCredits = estimateCredits(job.channels.length, job);
  if (session.user.credits < estimatedCredits) {
    return Response.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  // Create execution record
  const execution = await prisma.analysisJobExecution.create({
    data: {
      jobId: job.id,
      status: 'running',
      triggeredBy: 'manual',
    },
  });

  // Add to queue
  await analyzeChannelsJob.add({
    executionId: execution.id,
    jobId: job.id,
    userId: session.user.id,
  });

  // Reserve credits
  await prisma.user.update({
    where: { id: session.user.id },
    data: { credits: { decrement: estimatedCredits } },
  });

  return Response.json({
    executionId: execution.id,
    status: 'running',
    creditsReserved: estimatedCredits,
  });
}
```

---

#### `GET /api/youtube/analysis/[id]/results`
**Purpose:** Get analysis results

**Response:**
```typescript
{
  job: {
    id: string;
    name: string;
    status: string;
    channelsAnalyzed: number;
    videosAnalyzed: number;
  };
  results: {
    summary: {
      totalChannels: number;
      totalVideos: number;
      averageViews: number;
      medianViews: number;
      totalViews: number;
    };
    byChannel: Array<{
      channelTitle: string;
      videoCount: number;
      averageViews: number;
      totalViews: number;
      topVideos: Array<{
        title: string;
        views: number;
        publishedAt: string;
      }>;
    }>;
    byCategory: Record<string, {
      videoCount: number;
      averageViews: number;
    }>;
    byDateRange: Array<{
      month: string;
      videoCount: number;
      averageViews: number;
    }>;
  };
}
```

---

#### `GET /api/youtube/analysis/[id]/export`
**Purpose:** Export results to CSV

**Query Params:**
- `format` - `csv` | `json` | `xlsx`

**Response:**
- File download with analysis results

**Implementation:**
```typescript
// src/app/api/youtube/analysis/[id]/export/route.ts
import { stringify } from 'csv-stringify/sync';

export async function GET(req: Request, { params }) {
  const execution = await prisma.analysisJobExecution.findUnique({
    where: { id: params.id },
    include: {
      job: {
        include: {
          channels: {
            include: {
              videos: true,
            },
          },
        },
      },
    },
  });

  // Flatten data for CSV
  const rows = execution.job.channels.flatMap(channel =>
    channel.videos.map(video => ({
      'Channel Title': channel.title,
      'Channel Subscribers': channel.subscriberCount,
      'Video Title': video.title,
      'Video Views': video.viewCount,
      'Video Likes': video.likeCount,
      'Published Date': video.publishedAt.toISOString().split('T')[0],
    }))
  );

  const csv = stringify(rows, { header: true });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="youtube-analysis-${params.id}.csv"`,
    },
  });
}
```

---

### 4. Scheduled Jobs Management

#### `GET /api/youtube/jobs`
**Purpose:** List all analysis jobs

---

#### `PATCH /api/youtube/jobs/[id]`
**Purpose:** Update job configuration (schedule, filters, etc.)

---

#### `DELETE /api/youtube/jobs/[id]`
**Purpose:** Delete job and cancel schedule

---

## 🛠️ Step-by-Step Implementation

### Week 1: Foundation & YouTube API

#### Day 1-2: YouTube API Client

**File:** `src/lib/youtube-client.ts`

```typescript
import { google, youtube_v3 } from 'googleapis';
import { prisma } from '@/lib/prisma';

export class YouTubeClient {
  private youtube: youtube_v3.Youtube;
  private userId: string;

  constructor(accessToken: string, refreshToken: string, userId: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Auto-refresh tokens
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            youtubeAccessToken: tokens.access_token,
            youtubeTokenExpiry: new Date(tokens.expiry_date!),
          },
        });
      }
    });

    this.youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    this.userId = userId;
  }

  /**
   * Fetch channel details
   */
  async getChannel(channelId: string) {
    const response = await this.youtube.channels.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: [channelId],
    });

    await this.trackQuota(1); // 1 unit

    return response.data.items?.[0];
  }

  /**
   * Fetch channel videos with pagination
   */
  async getChannelVideos(
    channelId: string,
    options?: {
      publishedAfter?: string;
      publishedBefore?: string;
      maxResults?: number;
    }
  ) {
    const videos: youtube_v3.Schema$Video[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.youtube.search.list({
        part: ['id'],
        channelId,
        type: ['video'],
        maxResults: options?.maxResults || 50,
        publishedAfter: options?.publishedAfter,
        publishedBefore: options?.publishedBefore,
        pageToken,
        order: 'date',
      });

      await this.trackQuota(100); // 100 units per search query

      const videoIds = response.data.items?.map(item => item.id!.videoId!) || [];

      if (videoIds.length > 0) {
        const videosResponse = await this.youtube.videos.list({
          part: ['snippet', 'statistics', 'contentDetails'],
          id: videoIds,
        });

        await this.trackQuota(1); // 1 unit

        videos.push(...(videosResponse.data.items || []));
      }

      pageToken = response.data.nextPageToken || undefined;

    } while (pageToken && videos.length < (options?.maxResults || 500));

    return videos;
  }

  /**
   * Track quota usage
   */
  private async trackQuota(units: number) {
    await prisma.user.update({
      where: { id: this.userId },
      data: {
        youtubeApiQuotaUsed: { increment: units },
      },
    });
  }
}

/**
 * Get YouTube client for user
 */
export async function getYouTubeClient(userId: string): Promise<YouTubeClient> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      youtubeAccessToken: true,
      youtubeRefreshToken: true,
      youtubeTokenExpiry: true,
    },
  });

  if (!user?.youtubeAccessToken || !user?.youtubeRefreshToken) {
    throw new Error('YouTube not connected. Please connect your YouTube account.');
  }

  // Check if token expired
  if (user.youtubeTokenExpiry && user.youtubeTokenExpiry < new Date()) {
    // Token will be auto-refreshed on first API call
  }

  return new YouTubeClient(
    user.youtubeAccessToken,
    user.youtubeRefreshToken,
    userId
  );
}

/**
 * Extract YouTube channel ID from various URL formats
 */
export function extractChannelId(input: string): string {
  // Direct ID
  if (input.startsWith('UC') && input.length === 24) {
    return input;
  }

  // URL patterns
  const patterns = [
    /youtube\.com\/channel\/([a-zA-Z0-9_-]{24})/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  throw new Error('Invalid YouTube channel URL or ID');
}
```

---

#### Day 3-4: Queue System for Background Jobs

**Install Dependencies:**
```bash
npm install bull @types/bull ioredis
```

**File:** `src/lib/queue/youtube-jobs.ts`

```typescript
import Queue from 'bull';
import { prisma } from '@/lib/prisma';
import { getYouTubeClient } from '@/lib/youtube-client';

// Initialize queue (uses Redis)
export const analyzeChannelsJob = new Queue('youtube-analysis', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
});

/**
 * Process channel analysis jobs
 */
analyzeChannelsJob.process(async (job) => {
  const { executionId, jobId, userId } = job.data;

  console.log(`[YouTube Analysis] Starting job ${jobId} (execution ${executionId})`);

  try {
    // Get job details
    const analysisJob = await prisma.youTubeAnalysisJob.findUnique({
      where: { id: jobId },
      include: {
        channels: true,
      },
    });

    if (!analysisJob) {
      throw new Error('Analysis job not found');
    }

    const youtube = await getYouTubeClient(userId);

    let totalVideos = 0;
    let totalCreditsUsed = 0;

    // Process each channel
    for (const channel of analysisJob.channels) {
      job.progress((analysisJob.channels.indexOf(channel) / analysisJob.channels.length) * 100);

      console.log(`[YouTube Analysis] Processing channel: ${channel.title}`);

      // Fetch videos based on filters
      const videos = await youtube.getChannelVideos(channel.channelId, {
        publishedAfter: analysisJob.dateRangeStart?.toISOString(),
        publishedBefore: analysisJob.dateRangeEnd?.toISOString(),
        maxResults: 500,
      });

      console.log(`[YouTube Analysis] Found ${videos.length} videos`);

      // Store videos in database
      for (const videoData of videos) {
        await prisma.youTubeVideo.upsert({
          where: {
            channelId_videoId: {
              channelId: channel.id,
              videoId: videoData.id!,
            },
          },
          create: {
            channelId: channel.id,
            videoId: videoData.id!,
            videoUrl: `https://www.youtube.com/watch?v=${videoData.id}`,
            title: videoData.snippet!.title!,
            description: videoData.snippet!.description,
            thumbnailUrl: videoData.snippet!.thumbnails!.default!.url,
            viewCount: parseInt(videoData.statistics!.viewCount || '0'),
            likeCount: parseInt(videoData.statistics!.likeCount || '0'),
            commentCount: parseInt(videoData.statistics!.commentCount || '0'),
            duration: parseDuration(videoData.contentDetails!.duration!),
            tags: videoData.snippet!.tags || [],
            categoryId: videoData.snippet!.categoryId,
            publishedAt: new Date(videoData.snippet!.publishedAt!),
          },
          update: {
            viewCount: parseInt(videoData.statistics!.viewCount || '0'),
            likeCount: parseInt(videoData.statistics!.likeCount || '0'),
            commentCount: parseInt(videoData.statistics!.commentCount || '0'),
          },
        });
      }

      // Calculate average views
      const avgViews = videos.reduce((sum, v) =>
        sum + parseInt(v.statistics!.viewCount || '0'), 0
      ) / videos.length;

      // Update channel stats
      await prisma.youTubeChannel.update({
        where: { id: channel.id },
        data: {
          averageViews: avgViews,
          lastAnalyzed: new Date(),
        },
      });

      // Create snapshot for historical tracking
      await prisma.channelSnapshot.create({
        data: {
          channelId: channel.id,
          subscriberCount: channel.subscriberCount,
          videoCount: videos.length,
          totalViews: channel.totalViews,
          averageViews: avgViews,
        },
      });

      totalVideos += videos.length;
      totalCreditsUsed += 50 + Math.ceil(videos.length / 50) * 10; // Credit calculation
    }

    // Calculate aggregated results
    const results = await calculateAggregatedResults(analysisJob.id);

    // Update execution with results
    await prisma.analysisJobExecution.update({
      where: { id: executionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        channelsProcessed: analysisJob.channels.length,
        videosProcessed: totalVideos,
        creditsUsed: totalCreditsUsed,
        resultData: results,
      },
    });

    // Update job
    await prisma.youTubeAnalysisJob.update({
      where: { id: jobId },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: 'completed',
        channelsAnalyzed: analysisJob.channels.length,
        videosAnalyzed: totalVideos,
        totalCreditsUsed: { increment: totalCreditsUsed },
      },
    });

    console.log(`[YouTube Analysis] Completed job ${jobId}`);

    return { success: true, videosProcessed: totalVideos };

  } catch (error) {
    console.error(`[YouTube Analysis] Error in job ${jobId}:`, error);

    // Update execution with error
    await prisma.analysisJobExecution.update({
      where: { id: executionId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message,
      },
    });

    throw error;
  }
});

/**
 * Calculate aggregated results from stored data
 */
async function calculateAggregatedResults(jobId: string) {
  const job = await prisma.youTubeAnalysisJob.findUnique({
    where: { id: jobId },
    include: {
      channels: {
        include: {
          videos: {
            where: {
              publishedAt: {
                gte: job.dateRangeStart || undefined,
                lte: job.dateRangeEnd || undefined,
              },
            },
          },
        },
      },
    },
  });

  const allVideos = job.channels.flatMap(c => c.videos);

  // Summary statistics
  const totalViews = allVideos.reduce((sum, v) => sum + v.viewCount, 0);
  const averageViews = totalViews / allVideos.length;
  const sortedViews = allVideos.map(v => v.viewCount).sort((a, b) => a - b);
  const medianViews = sortedViews[Math.floor(sortedViews.length / 2)];

  // By channel
  const byChannel = job.channels.map(channel => ({
    channelTitle: channel.title,
    channelId: channel.channelId,
    videoCount: channel.videos.length,
    averageViews: channel.videos.reduce((sum, v) => sum + v.viewCount, 0) / channel.videos.length,
    totalViews: channel.videos.reduce((sum, v) => sum + v.viewCount, 0),
    topVideos: channel.videos
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 5)
      .map(v => ({
        title: v.title,
        views: v.viewCount,
        publishedAt: v.publishedAt,
      })),
  }));

  // By category
  const byCategory: Record<string, any> = {};
  allVideos.forEach(video => {
    if (!video.categoryId) return;
    if (!byCategory[video.categoryId]) {
      byCategory[video.categoryId] = { videoCount: 0, totalViews: 0 };
    }
    byCategory[video.categoryId].videoCount++;
    byCategory[video.categoryId].totalViews += video.viewCount;
  });

  Object.keys(byCategory).forEach(cat => {
    byCategory[cat].averageViews = byCategory[cat].totalViews / byCategory[cat].videoCount;
  });

  // By date range (monthly)
  const byMonth: Record<string, any> = {};
  allVideos.forEach(video => {
    const month = video.publishedAt.toISOString().slice(0, 7); // YYYY-MM
    if (!byMonth[month]) {
      byMonth[month] = { videoCount: 0, totalViews: 0 };
    }
    byMonth[month].videoCount++;
    byMonth[month].totalViews += video.viewCount;
  });

  const byDateRange = Object.entries(byMonth).map(([month, data]: [string, any]) => ({
    month,
    videoCount: data.videoCount,
    averageViews: data.totalViews / data.videoCount,
  }));

  return {
    summary: {
      totalChannels: job.channels.length,
      totalVideos: allVideos.length,
      averageViews,
      medianViews,
      totalViews,
    },
    byChannel,
    byCategory,
    byDateRange,
  };
}

/**
 * Parse YouTube duration format (PT1H2M3S) to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  return hours * 3600 + minutes * 60 + seconds;
}
```

---

#### Day 5: Scheduler for Recurring Jobs

**File:** `src/lib/queue/scheduler.ts`

```typescript
import { CronJob } from 'cron';
import { prisma } from '@/lib/prisma';
import { analyzeChannelsJob } from './youtube-jobs';

/**
 * Initialize scheduler for recurring YouTube analysis jobs
 */
export function initializeScheduler() {
  console.log('[Scheduler] Initializing YouTube analysis scheduler...');

  // Check for scheduled jobs every minute
  const schedulerJob = new CronJob('* * * * *', async () => {
    const now = new Date();

    // Find jobs that should run now
    const dueJobs = await prisma.youTubeAnalysisJob.findMany({
      where: {
        isRecurring: true,
        nextRunAt: {
          lte: now,
        },
        status: {
          not: 'running',
        },
      },
    });

    for (const job of dueJobs) {
      console.log(`[Scheduler] Triggering job: ${job.name} (${job.id})`);

      try {
        // Create execution
        const execution = await prisma.analysisJobExecution.create({
          data: {
            jobId: job.id,
            status: 'running',
            triggeredBy: 'scheduled',
          },
        });

        // Add to queue
        await analyzeChannelsJob.add({
          executionId: execution.id,
          jobId: job.id,
          userId: job.userId,
        });

        // Calculate next run time
        const nextRunAt = calculateNextRunTime(job.schedule!);

        // Update job
        await prisma.youTubeAnalysisJob.update({
          where: { id: job.id },
          data: {
            status: 'running',
            nextRunAt,
          },
        });

      } catch (error) {
        console.error(`[Scheduler] Error scheduling job ${job.id}:`, error);
      }
    }
  });

  schedulerJob.start();
  console.log('[Scheduler] Scheduler started');

  return schedulerJob;
}

/**
 * Calculate next run time based on cron expression
 */
function calculateNextRunTime(cronExpression: string): Date {
  const cronJob = new CronJob(cronExpression, () => {});
  return cronJob.nextDate().toDate();
}

/**
 * Validate cron expression
 */
export function validateCronExpression(expression: string): boolean {
  try {
    new CronJob(expression, () => {});
    return true;
  } catch {
    return false;
  }
}
```

**Add to server startup** (`src/app/api/...` or separate worker process):

```typescript
// Start scheduler when server starts
import { initializeScheduler } from '@/lib/queue/scheduler';

if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
  initializeScheduler();
}
```

---

### Week 2: Frontend & User Experience

#### Day 6-7: YouTube Integration Settings Page

**File:** `src/app/(dashboard)/settings/integrations/youtube/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Youtube, Plus, Trash2, RefreshCw } from 'lucide-react';

export default function YouTubeIntegrationPage() {
  const { data: session } = useSession();
  const [channels, setChannels] = useState([]);
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const connectYouTube = async () => {
    const res = await fetch('/api/integrations/youtube/connect', {
      method: 'POST',
    });
    const { authUrl } = await res.json();
    window.location.href = authUrl;
  };

  const addChannel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youtube/channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: [newChannelUrl] }),
      });
      const data = await res.json();
      setChannels([...channels, ...data.channels]);
      setNewChannelUrl('');
    } catch (error) {
      console.error('Failed to add channel:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">YouTube Integration</h1>
        <p className="text-muted-foreground">
          Connect your YouTube account to analyze channels automatically
        </p>
      </div>

      {/* Connection Status */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Youtube className="h-12 w-12 text-red-500" />
            <div>
              <h3 className="font-semibold">YouTube Data API</h3>
              <p className="text-sm text-muted-foreground">
                {isConnected ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>

          {isConnected ? (
            <Badge variant="success">Connected</Badge>
          ) : (
            <Button onClick={connectYouTube}>
              Connect YouTube
            </Button>
          )}
        </div>
      </Card>

      {/* Add Channels */}
      {isConnected && (
        <Card className="p-6 mb-6">
          <h3 className="font-semibold mb-4">Add Channels to Track</h3>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter YouTube channel URL or ID"
              value={newChannelUrl}
              onChange={(e) => setNewChannelUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={addChannel} disabled={loading || !newChannelUrl}>
              <Plus className="h-4 w-4 mr-2" />
              Add Channel
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Examples: https://www.youtube.com/@channelname or UCxxxxxxxxxxxxxx
          </p>
        </Card>
      )}

      {/* Channel List */}
      {channels.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Tracked Channels ({channels.length})</h3>

          <div className="space-y-3">
            {channels.map((channel) => (
              <div key={channel.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <img src={channel.thumbnailUrl} alt="" className="h-10 w-10 rounded-full" />
                  <div>
                    <p className="font-medium">{channel.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {channel.subscriberCount.toLocaleString()} subscribers • {channel.videoCount} videos
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

---

#### Day 8-9: Analysis Job Creation Page

**File:** `src/app/(dashboard)/youtube/new-analysis/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function NewAnalysisPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    channelIds: [],
    dateRangeStart: null,
    dateRangeEnd: null,
    isRecurring: false,
    schedule: 'daily',
  });
  const [estimatedCredits, setEstimatedCredits] = useState(0);

  const createJob = async () => {
    const res = await fetch('/api/youtube/analysis/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        schedule: formData.isRecurring ? {
          isRecurring: true,
          cronExpression: getCronExpression(formData.schedule),
        } : undefined,
      }),
    });

    const { jobId } = await res.json();
    router.push(`/youtube/analysis/${jobId}`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Create YouTube Analysis</h1>

      {/* Job Details */}
      <Card className="p-6 mb-6">
        <h3 className="font-semibold mb-4">Analysis Details</h3>

        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              placeholder="e.g., Daily Tech Channel Analysis"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="What is this analysis for?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* Channel Selection */}
      <Card className="p-6 mb-6">
        <h3 className="font-semibold mb-4">Select Channels</h3>
        {/* Channel multi-select component */}
      </Card>

      {/* Filters */}
      <Card className="p-6 mb-6">
        <h3 className="font-semibold mb-4">Filters</h3>

        <div className="space-y-4">
          <div>
            <Label>Date Range</Label>
            <div className="flex gap-2">
              <Input type="date" placeholder="Start date" />
              <Input type="date" placeholder="End date" />
            </div>
          </div>

          <div>
            <Label>Minimum Views</Label>
            <Input type="number" placeholder="e.g., 1000" />
          </div>
        </div>
      </Card>

      {/* Scheduling */}
      <Card className="p-6 mb-6">
        <h3 className="font-semibold mb-4">Scheduling</h3>

        <div className="flex items-center justify-between mb-4">
          <div>
            <Label>Recurring Analysis</Label>
            <p className="text-sm text-muted-foreground">
              Run this analysis automatically on a schedule
            </p>
          </div>
          <Switch
            checked={formData.isRecurring}
            onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
          />
        </div>

        {formData.isRecurring && (
          <Select
            value={formData.schedule}
            onValueChange={(value) => setFormData({ ...formData, schedule: value })}
          >
            <option value="daily">Daily (2:00 AM)</option>
            <option value="weekly">Weekly (Monday 2:00 AM)</option>
            <option value="monthly">Monthly (1st at 2:00 AM)</option>
          </Select>
        )}
      </Card>

      {/* Cost Estimate */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Estimated Cost</h3>
            <p className="text-sm text-muted-foreground">
              Per execution
            </p>
          </div>
          <Badge variant="secondary" className="text-lg">
            {estimatedCredits} credits
          </Badge>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={createJob} size="lg" className="flex-1">
          Create Analysis
        </Button>
        <Button variant="outline" size="lg" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function getCronExpression(schedule: string): string {
  const schedules = {
    daily: '0 2 * * *',
    weekly: '0 2 * * 1',
    monthly: '0 2 1 * *',
  };
  return schedules[schedule];
}
```

---

### Week 3: Results & Polish

#### Day 10-11: Results Dashboard

**File:** `src/app/(dashboard)/youtube/analysis/[id]/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Play, Calendar } from 'lucide-react';

export default function AnalysisResultsPage({ params }: { params: { id: string } }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [params.id]);

  const fetchResults = async () => {
    const res = await fetch(`/api/youtube/analysis/${params.id}/results`);
    const data = await res.json();
    setResults(data);
    setLoading(false);
  };

  const exportResults = async (format: string) => {
    window.location.href = `/api/youtube/analysis/${params.id}/export?format=${format}`;
  };

  const runNow = async () => {
    await fetch(`/api/youtube/analysis/${params.id}/run`, { method: 'POST' });
    // Show toast notification
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{results.job.name}</h1>
          <p className="text-muted-foreground">
            Last run: {new Date(results.job.lastRunAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={runNow}>
            <Play className="h-4 w-4 mr-2" />
            Run Now
          </Button>
          <Button variant="outline" onClick={() => exportResults('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Channels</p>
          <p className="text-2xl font-bold">{results.results.summary.totalChannels}</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Videos</p>
          <p className="text-2xl font-bold">{results.results.summary.totalVideos}</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Average Views</p>
          <p className="text-2xl font-bold">
            {results.results.summary.averageViews.toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Views</p>
          <p className="text-2xl font-bold">
            {results.results.summary.totalViews.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Average Views by Channel Chart */}
      <Card className="p-6 mb-6">
        <h3 className="font-semibold mb-4">Average Views by Channel</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={results.results.byChannel}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="channelTitle" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="averageViews" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Channel Breakdown Table */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Channel Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Channel</th>
                <th className="text-right p-2">Videos</th>
                <th className="text-right p-2">Avg Views</th>
                <th className="text-right p-2">Total Views</th>
              </tr>
            </thead>
            <tbody>
              {results.results.byChannel.map((channel) => (
                <tr key={channel.channelId} className="border-b">
                  <td className="p-2">{channel.channelTitle}</td>
                  <td className="text-right p-2">{channel.videoCount}</td>
                  <td className="text-right p-2">
                    {channel.averageViews.toLocaleString()}
                  </td>
                  <td className="text-right p-2">
                    {channel.totalViews.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

---

## 💰 Pricing Structure

### Credit Costs

```typescript
// src/lib/credits.ts - Add to existing credit costs

export const YOUTUBE_CREDIT_COSTS = {
  // Per operation costs
  ADD_CHANNEL: 10,              // Adding a channel to track
  FETCH_CHANNEL_INFO: 5,        // Fetch basic channel info
  FETCH_VIDEOS_BATCH: 10,       // Fetch 50 videos
  ANALYZE_VIDEO: 2,             // Analyze single video

  // Job costs
  ANALYSIS_JOB_BASE: 50,        // Base cost to start analysis
  PER_CHANNEL: 50,              // Cost per channel analyzed
  PER_100_VIDEOS: 20,           // Cost per 100 videos processed

  // Scheduled jobs
  RECURRING_JOB_FEE: 100,       // Monthly fee for recurring jobs
} as const;

/**
 * Estimate cost for YouTube analysis job
 */
export function estimateYouTubeAnalysisCredits(
  channelCount: number,
  estimatedVideosPerChannel: number = 200,
  isRecurring: boolean = false
): number {
  let total = YOUTUBE_CREDIT_COSTS.ANALYSIS_JOB_BASE;

  // Per channel
  total += channelCount * YOUTUBE_CREDIT_COSTS.PER_CHANNEL;

  // Per video
  const totalVideos = channelCount * estimatedVideosPerChannel;
  total += Math.ceil(totalVideos / 100) * YOUTUBE_CREDIT_COSTS.PER_100_VIDEOS;

  // Recurring fee (monthly)
  if (isRecurring) {
    total += YOUTUBE_CREDIT_COSTS.RECURRING_JOB_FEE;
  }

  return total;
}
```

### Plan Limits

```typescript
// src/lib/plans.ts - Add to existing plans

export const YOUTUBE_PLAN_LIMITS = {
  free: {
    maxChannels: 5,
    maxAnalysisJobs: 1,
    maxRecurringJobs: 0,
    maxVideosPerJob: 500,
  },
  starter: {
    maxChannels: 25,
    maxAnalysisJobs: 5,
    maxRecurringJobs: 2,
    maxVideosPerJob: 2000,
  },
  pro: {
    maxChannels: 100,
    maxAnalysisJobs: 20,
    maxRecurringJobs: 10,
    maxVideosPerJob: 10000,
  },
  enterprise: {
    maxChannels: Infinity,
    maxAnalysisJobs: Infinity,
    maxRecurringJobs: Infinity,
    maxVideosPerJob: Infinity,
  },
} as const;
```

### Pricing Packages for Customers

```typescript
export const YOUTUBE_ANALYZER_PRICING = {
  basic: {
    name: 'Basic',
    price: 49,
    period: 'month',
    credits: 5000,
    features: [
      '25 YouTube channels',
      '5 analysis jobs',
      '2 recurring schedules',
      'CSV export',
      'Basic analytics',
      'Email support',
    ],
    ideal: 'Small teams analyzing a few channels',
  },
  professional: {
    name: 'Professional',
    price: 149,
    period: 'month',
    credits: 20000,
    features: [
      '100 YouTube channels',
      '20 analysis jobs',
      '10 recurring schedules',
      'CSV + Excel export',
      'Advanced analytics',
      'Historical trends',
      'Priority support',
      'API access',
    ],
    ideal: 'Growing businesses tracking competitors',
    popular: true,
  },
  enterprise: {
    name: 'Enterprise',
    price: 499,
    period: 'month',
    credits: 100000,
    features: [
      'Unlimited channels',
      'Unlimited analysis jobs',
      'Unlimited schedules',
      'All export formats',
      'Custom analytics',
      'White-label reports',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
    ],
    ideal: 'Agencies and large organizations',
  },
} as const;
```

---

## 🎓 Customer Onboarding Flow

### Step-by-Step Onboarding

```typescript
// src/lib/onboarding/youtube-flow.ts

export const YOUTUBE_ONBOARDING_STEPS = [
  {
    id: 'connect',
    title: 'Connect YouTube',
    description: 'Authorize access to YouTube Data API',
    component: 'YouTubeConnect',
    estimatedTime: '2 minutes',
    action: async () => {
      // Redirect to OAuth flow
      const res = await fetch('/api/integrations/youtube/connect', { method: 'POST' });
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    },
  },
  {
    id: 'add-channels',
    title: 'Add Channels',
    description: 'Add YouTube channels you want to analyze',
    component: 'AddChannels',
    estimatedTime: '3 minutes',
    minChannels: 1,
    examples: [
      'https://www.youtube.com/@mkbhd',
      'https://www.youtube.com/@veritasium',
      'UCxxxxxxxxxxxxxx',
    ],
  },
  {
    id: 'create-analysis',
    title: 'Create First Analysis',
    description: 'Set up your first automated analysis job',
    component: 'CreateAnalysisWizard',
    estimatedTime: '5 minutes',
    template: 'daily-competitor-analysis',
  },
  {
    id: 'review-results',
    title: 'Review Results',
    description: 'See your first analysis results',
    component: 'ResultsPreview',
    estimatedTime: '3 minutes',
  },
  {
    id: 'setup-schedule',
    title: 'Set Up Schedule (Optional)',
    description: 'Automate recurring analysis',
    component: 'ScheduleSetup',
    estimatedTime: '2 minutes',
    optional: true,
  },
] as const;
```

### Onboarding UI Component

**File:** `src/components/youtube/onboarding-wizard.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check } from 'lucide-react';
import { YOUTUBE_ONBOARDING_STEPS } from '@/lib/onboarding/youtube-flow';

export function YouTubeOnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const step = YOUTUBE_ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / YOUTUBE_ONBOARDING_STEPS.length) * 100;

  const handleNext = () => {
    setCompletedSteps(new Set([...completedSteps, currentStep]));
    if (currentStep < YOUTUBE_ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Onboarding complete
      window.location.href = '/youtube/dashboard';
    }
  };

  const handleSkip = () => {
    if (step.optional) {
      handleNext();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {YOUTUBE_ONBOARDING_STEPS.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round(progress)}% Complete
          </span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Step Content */}
      <Card className="p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">{step.title}</h2>
          <p className="text-muted-foreground">{step.description}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Estimated time: {step.estimatedTime}
          </p>
        </div>

        {/* Step-specific component would render here */}
        <div className="my-8">
          {/* {renderStepComponent(step.component)} */}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
              Back
            </Button>
          )}

          <Button onClick={handleNext} className="flex-1">
            {currentStep === YOUTUBE_ONBOARDING_STEPS.length - 1 ? 'Finish' : 'Continue'}
          </Button>

          {step.optional && (
            <Button variant="ghost" onClick={handleSkip}>
              Skip
            </Button>
          )}
        </div>
      </Card>

      {/* Step Navigation */}
      <div className="flex justify-center gap-2 mt-6">
        {YOUTUBE_ONBOARDING_STEPS.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentStep(index)}
            className={`h-2 w-8 rounded-full transition-colors ${
              completedSteps.has(index)
                ? 'bg-green-500'
                : index === currentStep
                ? 'bg-primary'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// __tests__/youtube-client.test.ts

import { YouTubeClient, extractChannelId } from '@/lib/youtube-client';

describe('YouTubeClient', () => {
  it('should extract channel ID from various URL formats', () => {
    expect(extractChannelId('UCxxxxxxxxxxxxxx')).toBe('UCxxxxxxxxxxxxxx');
    expect(extractChannelId('https://www.youtube.com/channel/UCxxxxxxxxxxxxxx')).toBe('UCxxxxxxxxxxxxxx');
    expect(extractChannelId('https://www.youtube.com/@channelname')).toBe('@channelname');
  });

  it('should throw error for invalid URLs', () => {
    expect(() => extractChannelId('invalid-url')).toThrow('Invalid YouTube channel URL or ID');
  });
});

// __tests__/credit-estimation.test.ts

import { estimateYouTubeAnalysisCredits } from '@/lib/credits';

describe('Credit Estimation', () => {
  it('should calculate correct credits for basic job', () => {
    const credits = estimateYouTubeAnalysisCredits(5, 200, false);
    expect(credits).toBe(50 + (5 * 50) + (Math.ceil(1000 / 100) * 20)); // 350
  });

  it('should add recurring fee', () => {
    const credits = estimateYouTubeAnalysisCredits(5, 200, true);
    expect(credits).toBe(450); // 350 + 100 recurring fee
  });
});
```

### Integration Tests

```typescript
// __tests__/api/youtube-analysis.test.ts

import { POST } from '@/app/api/youtube/analysis/create/route';

describe('POST /api/youtube/analysis/create', () => {
  it('should create analysis job', async () => {
    const req = new Request('http://localhost/api/youtube/analysis/create', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Analysis',
        channelIds: ['UC1', 'UC2'],
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('jobId');
  });

  it('should reject if insufficient credits', async () => {
    // Mock user with 0 credits
    const res = await POST(/* ... */);
    expect(res.status).toBe(402);
  });
});
```

---

## 🚀 Deployment Plan

### Environment Variables

Add to `.env`:

```bash
# YouTube API
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_API_KEY=your_api_key

# Redis (for Bull queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Scheduler
ENABLE_SCHEDULER=true # Set to true in production

# App URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Deployment Checklist

- [ ] Set up YouTube OAuth app in Google Cloud Console
- [ ] Get YouTube Data API v3 credentials
- [ ] Set up Redis instance (Upstash recommended)
- [ ] Configure environment variables in Vercel
- [ ] Deploy background worker (separate from Next.js)
- [ ] Test OAuth flow in production
- [ ] Test scheduled jobs execution
- [ ] Set up error monitoring (Sentry)
- [ ] Configure usage alerts
- [ ] Test export functionality
- [ ] Verify credit calculations
- [ ] Load test with 100 channels

### Background Worker Deployment

**Option 1: Separate Node.js Process**

```dockerfile
# worker.Dockerfile
FROM node:18

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Run scheduler only
CMD ["node", "dist/worker.js"]
```

**File:** `worker.ts`

```typescript
import { initializeScheduler } from '@/lib/queue/scheduler';
import { analyzeChannelsJob } from '@/lib/queue/youtube-jobs';

console.log('[Worker] Starting YouTube analysis worker...');

// Initialize job processor
console.log('[Worker] Initializing job processor...');
// Jobs will automatically process as they're added to queue

// Initialize scheduler
initializeScheduler();

console.log('[Worker] Worker ready and listening for jobs');

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[Worker] Received SIGTERM, shutting down gracefully...');
  analyzeChannelsJob.close().then(() => {
    console.log('[Worker] Shutdown complete');
    process.exit(0);
  });
});
```

Deploy to Railway, Render, or Fly.io.

---

## 📅 Timeline & Milestones

### Week 1: Foundation

**Days 1-2: YouTube API Client**
- ✅ OAuth flow implementation
- ✅ Channel data fetching
- ✅ Video list pagination
- ✅ Quota tracking
- **Deliverable:** Can fetch data from YouTube

**Days 3-4: Queue System**
- ✅ Bull queue setup
- ✅ Job processor
- ✅ Credit calculation
- ✅ Result aggregation
- **Deliverable:** Background jobs work

**Day 5: Scheduler**
- ✅ Cron job engine
- ✅ Recurring task execution
- ✅ Next run calculation
- **Deliverable:** Scheduled jobs run automatically

---

### Week 2: User Experience

**Days 6-7: Integration Settings**
- ✅ YouTube connection UI
- ✅ Channel management
- ✅ OAuth callback handling
- **Deliverable:** Users can connect YouTube

**Days 8-9: Analysis Creation**
- ✅ Job creation form
- ✅ Filter configuration
- ✅ Schedule setup
- ✅ Credit estimation
- **Deliverable:** Users can create analyses

---

### Week 3: Results & Polish

**Days 10-11: Results Dashboard**
- ✅ Data visualization
- ✅ Channel breakdown
- ✅ Export functionality
- **Deliverable:** Users see results

**Days 12-13: Onboarding**
- ✅ Wizard flow
- ✅ Sample templates
- ✅ Documentation
- **Deliverable:** New users can start quickly

**Days 14-15: Testing & Deploy**
- ✅ Integration tests
- ✅ Load testing
- ✅ Production deployment
- ✅ Monitoring setup
- **Deliverable:** Production-ready

---

## 🎯 Success Metrics

### Technical KPIs
- Job success rate: >95%
- Average execution time: <5 minutes per 100 channels
- API quota usage: <8,000 units/day (80% of free quota)
- Queue processing: <1 minute delay

### Business KPIs
- User activation: >60% complete onboarding
- Feature adoption: >40% create recurring jobs
- Credit usage: Average 3,000 credits/user/month
- Customer satisfaction: >4.5/5 stars

---

## 📝 Next Steps After Implementation

1. **Pilot Program** - Get 5-10 beta users
2. **Gather Feedback** - Iterate on UI/UX
3. **Add Features:**
   - Competitor comparison reports
   - Email alerts for milestones
   - Slack integration
   - Custom report builder
4. **Scale Infrastructure** - Optimize for 1000+ channels
5. **Marketing** - Create case studies and demos

---

**Questions or need clarification?** This plan provides everything needed to implement YouTube analysis in 2-3 weeks. Each section has detailed code examples ready to copy and adapt.

**Start with Week 1, Day 1** and work through sequentially. The foundation (API client + queue) is most critical.

**Ready to begin? Let's build this! 🚀**
