import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  ListChecks,
  PenSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Workflow,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { WorkspaceHero } from "@/components/layout/WorkspaceHero.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSession, logout } from "@/lib/auth.js";
import { cn } from "@/lib/utils";
import ChapterAnnotator from "./ChapterAnnotator.jsx";
import AddSeriesModal from "./AddSeriesModal.jsx";
import MangakaAssistants from "./MangakaAssistants.jsx";
import { seriesPath } from "./SeriesUploadDetail.jsx";
import {
  LABEL_EDITOR_BOARD,
  LABEL_TANTOU_EDITOR,
  PATH_EDITOR_BOARD,
  PATH_TANTOU_EDITOR,
} from "@/constants/roleTerminology.js";
import {
  readEbDebutApproved,
  removeEbDebutApproval,
  syncEbDebutPendingFromSeries,
} from "@/utils/ebDebutStorage.js";
import {
  loadMangakaWorkspaceState,
  persistMangakaWorkspaceState,
  persistMangakaWorkspaceStateNow,
} from "@/utils/mangakaWorkspaceStorage.js";
import {
  readMangakaWorkspace,
  resolveAnnotatorChapter,
} from "@/utils/mangakaWorkspaceReader.js";
import {
  buildSubmissionFromMangakaPage,
  getAssistantSubmission,
  getPendingDeliverableForMangaka,
  pushAssistantSubmission,
  hydrateAssistantDeliverable,
  migrateAssistantStorage,
  updateDeliverableStatus,
} from "@/utils/assistantWorkspaceStorage.js";
import {
  listTantouSubmissions,
  pushTantouSubmissionFromMangaka,
} from "@/utils/tantouWorkspaceStorage.js";
import { getActiveAssigneesForMangaka } from "@/utils/assistantRosterStorage.js";
import {
  applySeriesFormUpdate,
  buildSeriesFromForm,
  buildSeriesFromUploadTitle,
  formatSeriesCardLine,
  normalizeSeriesList,
  seriesToExternalSummary,
  slugifySeriesTitle,
} from "@/utils/seriesModel.js";
import "@/styles/mangaPage.css";
import "./Mangaka.css";

const NAV_LINKS = [{ to: "/", label: "Trang chủ" }];

const STAT_DEFS = [
  { label: "Series draft", icon: BookOpen, color: "rose" },
  { label: "Chapter đã upload", icon: FileText, color: "sky" },
  { label: "Chờ Assistant", icon: ImageIcon, color: "violet" },
  { label: "Chờ duyệt bản tổng hợp", icon: ClipboardCheck, color: "amber" },
];

const STATUS_BADGE = {
  draft: {
    label: "Nháp",
    className:
      "bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/15 dark:text-zinc-400",
  },
  assistant: {
    label: "Chờ Assistant",
    className:
      "bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400",
  },
  review: {
    label: "Chờ duyệt",
    className:
      "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400",
  },
  tantou: {
    label: `Chờ ${LABEL_TANTOU_EDITOR}`,
    className:
      "bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400",
  },
  done: {
    label: "Hoàn tất",
    className:
      "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
};

const INITIAL_SERIES = normalizeSeriesList([
  {
    id: 1,
    title: "One Thorn",
    altTitle: "One Thorn",
    synopsis:
      "Hành trình của nhóm thám hiểm trong thế giới hậu tận thế, tìm manh mối về cây gai đen huyền thoại.",
    genres: ["Phiêu lưu", "Huyền ảo"],
    demographic: "shonen",
    format: "manga",
    language: "vi",
    contentRating: "teen",
    publicationStatus: "ongoing",
    publishType: "continuing",
    chapters: 5,
    marks: 2,
    status: "assistant",
    updated: "2 giờ trước",
    color: "#e63946",
    progress: 72,
    authorName: "Demo Mangaka",
  },
  {
    id: 2,
    title: "Ma Đạo",
    synopsis:
      "Tu tiên giả trẻ dấn thân vào ma đạo để cứu làng quê — ranh giới thiện ác bị xóa nhòa.",
    genres: ["Võ thuật", "Drama"],
    demographic: "seinen",
    format: "manhua",
    language: "vi",
    contentRating: "mature",
    publicationStatus: "ongoing",
    publishType: "continuing",
    chapters: 3,
    marks: 4,
    status: "draft",
    updated: "1 ngày trước",
    color: "#9b5de5",
    progress: 35,
  },
  {
    id: 3,
    title: "Vô Lượng",
    synopsis:
      "Đạo sĩ mù và đệ tử lang thang giải oan nghiệt — từng arc một bí ẩn lớn hơn.",
    genres: ["Kinh dị", "Đời thường"],
    demographic: "seinen",
    format: "manga",
    language: "vi",
    publicationStatus: "ongoing",
    publishType: "continuing",
    chapters: 2,
    marks: 0,
    status: "review",
    updated: "3 giờ trước",
    color: "#f4a261",
    progress: 90,
  },
]);

const INITIAL_CHAPTERS = [
  {
    id: 1,
    series: "One Thorn",
    num: 12,
    type: "PNG",
    pages: 24,
    status: "assistant",
    date: "14/05/2026",
  },
  {
    id: 2,
    series: "One Thorn",
    num: 11,
    type: "PNG",
    pages: 18,
    status: "done",
    date: "10/05/2026",
  },
  {
    id: 3,
    series: "Ma Đạo",
    num: 3,
    type: "JPG",
    pages: 15,
    status: "draft",
    date: "12/05/2026",
  },
];

const DEMO_ANNOTATOR_PAGES = [
  { id: "demo-1", name: "Trang 1 (mẫu)", url: null },
  { id: "demo-2", name: "Trang 2 (mẫu)", url: null },
];

const INITIAL_ANNOTATOR_CHAPTERS = [
  {
    id: "ch-demo",
    series: "One Thorn",
    num: "12",
    pages: DEMO_ANNOTATOR_PAGES,
    createdAt: "14/05/2026",
  },
];

const INITIAL_ANNOTATOR_NOTES = {
  "ch-demo-0": [
    {
      id: "n1",
      x: 12,
      y: 18,
      w: 28,
      h: 22,
      text: "Vẽ nền trời, hoàng hôn",
      taskType: "background",
      assignee: "Assistant A",
    },
    {
      id: "n2",
      x: 55,
      y: 45,
      w: 35,
      h: 30,
      text: "Thêm cây cối hai bên đường",
      taskType: "fx",
      assignee: "Assistant B",
    },
  ],
};

const DEMO_SERIES_RANKINGS = [
  {
    title: "One Thorn",
    rank: 4,
    delta: "↑2",
    reads: "12.4K",
    atRisk: true,
    riskReason: "Lượt đọc giảm 18% trong 2 tuần",
  },
  { title: "Ma Đạo", rank: 11, delta: "↓1", reads: "3.1K", atRisk: false },
];

const PIPELINE_DEBUT_STEPS = [
  { step: 1, title: "Mangaka → Assistant", desc: "Gửi bản thảo & ô ghi chú" },
  {
    step: 2,
    title: "Assistant → Mangaka",
    desc: "Nhận bản vẽ, bạn duyệt / yêu cầu sửa",
  },
  {
    step: 3,
    title: `Mangaka → ${LABEL_TANTOU_EDITOR}`,
    desc: "Chuyển bản đã duyệt sang Tantou Editor",
  },
  {
    step: 4,
    title: `${LABEL_TANTOU_EDITOR} → ${LABEL_EDITOR_BOARD}`,
    desc: "Tantou Editor duyệt rồi đưa lên Editor Board",
  },
  {
    step: 5,
    title: `${LABEL_EDITOR_BOARD} biểu quyết`,
    desc: "Editor Board chấp nhận → thông báo Mangaka",
  },
  {
    step: 6,
    title: "Xuất bản",
    desc: "Phát hành sau khi Editor Board đồng thuận",
  },
];

const PIPELINE_RECURRING_STEPS = [
  {
    step: 1,
    title: `Mangaka → ${LABEL_TANTOU_EDITOR}`,
    desc: "Gửi chapter / bản thảo",
  },
  {
    step: 2,
    title: `${LABEL_TANTOU_EDITOR} duyệt`,
    desc: "Chỉnh sửa & phê duyệt",
  },
  { step: 3, title: "Xuất bản", desc: `Không cần vòng ${LABEL_EDITOR_BOARD}` },
];

const TAB_ITEMS = [
  { id: "series", label: "Series draft", icon: BookOpen },
  { id: "chapters", label: "Chapter", icon: FileText },
  { id: "assistants", label: "Thuê Assistant", icon: UserPlus },
  { id: "annotate", label: "Upload & Ghi chú", icon: PenSquare },
];

function createMangakaWorkspaceDefaults() {
  return {
    tab: "series",
    annotateSeries: "One Thorn",
    seriesList: INITIAL_SERIES,
    chapterRows: INITIAL_CHAPTERS.map((c) => ({ ...c })),
    annotatorChapters: INITIAL_ANNOTATOR_CHAPTERS.map((c) => ({
      ...c,
      pages: c.pages.map((p) => ({ ...p })),
    })),
    annotatorNotes: JSON.parse(JSON.stringify(INITIAL_ANNOTATOR_NOTES)),
    annotatorActiveChapterId: "ch-demo",
    annotatorPageIndex: 0,
    annotatorChapterNum: "12",
    annotatorPagesPerChapter: "",
    annotatorUploadPageBudget: "",
  };
}

function resolveAnnotatorActiveChapterId(chapters, preferredId) {
  if (chapters.some((c) => c.id === preferredId)) return preferredId;
  return chapters[0]?.id ?? "ch-demo";
}

const STAT_ICON_BG = {
  rose: "bg-rose-500/10 text-rose-600",
  sky: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
  amber: "bg-amber-500/10 text-amber-600",
};

function StatCard({ def, value, trend }) {
  const Icon = def.icon;
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {def.label}
          </p>
          <div className="text-3xl font-bold tracking-tight">{value}</div>
          <p className="text-xs text-muted-foreground">{trend}</p>
        </div>
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-xl",
            STAT_ICON_BG[def.color],
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function SeriesCard({
  series,
  ebApproved,
  uploadPct,
  onOpenAnnotate,
  onOpenEdit,
  onDelete,
  onCompleteDebut,
}) {
  const isUploading = uploadPct > 0 && uploadPct < 100;
  const barPct = isUploading ? uploadPct : Math.min(100, series.progress ?? 0);
  const toSeries = seriesPath(series);
  const statusBadge = STATUS_BADGE[series.status] ?? STATUS_BADGE.draft;
  const initials = (
    series.title.length >= 2 ? series.title : `${series.title}●`
  ).slice(0, 2);

  return (
    <Card className="group relative gap-0 overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: series.color }}
      />
      {series.needsFullDebutPipeline ? (
        <Badge
          className="absolute right-3 top-3 z-10 bg-amber-500 text-white hover:bg-amber-500"
          title={`Series lần đầu: đủ vòng ${LABEL_EDITOR_BOARD}.`}
        >
          <Sparkles className="size-3" />
          Lần đầu
        </Badge>
      ) : null}

      <Link
        to={toSeries}
        className="flex aspect-[16/7] items-center justify-center text-3xl font-extrabold tracking-tight text-white transition-transform group-hover:scale-[1.02]"
        style={{
          background: `linear-gradient(135deg, ${series.color}, ${series.color}88)`,
        }}
      >
        <span className="drop-shadow-lg">{initials}</span>
      </Link>

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={toSeries}
            className="line-clamp-1 font-semibold hover:underline"
            title={series.title}
          >
            {series.title}
          </Link>
          <Badge className={statusBadge.className} variant="secondary">
            {series.statusLabel ?? statusBadge.label}
          </Badge>
        </div>

        <p className="line-clamp-1 text-xs text-muted-foreground">
          {formatSeriesCardLine(series)}
        </p>
        {series.ebAssessment ? (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-950 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                EB đánh giá
              </span>
              <Badge
                variant="outline"
                className="border-emerald-300 bg-white/80 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              >
                DTB {Number(series.ebAssessment.average ?? 0).toFixed(1)} ·{" "}
                {series.ebAssessment.classification ?? "N/A"}
              </Badge>
            </div>
            <p className="line-clamp-2 text-xs text-emerald-900/80 dark:text-emerald-100/85">
              {series.ebAssessment.classificationNote ??
                "Chưa có ghi chú từ Editor Board."}
            </p>
            {Array.isArray(series.ebAssessment.summaryNotes) &&
            series.ebAssessment.summaryNotes.length > 0 ? (
              <p className="line-clamp-2 text-xs text-emerald-900/70 dark:text-emerald-100/75">
                {series.ebAssessment.summaryNotes.slice(0, 2).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {!series.metadataComplete ? (
          <p className="flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="size-3" />
            Thiếu mô tả hồ sơ
          </p>
        ) : null}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{series.chapters} ch</span>
          <span>·</span>
          <span>{series.marks} vùng ghi chú</span>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{isUploading ? "Đang tải chapter" : "Tiến độ"}</span>
            <span className="font-medium tabular-nums">
              {Math.round(barPct)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${barPct}%`, background: series.color }}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{series.updated}</p>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t bg-muted/30 p-3">
        <div className="flex w-full flex-wrap gap-1.5">
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link to={toSeries}>Xem truyện</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenEdit}>
            Chỉnh sửa
          </Button>
          {series.status === "draft" ? (
            <Button size="sm" variant="ghost" onClick={onOpenAnnotate}>
              Đánh dấu vùng
            </Button>
          ) : null}
        </div>

        {series.needsFullDebutPipeline && !ebApproved ? (
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="w-full bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300"
          >
            <Link to={PATH_EDITOR_BOARD}>
              <Sparkles className="size-3.5" />
              Chờ {LABEL_EDITOR_BOARD} duyệt
            </Link>
          </Button>
        ) : null}

        {series.needsFullDebutPipeline && ebApproved ? (
          <Button size="sm" className="w-full" onClick={onCompleteDebut}>
            <CheckCircle2 className="size-3.5" />
            Hoàn tất vòng đầu
          </Button>
        ) : null}

        <div className="flex w-full justify-end">
          <Button
            size="xs"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-3" />
            Xóa
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function Mangaka() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getSession();
  const mangakaId = user?.id ?? "demo-mangaka";
  const mangakaName = user?.name ?? "Demo Mangaka";
  const wsDefaults = useMemo(() => createMangakaWorkspaceDefaults(), []);
  const hydrated = useMemo(
    () => loadMangakaWorkspaceState(wsDefaults),
    [wsDefaults],
  );

  const [tab, setTab] = useState(() => hydrated.tab);
  const [annotateSeries, setAnnotateSeries] = useState(
    () => hydrated.annotateSeries,
  );
  const [seriesList, setSeriesList] = useState(() => hydrated.seriesList);
  const [addSeriesOpen, setAddSeriesOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState(null);
  const [chapterRows, setChapterRows] = useState(() => hydrated.chapterRows);
  const [uploadPctBySeries, setUploadPctBySeries] = useState({});
  const [annotatorChapters, setAnnotatorChapters] = useState(
    () => hydrated.annotatorChapters,
  );
  const [annotatorNotes, setAnnotatorNotes] = useState(
    () => hydrated.annotatorNotes,
  );
  const [annotatorActiveChapterId, setAnnotatorActiveChapterId] = useState(() =>
    resolveAnnotatorActiveChapterId(
      hydrated.annotatorChapters,
      hydrated.annotatorActiveChapterId,
    ),
  );
  const [annotatorPageIndex, setAnnotatorPageIndex] = useState(
    () => hydrated.annotatorPageIndex,
  );
  const [annotatorChapterNum, setAnnotatorChapterNum] = useState(
    () => hydrated.annotatorChapterNum,
  );
  const [annotatorPagesPerChapter, setAnnotatorPagesPerChapter] = useState(
    () => hydrated.annotatorPagesPerChapter,
  );
  const [annotatorUploadPageBudget, setAnnotatorUploadPageBudget] = useState(
    () => hydrated.annotatorUploadPageBudget,
  );
  const [ebApprovedTick, setEbApprovedTick] = useState(0);
  const [deliverableTick, setDeliverableTick] = useState(0);
  const [tantouTick, setTantouTick] = useState(0);
  const [tantouSendReady, setTantouSendReady] = useState(null);
  const [rosterTick, setRosterTick] = useState(0);

  const hiredAssistants = useMemo(() => {
    void rosterTick;
    return getActiveAssigneesForMangaka(mangakaId);
  }, [mangakaId, rosterTick]);

  const statValues = useMemo(() => {
    const pendingAssistant = chapterRows.filter(
      (c) => c.status === "assistant",
    ).length;
    const pendingComposite = chapterRows.filter(
      (c) => c.status === "review",
    ).length;
    return [
      { value: String(seriesList.length), trend: "Hồ sơ trong workspace" },
      {
        value: String(chapterRows.length),
        trend: `${chapterRows.length} dòng trong bảng Chapter`,
      },
      {
        value: String(pendingAssistant),
        trend: pendingAssistant > 0 ? "Đang gửi Assistant" : "Không có",
      },
      {
        value: String(pendingComposite),
        trend: pendingComposite > 0 ? "Cần duyệt" : "Không có",
      },
    ];
  }, [seriesList.length, chapterRows]);

  const nextChapterNumSuggest = useMemo(() => {
    const rows = chapterRows.filter(
      (c) => String(c.series) === String(annotateSeries),
    );
    const nums = rows
      .map((r) => {
        const n =
          typeof r.num === "number" ? r.num : parseInt(String(r.num), 10);
        return Number.isNaN(n) ? null : n;
      })
      .filter((n) => n !== null);
    if (!nums.length) return "1";
    return String(Math.max(...nums) + 1);
  }, [chapterRows, annotateSeries]);

  const annotateChapterHint = useMemo(() => {
    const n = chapterRows.filter((c) => c.series === annotateSeries).length;
    const tail = n
      ? `${n} dòng trong bảng Chapter`
      : "Chưa có dòng trong bảng Chapter";
    return `Gợi ý tiếp theo Ch. ${nextChapterNumSuggest} · ${tail}`;
  }, [chapterRows, annotateSeries, nextChapterNumSuggest]);

  const chapterRowsBySeries = useMemo(() => {
    const order = [];
    const map = new Map();
    for (const row of chapterRows) {
      const key = row.series || "Khác";
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key).push(row);
    }
    return order.map((series) => ({ series, chapters: map.get(series) }));
  }, [chapterRows]);

  const pipelineSeries = useMemo(
    () => seriesList.find((s) => s.title === annotateSeries) ?? seriesList[0],
    [seriesList, annotateSeries],
  );

  const pendingDeliverableSlim = useMemo(
    () => getPendingDeliverableForMangaka(),
    [deliverableTick, chapterRows],
  );
  const [pendingDeliverable, setPendingDeliverable] = useState(null);
  useEffect(() => {
    if (!pendingDeliverableSlim) {
      setPendingDeliverable(null);
      return undefined;
    }
    let cancelled = false;
    hydrateAssistantDeliverable(pendingDeliverableSlim).then((h) => {
      if (!cancelled) setPendingDeliverable(h);
    });
    return () => {
      cancelled = true;
    };
  }, [pendingDeliverableSlim]);

  const pendingCompositeReview = useMemo(() => {
    const head = pendingDeliverable ?? pendingDeliverableSlim;
    if (head) {
      return (
        chapterRows.find(
          (r) =>
            r.series === head.seriesTitle &&
            String(r.num) === String(head.chapterNum),
        ) ?? {
          id: head.chapterId,
          series: head.seriesTitle,
          num: head.chapterNum,
          status: "assistant",
        }
      );
    }
    return chapterRows.find(
      (r) => r.status === "assistant" || r.status === "review",
    );
  }, [chapterRows, pendingDeliverable, pendingDeliverableSlim]);

  const seriesRankings = useMemo(() => {
    const titles = new Set(seriesList.map((s) => s.title));
    return DEMO_SERIES_RANKINGS.filter((r) => titles.has(r.title));
  }, [seriesList]);

  const atRiskSeries = useMemo(
    () => seriesRankings.filter((r) => r.atRisk),
    [seriesRankings],
  );

  const ebApprovedMap = useMemo(
    () => readEbDebutApproved(),
    [ebApprovedTick, seriesList],
  );

  function handleSendToAssistant({
    chapter,
    pageIndex,
    pageUrl,
    pageName,
    notes,
  }) {
    if (!notes?.length) return;
    const submission = buildSubmissionFromMangakaPage({
      seriesTitle: chapter.series,
      chapterId: chapter.id,
      chapterNum: chapter.num,
      pageIndex,
      pageName,
      mangakaImageUrl: pageUrl,
      notes,
      mangakaName: user?.name ?? "Mangaka",
    });
    void pushAssistantSubmission(submission);
    setChapterRows((prev) =>
      prev.map((r) =>
        r.series === chapter.series && String(r.num) === String(chapter.num)
          ? { ...r, status: "assistant", statusLabel: "Chờ Assistant" }
          : r,
      ),
    );
    toast.success(
      `Đã gửi ${submission.pageLabel} (${notes.length} ô ghi chú) cho Assistant.`,
    );
  }

  function sendChapterToTantou({
    series,
    chapter,
    pageIndex = 0,
    pageName,
    notes = [],
    imageOverride,
  }) {
    if (!chapter?.series) return;
    const ebOk = !!ebApprovedMap[series?.title ?? chapter.series];
    const pipeline =
      series?.needsFullDebutPipeline && !ebOk ? "debut" : "recurring";
    const rank = DEMO_SERIES_RANKINGS.find((r) => r.title === chapter.series);
    const sub = pushTantouSubmissionFromMangaka({
      seriesTitle: chapter.series,
      seriesMeta: {
        genres: series?.genres ?? [],
        formatLabel: series?.formatLabel ?? "Manga",
        authorName: user?.name ?? "Mangaka",
        qualityScore: rank ? 74 : 70,
        popularityScore: rank ? 68 : 62,
        needsFullDebutPipeline: series?.needsFullDebutPipeline,
      },
      chapterId: chapter.id,
      chapterNum: chapter.num,
      pageIndex,
      pageName,
      mangakaImageUrl: imageOverride,
      mangakaNotes: notes,
      mangakaName: user?.name ?? "Mangaka",
      pipeline,
    });
    setChapterRows((prev) =>
      prev.map((r) =>
        r.series === chapter.series && String(r.num) === String(chapter.num)
          ? {
              ...r,
              status: "tantou",
              statusLabel: `Chờ ${LABEL_TANTOU_EDITOR}`,
            }
          : r,
      ),
    );
    toast.success(`Đã gửi ${sub.pageLabel} sang ${LABEL_TANTOU_EDITOR}.`);
    setTantouSendReady(null);
  }

  function handleSendToTantou({
    chapter,
    pageIndex,
    pageUrl,
    pageName,
    notes,
  }) {
    const series = seriesList.find((s) => s.title === chapter.series);
    sendChapterToTantou({
      series,
      chapter,
      pageIndex,
      pageName,
      notes,
      imageOverride: pageUrl,
    });
  }

  function handleSendTantouFromReady() {
    if (!tantouSendReady) return;
    const { deliverable, chapter, notes } = tantouSendReady;
    const series = seriesList.find((s) => s.title === chapter.series);
    sendChapterToTantou({
      series,
      chapter,
      pageIndex: deliverable.pageIndex ?? 0,
      pageName: deliverable.pageLabel,
      notes,
      imageOverride:
        deliverable.compositeDataUrl || deliverable.mangakaImageUrl,
    });
  }

  function handleCompositeDecision(decision) {
    if (!pendingCompositeReview) return;
    const deliverableForDecision = pendingDeliverable ?? pendingDeliverableSlim;
    if (deliverableForDecision) {
      if (decision === "approve") {
        const notes = deliverableForDecision.submissionId
          ? (getAssistantSubmission(deliverableForDecision.submissionId)
              ?.notes ?? [])
          : [];
        setTantouSendReady({
          deliverable: { ...deliverableForDecision },
          chapter: { ...pendingCompositeReview },
          notes,
        });
      }
      updateDeliverableStatus(
        deliverableForDecision.id,
        decision === "approve" ? "approved" : "revision_requested",
      );
      setDeliverableTick((t) => t + 1);
    }
    setChapterRows((prev) =>
      prev.map((r) => {
        if (r.id !== pendingCompositeReview.id) return r;
        if (decision === "approve") {
          return { ...r, status: "done", statusLabel: "Đã duyệt bản tổng hợp" };
        }
        return { ...r, status: "review", statusLabel: "Yêu cầu chỉnh sửa" };
      }),
    );
  }

  const tantouRevisions = useMemo(
    () => listTantouSubmissions().filter((s) => s.status === "revision"),
    [tantouTick],
  );

  useEffect(() => {
    const onSync = () => setDeliverableTick((t) => t + 1);
    migrateAssistantStorage().finally(onSync);
    window.addEventListener("storage", onSync);
    window.addEventListener("mk-assistant-storage", onSync);
    return () => {
      window.removeEventListener("storage", onSync);
      window.removeEventListener("mk-assistant-storage", onSync);
    };
  }, []);

  useEffect(() => {
    const onRoster = () => setRosterTick((t) => t + 1);
    window.addEventListener("storage", onRoster);
    window.addEventListener("mk-assistant-roster-update", onRoster);
    return () => {
      window.removeEventListener("storage", onRoster);
      window.removeEventListener("mk-assistant-roster-update", onRoster);
    };
  }, []);

  useEffect(() => {
    const onTantou = () => setTantouTick((t) => t + 1);
    window.addEventListener("mk-tantou-storage", onTantou);
    return () => window.removeEventListener("mk-tantou-storage", onTantou);
  }, []);

  useEffect(() => {
    const onWorkspaceUpdate = () => {
      const next = readMangakaWorkspace();
      setSeriesList(next.seriesList);
    };
    window.addEventListener("mk-workspace-update", onWorkspaceUpdate);
    return () =>
      window.removeEventListener("mk-workspace-update", onWorkspaceUpdate);
  }, []);

  const workflowSteps = useMemo(() => {
    if (!pipelineSeries) return PIPELINE_DEBUT_STEPS;
    return pipelineSeries.needsFullDebutPipeline
      ? PIPELINE_DEBUT_STEPS
      : PIPELINE_RECURRING_STEPS;
  }, [pipelineSeries]);

  useEffect(() => {
    const pending = seriesList
      .filter((s) => s.needsFullDebutPipeline)
      .map(seriesToExternalSummary);
    syncEbDebutPendingFromSeries(pending);
  }, [seriesList]);

  useEffect(() => {
    function bumpEbApproved() {
      setEbApprovedTick((t) => t + 1);
    }
    window.addEventListener("mk-eb-approved-update", bumpEbApproved);
    window.addEventListener("storage", bumpEbApproved);
    return () => {
      window.removeEventListener("mk-eb-approved-update", bumpEbApproved);
      window.removeEventListener("storage", bumpEbApproved);
    };
  }, []);

  useEffect(() => {
    setAnnotatorChapterNum(nextChapterNumSuggest);
  }, [annotateSeries, nextChapterNumSuggest]);

  useEffect(() => {
    if (seriesList.length === 0) {
      setAnnotateSeries("");
      return;
    }
    if (
      !annotateSeries ||
      !seriesList.some((s) => s.title === annotateSeries)
    ) {
      setAnnotateSeries(seriesList[0].title);
    }
  }, [seriesList, annotateSeries]);

  useEffect(() => {
    const marksBySeries = {};
    annotatorChapters.forEach((ch) => {
      let c = 0;
      ch.pages.forEach((_, pi) => {
        c += annotatorNotes[`${ch.id}-${pi}`]?.length ?? 0;
      });
      marksBySeries[ch.series] = (marksBySeries[ch.series] ?? 0) + c;
    });
    setSeriesList((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        const nextMarks = marksBySeries[s.title];
        if (nextMarks === undefined) return s;
        if (s.marks !== nextMarks) {
          changed = true;
          return { ...s, marks: nextMarks };
        }
        return s;
      });
      return changed ? next : prev;
    });
  }, [annotatorChapters, annotatorNotes]);

  const workspaceSnapshot = useMemo(
    () => ({
      tab,
      annotateSeries,
      seriesList,
      chapterRows,
      annotatorChapters,
      annotatorNotes,
      annotatorActiveChapterId,
      annotatorPageIndex,
      annotatorChapterNum,
      annotatorPagesPerChapter,
      annotatorUploadPageBudget,
    }),
    [
      tab,
      annotateSeries,
      seriesList,
      chapterRows,
      annotatorChapters,
      annotatorNotes,
      annotatorActiveChapterId,
      annotatorPageIndex,
      annotatorChapterNum,
      annotatorPagesPerChapter,
      annotatorUploadPageBudget,
    ],
  );

  useEffect(() => {
    persistMangakaWorkspaceState(workspaceSnapshot);
  }, [workspaceSnapshot]);

  function handleUploadProgress(series, pct) {
    const key = series.trim();
    if (!key) return;
    if (pct === 0 || pct === undefined) {
      setUploadPctBySeries((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setUploadPctBySeries((prev) => ({ ...prev, [key]: pct }));
  }

  function handleUploadComplete(payload) {
    const {
      series: titleRaw,
      num,
      pages,
      createdAt,
      chapterLocalId,
      isNewChapter,
      annotatorChapters: nextAnnotatorChapters,
    } = payload;
    const title = typeof titleRaw === "string" ? titleRaw.trim() : titleRaw;
    if (!title) return;

    const rowId =
      chapterLocalId ||
      `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const displayNum =
      typeof num === "number" && Number.isFinite(num) ? num : num;
    const dateStr = createdAt ?? new Date().toLocaleDateString("vi-VN");

    const nextChapterRows = (() => {
      const idx = chapterRows.findIndex((r) => r.id === rowId);
      if (idx >= 0) {
        return chapterRows.map((r, i) =>
          i === idx ? { ...r, pages, date: dateStr } : r,
        );
      }
      return [
        {
          id: rowId,
          series: title,
          num: displayNum,
          type: "PNG",
          pages,
          status: "draft",
          date: dateStr,
        },
        ...chapterRows,
      ];
    })();

    setChapterRows(nextChapterRows);

    setSeriesList((prev) => {
      const idx = prev.findIndex((s) => s.title === title);
      const bump = Math.min(22, Math.max(10, Math.round((pages ?? 18) / 5)));
      if (idx === -1) {
        const maxId = prev.reduce((m, s) => Math.max(m, s.id), 0);
        const created = buildSeriesFromUploadTitle(title, {
          id: maxId + 1,
          authorName: user?.name,
          colorIndex: maxId,
        });
        return [
          { ...created, chapters: 1, progress: Math.min(100, bump + 18) },
          ...prev,
        ];
      }
      return prev.map((s, i) => {
        if (i !== idx) return s;
        const nextCount = isNewChapter
          ? (s.chapters ?? 0) + 1
          : (s.chapters ?? 0);
        return {
          ...s,
          chapters: nextCount,
          progress: Math.min(
            99,
            (s.progress ?? 0) + (isNewChapter ? bump : Math.min(8, bump)),
          ),
          updated: "Vừa upload",
          statusLabel:
            s.status === "assistant" ? s.statusLabel : "Đã có upload",
          ...(s.status !== "assistant" && s.status !== "review"
            ? { status: "draft" }
            : {}),
        };
      });
    });

    void persistMangakaWorkspaceStateNow({
      ...workspaceSnapshot,
      chapterRows: nextChapterRows,
      annotatorChapters: Array.isArray(nextAnnotatorChapters)
        ? nextAnnotatorChapters
        : annotatorChapters,
    });
  }

  useEffect(() => {
    if (!addSeriesOpen) return;
    function onKey(e) {
      if (e.key === "Escape") setAddSeriesOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addSeriesOpen]);

  function openAddSeriesModal() {
    setEditingSeries(null);
    setAddSeriesOpen(true);
  }
  function openEditSeriesModal(series) {
    setEditingSeries(series);
    setAddSeriesOpen(true);
  }
  function closeAddSeriesModal() {
    setAddSeriesOpen(false);
    setEditingSeries(null);
  }

  function confirmUpdateSeries(form) {
    if (!editingSeries) return;
    const oldTitle = editingSeries.title;
    const updated = applySeriesFormUpdate(
      seriesList.find((s) => s.id === editingSeries.id) ?? editingSeries,
      form,
    );
    const newTitle = updated.title;

    setSeriesList((prev) => {
      const next = prev.map((s) => (s.id === editingSeries.id ? updated : s));
      syncEbDebutPendingFromSeries(
        next
          .filter((s) => s.needsFullDebutPipeline)
          .map(seriesToExternalSummary),
      );
      return next;
    });

    if (oldTitle !== newTitle) {
      setChapterRows((prev) =>
        prev.map((c) =>
          c.series === oldTitle ? { ...c, series: newTitle } : c,
        ),
      );
      setAnnotatorChapters((prev) =>
        prev.map((ch) =>
          ch.series === oldTitle ? { ...ch, series: newTitle } : ch,
        ),
      );
      if (annotateSeries === oldTitle) setAnnotateSeries(newTitle);
    }

    closeAddSeriesModal();
    navigate(seriesPath(updated));
  }

  function confirmAddSeries(form) {
    const maxId = seriesList.reduce((m, s) => Math.max(m, s.id), 0);
    const newSeries = buildSeriesFromForm(form, {
      id: maxId + 1,
      authorName: user?.name,
      authorId: user?.email ?? null,
    });
    setSeriesList((prev) => [newSeries, ...prev]);
    setAnnotateSeries(newSeries.title);
    closeAddSeriesModal();
    navigate(seriesPath(newSeries));
  }

  const existingSeriesTitles = useMemo(
    () => seriesList.map((s) => s.title),
    [seriesList],
  );

  function completeDebutPipeline(seriesId) {
    const target = seriesList.find((x) => x.id === seriesId);
    if (target?.title) removeEbDebutApproval(target.title);
    setSeriesList((prev) =>
      prev.map((s) =>
        s.id === seriesId
          ? {
              ...s,
              needsFullDebutPipeline: false,
              statusLabel:
                s.status === "draft"
                  ? `Luồng ngắn (chỉ ${LABEL_TANTOU_EDITOR})`
                  : s.statusLabel,
              updated: "Đã chuyển sang luồng lần 2",
            }
          : s,
      ),
    );
  }

  function deleteSeriesById(seriesId) {
    const target = seriesList.find((x) => x.id === seriesId);
    if (!target) return;
    const title = target.title;
    const ok = window.confirm(
      `Xóa series "${title}"?\n\nCác chapter của series này sẽ bị gỡ. Thao tác không hoàn tác.`,
    );
    if (!ok) return;

    removeEbDebutApproval(title);

    const chaptersToDrop = annotatorChapters.filter(
      (ch) => ch.series === title,
    );
    chaptersToDrop.forEach((ch) => {
      ch.pages?.forEach((p) => {
        if (p?.url?.startsWith("blob:")) URL.revokeObjectURL(p.url);
      });
    });

    const nextAnnotator = annotatorChapters.filter((ch) => ch.series !== title);
    setAnnotatorChapters(nextAnnotator);
    setAnnotatorNotes((prev) => {
      const next = { ...prev };
      chaptersToDrop.forEach((ch) => {
        Object.keys(next).forEach((k) => {
          if (k.startsWith(`${ch.id}-`)) delete next[k];
        });
      });
      return next;
    });
    setAnnotatorActiveChapterId((prev) => {
      if (nextAnnotator.some((c) => c.id === prev)) return prev;
      return nextAnnotator[0]?.id ?? null;
    });
    setAnnotatorPageIndex(0);

    const remainingSeries = seriesList.filter((s) => s.id !== seriesId);
    setSeriesList(remainingSeries);
    setChapterRows((prev) => prev.filter((c) => c.series !== title));
    setUploadPctBySeries((prev) => {
      const next = { ...prev };
      delete next[title];
      return next;
    });
    setAnnotateSeries((cur) =>
      cur !== title ? cur : (remainingSeries[0]?.title ?? ""),
    );
  }

  useEffect(() => {
    const st = location.state;
    if (!st || typeof st !== "object") return;
    if (
      st.tab === "chapters" ||
      st.tab === "annotate" ||
      st.tab === "series" ||
      st.tab === "assistants"
    )
      setTab(st.tab);
    if (typeof st.series === "string" && st.series.trim())
      setAnnotateSeries(st.series.trim());
    if (typeof st.chapterId === "string" && st.chapterId) {
      setAnnotatorActiveChapterId(st.chapterId);
      setAnnotatorPageIndex(0);
    }
  }, [location.state]);

  function openAnnotate(seriesTitle, chapterLocalId) {
    setAnnotateSeries(seriesTitle);
    setTab("annotate");
    if (chapterLocalId) {
      setAnnotatorActiveChapterId(chapterLocalId);
      setAnnotatorPageIndex(0);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        className="from-rose-950 to-zinc-950"
        label="Mangaka Workspace"
        title={`Xin chào${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={`Tạo hồ sơ giới thiệu & nộp bản thảo lên ${LABEL_EDITOR_BOARD} · đánh dấu vùng giao việc cho Assistant · duyệt bản tổng hợp ngay trên trang.`}
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={openAddSeriesModal}
            className="bg-white text-zinc-900 hover:bg-zinc-100"
          >
            <Plus className="size-4" />
            Đăng ký series
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            disabled={seriesList.length === 0}
            onClick={() => seriesList[0] && openAnnotate(seriesList[0].title)}
          >
            <Upload className="size-4" />
            Upload chapter
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setTab("assistants")}
          >
            <UserPlus className="size-4" />
            Thuê Assistant
          </Button>
        </div>
      </WorkspaceHero>

      <main className="page-container flex-1 py-8">
        {tab !== "annotate" ? (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_DEFS.map((def, i) => (
              <StatCard
                key={def.label}
                def={def}
                value={statValues[i].value}
                trend={statValues[i].trend}
              />
            ))}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-5 h-auto flex-wrap">
                {TAB_ITEMS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <TabsTrigger key={t.id} value={t.id} className="gap-2">
                      <Icon className="size-4" />
                      {t.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="series" className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Series của tôi</h2>
                    <p className="text-sm text-muted-foreground">
                      Quản lý draft và luồng duyệt
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openAddSeriesModal}
                  >
                    <Plus className="size-4" />
                    Đăng ký series
                  </Button>
                </div>

                {seriesList.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Chưa có series nào — bấm "Đăng ký series" để bắt đầu.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {seriesList.map((s) => (
                      <SeriesCard
                        key={s.id}
                        series={s}
                        ebApproved={!!ebApprovedMap[s.title]}
                        uploadPct={uploadPctBySeries[s.title] ?? 0}
                        onOpenAnnotate={() => openAnnotate(s.title)}
                        onOpenEdit={() => openEditSeriesModal(s)}
                        onDelete={() => deleteSeriesById(s.id)}
                        onCompleteDebut={() => completeDebutPipeline(s.id)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="chapters" className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Chapter đã upload</h2>
                  <p className="text-sm text-muted-foreground">
                    Bấm tên truyện hoặc chapter để xem trang chi tiết.
                  </p>
                </div>

                {chapterRowsBySeries.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Chưa có chapter — upload ở tab Upload & Ghi chú.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {chapterRowsBySeries.map(
                      ({ series, chapters: groupChapters }) => {
                        const seriesMeta = seriesList.find(
                          (x) => x.title === series,
                        );
                        const slug =
                          seriesMeta?.slug ?? slugifySeriesTitle(series);
                        return (
                          <Card key={series} className="overflow-hidden p-0">
                            <Link
                              to={`/mangaka/series/${slug}`}
                              className="flex items-center gap-2 border-b bg-muted/30 px-5 py-3 transition-colors hover:bg-muted/50"
                            >
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{
                                  background: seriesMeta?.color ?? "#999",
                                }}
                              />
                              <strong className="text-sm">{series}</strong>
                              {seriesMeta?.needsFullDebutPipeline ? (
                                <Sparkles className="size-3.5 text-amber-500" />
                              ) : null}
                              <span className="ml-auto text-xs text-muted-foreground">
                                {groupChapters.length} chapter
                              </span>
                              <ChevronRight className="size-3.5 text-muted-foreground" />
                            </Link>
                            <div className="divide-y">
                              {groupChapters.map((c) => {
                                const annot = resolveAnnotatorChapter(
                                  c,
                                  annotatorChapters,
                                );
                                const thumbUrl = annot?.pages?.find(
                                  (p) => p?.url,
                                )?.url;
                                const statusBadge =
                                  STATUS_BADGE[c.status] ?? STATUS_BADGE.draft;
                                return (
                                  <Link
                                    key={c.id}
                                    to={`/mangaka/series/${slug}/chapter/${c.id}`}
                                    className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/30"
                                  >
                                    {thumbUrl ? (
                                      <span className="manga-page manga-page--thumb-sm shrink-0 overflow-hidden rounded">
                                        <img
                                          src={thumbUrl}
                                          alt=""
                                          className="manga-page__media"
                                        />
                                      </span>
                                    ) : (
                                      <span className="flex size-[52px] shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                                        Ch.{c.num}
                                      </span>
                                    )}
                                    <span className="font-medium">
                                      Ch. {c.num}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px]"
                                    >
                                      {c.type}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {c.pages} trang
                                    </span>
                                    <Badge
                                      className={statusBadge.className}
                                      variant="secondary"
                                    >
                                      {statusBadge.label}
                                    </Badge>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                      {c.date}
                                    </span>
                                    <ChevronRight className="size-3.5 text-muted-foreground" />
                                  </Link>
                                );
                              })}
                            </div>
                          </Card>
                        );
                      },
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assistants">
                <MangakaAssistants
                  mangakaId={mangakaId}
                  mangakaName={mangakaName}
                />
              </TabsContent>

              <TabsContent value="annotate">
                <ChapterAnnotator
                  selectedSeriesTitle={annotateSeries}
                  onSelectedSeriesTitleChange={setAnnotateSeries}
                  seriesOptions={seriesList.map((s) => ({
                    id: s.id,
                    title: s.title,
                    needsFullDebutPipeline: !!s.needsFullDebutPipeline,
                  }))}
                  chapterNum={annotatorChapterNum}
                  onChapterNumChange={setAnnotatorChapterNum}
                  chapterNumHint={annotateChapterHint}
                  chapters={annotatorChapters}
                  setChapters={setAnnotatorChapters}
                  activeChapterId={annotatorActiveChapterId}
                  setActiveChapterId={setAnnotatorActiveChapterId}
                  pageIndex={annotatorPageIndex}
                  setPageIndex={setAnnotatorPageIndex}
                  notes={annotatorNotes}
                  setNotes={setAnnotatorNotes}
                  hiredAssistants={hiredAssistants}
                  onOpenAssistantsTab={() => setTab("assistants")}
                  onUploadProgress={handleUploadProgress}
                  onUploadComplete={handleUploadComplete}
                  onSendToAssistant={handleSendToAssistant}
                  onSendToTantou={handleSendToTantou}
                />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Workflow className="size-4 text-primary" />
                  Quy trình làm việc
                </CardTitle>
                <CardDescription>
                  Theo series{" "}
                  <strong className="text-foreground">
                    {pipelineSeries?.title ?? "—"}
                  </strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge
                  className={
                    pipelineSeries?.needsFullDebutPipeline
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400"
                  }
                  variant="secondary"
                >
                  {pipelineSeries?.needsFullDebutPipeline
                    ? `✦ Lần đầu · có ${LABEL_EDITOR_BOARD}`
                    : `Lần 2+ · chỉ ${LABEL_TANTOU_EDITOR}`}
                </Badge>

                {pipelineSeries?.needsFullDebutPipeline &&
                pipelineSeries.title &&
                !ebApprovedMap[pipelineSeries.title] ? (
                  <p className="text-xs text-muted-foreground">
                    Chờ {LABEL_EDITOR_BOARD} duyệt vòng đầu —{" "}
                    <Link
                      to={PATH_EDITOR_BOARD}
                      className="font-medium text-primary hover:underline"
                    >
                      mở trang {LABEL_EDITOR_BOARD}
                    </Link>
                  </p>
                ) : null}

                <ol className="relative space-y-3 border-l border-muted pl-5">
                  {workflowSteps.map((w, i) => {
                    const isActive = i === 0;
                    return (
                      <li key={w.step} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[26px] flex size-5 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-card",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {w.step}
                        </span>
                        <p className="text-sm font-medium">{w.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {w.desc}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>

            {pendingCompositeReview ? (
              <Card className="border-primary/30 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardCheck className="size-4 text-primary" />
                    Bản tổng hợp từ Assistant
                  </CardTitle>
                  <CardDescription>
                    <strong className="text-foreground">
                      {pendingCompositeReview.series}
                    </strong>{" "}
                    · Ch. {pendingCompositeReview.num}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge
                    className={
                      pendingCompositeReview.status === "assistant"
                        ? STATUS_BADGE.assistant.className
                        : STATUS_BADGE.review.className
                    }
                    variant="secondary"
                  >
                    {pendingCompositeReview.status === "assistant"
                      ? "Chờ duyệt"
                      : "Chờ bạn phản hồi"}
                  </Badge>

                  <div className="overflow-hidden rounded-lg border bg-muted">
                    {pendingDeliverable?.compositeDataUrl ? (
                      <img
                        src={pendingDeliverable.compositeDataUrl}
                        alt={`Bản ghép ${pendingDeliverable.pageLabel}`}
                        className="w-full"
                      />
                    ) : pendingDeliverable?.overlayDataUrl ? (
                      <div className="relative">
                        {pendingDeliverable.mangakaImageUrl ? (
                          <img
                            src={pendingDeliverable.mangakaImageUrl}
                            alt="Ảnh gốc"
                            className="w-full"
                          />
                        ) : null}
                        <img
                          src={pendingDeliverable.overlayDataUrl}
                          alt="Layer Assistant"
                          className="absolute inset-0 w-full"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 p-6 text-center text-xs text-muted-foreground">
                        <ImageIcon className="size-6 opacity-40" />
                        <span>Chờ Assistant gửi layer</span>
                      </div>
                    )}
                  </div>

                  {pendingDeliverable ? (
                    <p className="text-xs text-muted-foreground">
                      {pendingDeliverable.pageLabel}
                      {pendingDeliverable.sendMode === "overlay"
                        ? " · Layer trong suốt"
                        : " · Bản ghép"}
                    </p>
                  ) : null}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCompositeDecision("approve")}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Phê duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleCompositeDecision("revision")}
                    >
                      Yêu cầu sửa
                    </Button>
                  </div>

                  {tantouSendReady ? (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleSendTantouFromReady}
                    >
                      <Send className="size-3.5" />
                      Gửi {LABEL_TANTOU_EDITOR}
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    disabled={seriesList.length === 0}
                    onClick={() => openAnnotate(pendingCompositeReview.series)}
                  >
                    Mở trên trang
                    <ArrowRight className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {tantouRevisions.length > 0 ? (
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="size-4 text-amber-600" />
                    Nhận xét từ {LABEL_TANTOU_EDITOR}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tantouRevisions.slice(0, 3).map((s) => (
                    <div key={s.id} className="rounded-lg border bg-card p-3">
                      <p className="text-sm font-semibold">{s.seriesTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        Ch. {s.chapterNum} · {s.pageLabel}
                      </p>
                      {s.editorialComment ? (
                        <p className="mt-1.5 line-clamp-3 text-xs">
                          {s.editorialComment}
                        </p>
                      ) : null}
                      <Link
                        to={PATH_TANTOU_EDITOR}
                        className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
                      >
                        Xem chi tiết
                        <ChevronRight className="size-3" />
                      </Link>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {tab !== "annotate" && seriesRankings.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="size-4 text-emerald-600" />
                    Bảng xếp hạng
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {seriesRankings.map((r) => (
                    <div
                      key={r.title}
                      className={cn(
                        "flex items-center gap-3 rounded-md border p-2.5",
                        r.atRisk &&
                          "border-amber-200 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5",
                      )}
                    >
                      <span className="flex size-7 items-center justify-center rounded-md bg-muted text-xs font-bold">
                        #{r.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {r.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.reads} đọc · {r.delta}
                        </p>
                      </div>
                    </div>
                  ))}
                  {atRiskSeries.length > 0 ? (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                      <p className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="size-3" />
                        Cảnh báo huỷ series
                      </p>
                      {atRiskSeries.map((r) => (
                        <p
                          key={r.title}
                          className="mt-1 text-amber-700 dark:text-amber-400"
                        >
                          {r.title}: {r.riskReason}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {tab !== "annotate" ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="size-4 text-primary" />
                    Mẹo nhanh
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Chọn loại việc (nền, tô bóng, hiệu ứng) cho từng vùng trước
                    khi gửi Assistant — giảm vòng chỉnh sửa.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={seriesList.length === 0}
                    onClick={() =>
                      seriesList[0] && openAnnotate(seriesList[0].title)
                    }
                  >
                    Bắt đầu ghi chú
                    <ArrowRight className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </main>

      <Footer />

      <AddSeriesModal
        open={addSeriesOpen}
        mode={editingSeries ? "edit" : "create"}
        initialSeries={editingSeries}
        onClose={closeAddSeriesModal}
        onSubmit={(form) =>
          editingSeries ? confirmUpdateSeries(form) : confirmAddSeries(form)
        }
        authorName={user?.name}
        existingTitles={existingSeriesTitles}
      />
    </div>
  );
}
