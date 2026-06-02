import type {
  RatingKey,
  ReviewDraft,
  ReviewRatings,
  TantouSubmission,
} from "./reviewTypes";

export const RATING_MAX = 5;

export const RATING_KEYS: RatingKey[] = [
  "pacingContent",
  "visualArt",
  "layoutStoryboard",
  "localizationTech",
];

export function clampRating(value: unknown): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  const stepped = Math.round(parsed * 2) / 2;
  return Math.min(RATING_MAX, Math.max(0, stepped));
}

export function migrateRatings(
  raw: Partial<ReviewRatings> & Record<string, number> = {},
): ReviewRatings {
  if (raw.pacingContent != null || raw.visualArt != null) {
    return {
      pacingContent: clampRating(raw.pacingContent),
      visualArt: clampRating(raw.visualArt),
      layoutStoryboard: clampRating(raw.layoutStoryboard),
      localizationTech: clampRating(raw.localizationTech),
    };
  }
  return {
    pacingContent: clampRating(raw.pacing ?? raw.plot),
    visualArt: clampRating(raw.style),
    layoutStoryboard: clampRating(raw.layout ?? raw.character),
    localizationTech: clampRating(raw.localization ?? raw.character),
  };
}

export function averageRatings(ratings: ReviewRatings): number {
  const values = RATING_KEYS.map((key) => clampRating(ratings[key]));
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.length ? total / values.length : 0;
}

export function createReviewDraft(submission: TantouSubmission | null): ReviewDraft {
  return {
    storyTitle: submission?.seriesTitle ?? "",
    authorName:
      submission?.seriesMeta?.authorName ?? submission?.mangakaName ?? "",
    synopsis: submission?.seriesMeta?.synopsis ?? "",
    genres: Array.isArray(submission?.seriesMeta?.genres)
      ? [...submission.seriesMeta.genres]
      : [],
    reviewText:
      submission?.reviewText ?? submission?.editorialComment ?? "",
    reviewStatus: submission?.reviewStatus ?? "draft",
    ratings: migrateRatings(submission?.reviewRatings),
  };
}

export function formatReleaseDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function isColoredSeries(submission: TantouSubmission | null): boolean {
  const label = submission?.seriesMeta?.formatLabel?.toLowerCase() ?? "";
  return label.includes("webtoon") || label.includes("color");
}

export function findNextPendingSubmission(
  submissions: TantouSubmission[],
  currentId: string,
  seriesTitle?: string,
): TantouSubmission | null {
  const pool = submissions
    .filter((s) => s.status === "pending")
    .filter((s) => !seriesTitle || s.seriesTitle === seriesTitle)
    .sort(
      (a, b) =>
        new Date(a.sentAt ?? 0).getTime() - new Date(b.sentAt ?? 0).getTime(),
    );

  if (pool.length === 0) return null;

  const currentIndex = pool.findIndex((s) => s.id === currentId);
  if (currentIndex >= 0 && currentIndex < pool.length - 1) {
    return pool[currentIndex + 1];
  }

  const fallback = pool.find((s) => s.id !== currentId);
  return fallback ?? null;
}
