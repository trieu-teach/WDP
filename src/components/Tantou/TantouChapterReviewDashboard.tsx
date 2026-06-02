import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { SERIES_GENRES } from "@/utils/seriesModel.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChapterListTable } from "./ChapterListTable";
import { ChapterReaderPanel } from "./ChapterReaderPanel";
import { ReviewRatingPanel } from "./ReviewRatingPanel";
import type {
  ChapterRow,
  ReviewDraft,
  ReviewSavePayload,
  TantouSubmission,
} from "./reviewTypes";
import {
  averageRatings,
  clampRating,
  createReviewDraft,
  findNextPendingSubmission,
  formatReleaseDate,
} from "./reviewUtils";

type TantouChapterReviewDashboardProps = {
  submission: TantouSubmission;
  relatedSubmissions?: TantouSubmission[];
  allSubmissions?: TantouSubmission[];
  onCancel: () => void;
  onSaveReview: (
    payload: ReviewSavePayload,
    options?: { advanceNext?: boolean },
  ) => void;
  onSelectChapter: (submissionId: string) => void;
};

function GenrePicker({
  selectedGenres,
  onToggle,
}: {
  selectedGenres: string[];
  onToggle: (genre: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SERIES_GENRES.slice(0, 8).map((genre) => {
        const active = selectedGenres.includes(genre);
        return (
          <button
            key={genre}
            type="button"
            onClick={() => onToggle(genre)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted/50"
            }`}
          >
            {genre}
          </button>
        );
      })}
    </div>
  );
}

export function TantouChapterReviewDashboard({
  submission,
  relatedSubmissions = [],
  allSubmissions = [],
  onCancel,
  onSaveReview,
  onSelectChapter,
}: TantouChapterReviewDashboardProps) {
  const [draft, setDraft] = useState<ReviewDraft>(() =>
    createReviewDraft(submission),
  );
  const [viewingChapterId, setViewingChapterId] = useState<string | null>(
    () => submission.id,
  );
  const readerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(createReviewDraft(submission));
    setViewingChapterId(submission.id);
  }, [submission.id]);

  const averageScore = useMemo(
    () => averageRatings(draft.ratings),
    [draft.ratings],
  );

  const chapterRows: ChapterRow[] = useMemo(() => {
    return relatedSubmissions
      .filter((row) => row.seriesTitle === submission.seriesTitle)
      .map((row, index) => ({
        id: row.id,
        index: index + 1,
        name: row.pageLabel || `Ch. ${row.chapterNum}`,
        releaseDate: formatReleaseDate(
          row.sentAt ?? row.reviewedAt ?? row.forwardedAt,
        ),
        status: row.status ?? "pending",
      }));
  }, [relatedSubmissions, submission.seriesTitle]);

  const viewingSubmission = useMemo(() => {
    if (!viewingChapterId) return null;
    return (
      relatedSubmissions.find((s) => s.id === viewingChapterId) ?? submission
    );
  }, [viewingChapterId, relatedSubmissions, submission]);

  const nextPending = useMemo(
    () =>
      findNextPendingSubmission(
        allSubmissions.length ? allSubmissions : relatedSubmissions,
        submission.id,
        submission.seriesTitle,
      ),
    [allSubmissions, relatedSubmissions, submission.id, submission.seriesTitle],
  );

  function handleOpenChapter(id: string) {
    setViewingChapterId(id);
    onSelectChapter(id);
    requestAnimationFrame(() => {
      readerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function buildPayload(): ReviewSavePayload {
    return {
      ...draft,
      averageScore,
      coverImageUrl: submission.mangakaImageUrl,
    };
  }

  function updateRating(key: keyof ReviewDraft["ratings"], value: number) {
    setDraft((current) => ({
      ...current,
      ratings: { ...current.ratings, [key]: clampRating(value) },
    }));
  }

  function toggleGenre(genre: string) {
    setDraft((current) => ({
      ...current,
      genres: current.genres.includes(genre)
        ? current.genres.filter((g) => g !== genre)
        : [...current.genres, genre],
    }));
  }

  return (
    <div className="space-y-6 dark:text-zinc-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="size-4" />
          Cancel
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-sky-500">
            Tantou · Chapter Review
          </p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {draft.storyTitle || submission.seriesTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ch. {submission.chapterNum} · {submission.pageLabel} ·{" "}
            {submission.mangakaName}
          </p>
        </div>
        <Badge
          variant={submission.pipeline === "debut" ? "destructive" : "secondary"}
        >
          {submission.pipeline === "debut" ? "Debut" : "Chapter"}
        </Badge>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,420px)] xl:items-start xl:gap-8">
        <div className="space-y-5">
          <Card className="border-border/70 dark:bg-zinc-950/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Series metadata</CardTitle>
              <CardDescription>
                Chỉnh nhanh thông tin series khi duyệt debut.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tantou-story-title">Story title</Label>
                <Input
                  id="tantou-story-title"
                  value={draft.storyTitle}
                  onChange={(e) =>
                    setDraft((c) => ({ ...c, storyTitle: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tantou-author">Author</Label>
                <Input
                  id="tantou-author"
                  value={draft.authorName}
                  onChange={(e) =>
                    setDraft((c) => ({ ...c, authorName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Genres</Label>
                <GenrePicker
                  selectedGenres={draft.genres}
                  onToggle={toggleGenre}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tantou-synopsis">Synopsis</Label>
                <Textarea
                  id="tantou-synopsis"
                  value={draft.synopsis}
                  onChange={(e) =>
                    setDraft((c) => ({ ...c, synopsis: e.target.value }))
                  }
                  className="min-h-24 resize-y dark:bg-zinc-900/80"
                />
              </div>
            </CardContent>
          </Card>

          <ChapterListTable
            rows={chapterRows}
            activeId={submission.id}
            viewingId={viewingChapterId}
            onOpen={handleOpenChapter}
          />

          {viewingSubmission ? (
            <ChapterReaderPanel
              ref={readerRef}
              submission={viewingSubmission}
              onClose={() => setViewingChapterId(null)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              Chọn <strong>Mở</strong> trong danh sách chapter để xem trang truyện
              cần nhận xét.
            </div>
          )}
        </div>

        <div className="min-h-0 xl:sticky xl:top-20 xl:z-10 xl:self-start">
          <ReviewRatingPanel
            submission={submission}
            draft={draft}
            averageScore={averageScore}
            onRatingChange={updateRating}
            onReviewTextChange={(text) =>
              setDraft((c) => ({ ...c, reviewText: text }))
            }
            onStatusChange={(reviewStatus) =>
              setDraft((c) => ({ ...c, reviewStatus }))
            }
            onCancel={onCancel}
            onSave={() => onSaveReview(buildPayload())}
            onSaveAndNext={() =>
              onSaveReview(buildPayload(), { advanceNext: true })
            }
            hasNextChapter={!!nextPending}
          />
        </div>
      </div>
    </div>
  );
}
