"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface ArticleCardProps {
  headline: string;
  excerpt: string;
  cover?: string;
  tag?: string;
  readingTime?: number; // in seconds
  writer?: string;
  publishedAt?: Date;
  clampLines?: number;
}

// Human-friendly read time: seconds -> "X min read"
export function formatReadTime(seconds: number): string {
  if (!seconds || seconds < 60) return "Less than 1 min read";
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min read`;
}

// Date -> "Aug 15, 2025" (localized but concise)
export function formatPostDate(date: Date): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  cover,
  tag,
  readingTime,
  headline,
  excerpt,
  writer,
  publishedAt,
  clampLines,
}) => {
  const hasMeta = tag || readingTime;
  const hasFooter = writer || publishedAt;

  return (
    <div className="group relative isolate w-full max-w-sm">
      {/* Rear glow: a blurred brand-gradient blob sitting behind the card,
          same device as the ambient glow behind the hero and the
          highlighted pricing tier — brightens on hover so the card reads
          as lifted off the page instead of flat against it. `isolate` is
          load-bearing: without a local stacking context, `-z-10` on a
          plain `relative` ancestor escapes to the page root and paints
          behind the entire page background instead of just behind the
          card, making the glow invisible. */}
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-teal-400 via-emerald-500 to-teal-500 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-90"
      />

      <Card className="flex w-full flex-col gap-3 overflow-hidden rounded-3xl border p-3 shadow-lg">
        {cover && (
          <CardHeader className="p-0">
            <div className="relative h-56 w-full">
              <Image
                src={cover}
                alt={headline}
                fill
                className="rounded-2xl object-cover"
              />
            </div>
          </CardHeader>
        )}

        <CardContent className="flex-grow p-3">
          {hasMeta && (
            <div className="mb-4 flex items-center text-sm text-muted-foreground">
              {tag && (
                <Badge className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground hover:text-black">
                  {tag}
                </Badge>
              )}
              {tag && readingTime && <span className="mx-2">•</span>}
              {readingTime && <span>{formatReadTime(readingTime)}</span>}
            </div>
          )}

          <h2 className="mb-2 text-2xl font-bold leading-tight text-card-foreground">
            {headline}
          </h2>

          <p
            className={cn("text-muted-foreground", {
              "overflow-hidden text-ellipsis [-webkit-box-orient:vertical] [display:-webkit-box]":
                clampLines && clampLines > 0,
            })}
            style={{
              WebkitLineClamp: clampLines,
            }}
          >
            {excerpt}
          </p>
        </CardContent>

        {hasFooter && (
          <CardFooter className="flex items-center justify-between p-3">
            {writer && (
              <div>
                <p className="text-sm text-muted-foreground">By</p>
                <p className="font-semibold text-muted-foreground">{writer}</p>
              </div>
            )}
            {publishedAt && (
              <div className={writer ? "text-right" : ""}>
                <p className="text-sm text-muted-foreground">Published</p>
                <p className="font-semibold text-muted-foreground">
                  {formatPostDate(publishedAt)}
                </p>
              </div>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
};
