import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronRight,
  FileImage,
  ImageIcon,
  Inbox,
  PenSquare,
  Sparkles,
  Upload,
} from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { getSession, logout } from '@/lib/auth.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  formatSeriesCardLine,
  formatSeriesCatalogLine,
  formatSeriesRating,
  slugifySeriesTitle,
} from '@/utils/seriesModel.js'
import {
  readMangakaWorkspace,
  resolveAnnotatorChapter,
  updateSeriesInWorkspace,
} from '@/utils/mangakaWorkspaceReader.js'
import { LABEL_EDITOR_BOARD } from '@/constants/roleTerminology.js'
import AddSeriesModal from './AddSeriesModal.jsx'
import '@/styles/mangaPage.css'

const NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/mangaka', label: 'Workspace' },
]

const STATUS_BADGE = {
  draft: { label: 'Nháp', className: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/15 dark:text-zinc-400' },
  assistant: { label: 'Assistant', className: 'bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400' },
  review: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  tantou: { label: 'Tantou', className: 'bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400' },
  done: { label: 'Hoàn tất', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
}

function findSeriesBySlug(seriesList, slug) {
  if (!slug) return null
  return seriesList.find(s => s.slug === slug)
    ?? seriesList.find(s => slugifySeriesTitle(s.title) === slug)
    ?? null
}

function seriesPath(series) {
  const slug = series.slug ?? slugifySeriesTitle(series.title)
  return `/mangaka/series/${slug}`
}

function DetailShell({ children, onLogout }) {
  const user = getSession()
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? onLogout : undefined} />
      <main className="page-container flex-1 py-8">{children}</main>
      <Footer />
    </div>
  )
}

function Breadcrumb({ items }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Đường dẫn">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.to && !isLast ? (
              <Link to={item.to} className="transition-colors hover:text-foreground">{item.label}</Link>
            ) : (
              <span className={isLast ? 'font-medium text-foreground' : ''}>{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="size-3.5" /> : null}
          </span>
        )
      })}
    </nav>
  )
}

export default function SeriesUploadDetail() {
  const { seriesSlug, chapterId } = useParams()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState(() => readMangakaWorkspace())
  const [editSeriesOpen, setEditSeriesOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    const refresh = () => setWorkspace(readMangakaWorkspace())
    window.addEventListener('storage', refresh)
    window.addEventListener('mk-workspace-update', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('mk-workspace-update', refresh)
    }
  }, [])

  useEffect(() => {
    setWorkspace(readMangakaWorkspace())
  }, [seriesSlug, chapterId])

  const series = useMemo(
    () => findSeriesBySlug(workspace.seriesList, seriesSlug),
    [workspace.seriesList, seriesSlug],
  )

  const seriesTitle = series?.title ?? ''

  const chapterRows = useMemo(() => {
    if (!seriesTitle) return []
    return workspace.chapterRows.filter(r => r.series === seriesTitle)
  }, [workspace.chapterRows, seriesTitle])

  const activeRow = useMemo(
    () => (chapterId ? chapterRows.find(r => String(r.id) === String(chapterId)) : null),
    [chapterRows, chapterId],
  )

  const activeAnnotator = useMemo(
    () => (activeRow ? resolveAnnotatorChapter(activeRow, workspace.annotatorChapters) : null),
    [activeRow, workspace.annotatorChapters],
  )

  function handleEditSeriesSubmit(form) {
    if (!series) return
    const next = updateSeriesInWorkspace(series.id, form)
    setWorkspace(next)
    setEditSeriesOpen(false)
    const updated = next.seriesList.find(s => s.id === series.id)
    if (updated) {
      const newSlug = updated.slug ?? slugifySeriesTitle(updated.title)
      if (newSlug !== seriesSlug) {
        navigate(`/mangaka/series/${newSlug}`, { replace: true })
      }
    }
  }

  const chapterCards = useMemo(() => chapterRows.map(row => {
    const annot = resolveAnnotatorChapter(row, workspace.annotatorChapters)
    const cover = annot?.cover?.url
      ? { url: annot.cover.url, name: annot.cover.name ?? 'cover' }
      : annot?.pages?.find(p => p?.url) ?? annot?.pages?.[0]
    const uploaded = annot?.pages?.length ?? row.pages ?? 0
    return { row, annot, cover, uploaded }
  }), [chapterRows, workspace.annotatorChapters])

  if (!series) {
    return (
      <DetailShell onLogout={handleLogout}>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="size-12 text-muted-foreground/60" />
            <h1 className="text-2xl font-bold">Không tìm thấy truyện</h1>
            <p className="text-muted-foreground">Series có thể đã bị xóa hoặc chưa được lưu trong phiên làm việc.</p>
            <Button asChild>
              <Link to="/mangaka">
                <ArrowLeft className="size-4" />
                Về Mangaka
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DetailShell>
    )
  }

  const slug = series.slug ?? slugifySeriesTitle(series.title)
  const basePath = `/mangaka/series/${slug}`

  if (chapterId && activeRow) {
    const pages = activeAnnotator?.pages ?? []
    const pagesWithMedia = pages.filter(p => p?.url)
    const staleOnly = pages.length > 0 && pagesWithMedia.length === 0
    const progressPct = pages.length > 0 ? Math.min(100, pages.length * 4) : null
    const statusBadge = STATUS_BADGE[activeRow.status] ?? STATUS_BADGE.draft

    const openAnnotate = () => navigate('/mangaka', {
      state: { tab: 'annotate', series: series.title, chapterId: activeRow.id },
    })

    return (
      <DetailShell onLogout={handleLogout}>
        <Breadcrumb
          items={[
            { label: 'Mangaka', to: '/mangaka' },
            { label: series.title, to: basePath },
            { label: `Ch. ${activeRow.num}` },
          ]}
        />

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <Card className="overflow-hidden p-0">
              <div className="h-1.5" style={{ background: series.color }} />
              <CardHeader className="pb-3">
                <CardDescription>{series.title}</CardDescription>
                <CardTitle className="text-2xl">Chapter {activeRow.num}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={statusBadge.className} variant="secondary">{statusBadge.label}</Badge>
                  <span className="text-xs text-muted-foreground">{activeRow.date}</span>
                </div>
                <p className="text-sm">
                  {pages.length} trang đã upload
                </p>
                {progressPct !== null ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: series.color }} />
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">Khổ trang: 728×1030 px (chuẩn manga)</p>
              </CardContent>
              <Separator />
              <CardContent className="space-y-2 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                <Button asChild variant="outline" className="w-full">
                  <Link to={basePath}>
                    <ArrowLeft className="size-4" />
                    Danh sách chapter
                  </Link>
                </Button>
                <Button className="w-full" onClick={openAnnotate}>
                  <PenSquare className="size-4" />
                  Mở ghi chú / upload
                </Button>
              </CardContent>
            </Card>

            {staleOnly ? (
              <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5">
                <CardContent className="space-y-2 p-4">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Ảnh chưa hiển thị được</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Dữ liệu cũ (trước khi lưu ảnh) — upload lại 1 lần trên Mangaka.
                  </p>
                  <Button size="sm" className="w-full" onClick={openAnnotate}>
                    Upload lại chapter
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </aside>

          <section aria-label={`Trang chapter ${activeRow.num}`}>
            {pages.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <ImageIcon className="size-12 text-muted-foreground/60" />
                  <p>Chapter chưa có ảnh.</p>
                  <Button onClick={openAnnotate}>
                    <Upload className="size-4" />
                    Upload tại Mangaka
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {pages.map((pg, i) => (
                  <figure key={pg.id ?? i} className="space-y-2">
                    <figcaption className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">Trang {i + 1}</Badge>
                      {pg.name ? <span className="truncate text-xs text-muted-foreground">{pg.name}</span> : null}
                    </figcaption>
                    <div className="manga-page manga-page--reader mx-auto overflow-hidden rounded-lg border shadow-sm">
                      {pg.url ? (
                        <img
                          src={pg.url}
                          alt={`${series.title} Ch.${activeRow.num} trang ${i + 1}`}
                          className="manga-page__media"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="manga-page__empty">
                          <span>Trang {i + 1}</span>
                          <p>728×1030 · upload lại để hiện ảnh</p>
                        </div>
                      )}
                    </div>
                  </figure>
                ))}
              </div>
            )}
          </section>
        </div>
      </DetailShell>
    )
  }

  const initials = (series.title.length >= 2 ? series.title : `${series.title}●`).slice(0, 2)
  const seriesBadge = STATUS_BADGE[series.status] ?? STATUS_BADGE.draft

  return (
    <DetailShell onLogout={handleLogout}>
      <Breadcrumb
        items={[
          { label: 'Mangaka', to: '/mangaka' },
          { label: series.title },
        ]}
      />

      <Card className="mb-6 overflow-hidden p-0">
        <div
          className="relative px-6 py-8 sm:px-8 sm:py-10"
          style={{
            background: `linear-gradient(135deg, ${series.color}30, transparent 60%), linear-gradient(180deg, hsl(var(--background)), hsl(var(--background)))`,
          }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div
              className="flex aspect-[3/4] w-32 shrink-0 items-center justify-center rounded-xl text-3xl font-extrabold text-white shadow-lg sm:w-40"
              style={{ background: `linear-gradient(135deg, ${series.color}, ${series.color}88)` }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={seriesBadge.className} variant="secondary">
                  {series.statusLabel ?? seriesBadge.label}
                </Badge>
                {series.needsFullDebutPipeline ? (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400" variant="secondary">
                    <Sparkles className="size-3" />
                    Lần đầu · có {LABEL_EDITOR_BOARD}
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{series.title}</h1>
              {series.altTitle && series.altTitle !== series.title ? (
                <p className="text-base text-muted-foreground">{series.altTitle}</p>
              ) : null}
              <p className="text-sm text-muted-foreground">{formatSeriesCardLine(series)}</p>
              <p className="text-xs text-muted-foreground">
                {formatSeriesCatalogLine(series)} · {formatSeriesRating(series)}
              </p>
              {series.authorName ? (
                <p className="text-xs text-muted-foreground">Tác giả · <span className="font-medium text-foreground">{series.authorName}</span></p>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Thống kê</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{chapterCards.length}</div>
                  <p className="text-xs text-muted-foreground">Chapter upload</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{series.chapters ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Tổng chapter</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{series.marks ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Vùng ghi chú</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{Math.round(series.progress ?? 0)}%</div>
                  <p className="text-xs text-muted-foreground">Tiến độ</p>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, series.progress ?? 0)}%`, background: series.color }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4">
              <Button variant="outline" className="w-full" onClick={() => setEditSeriesOpen(true)}>
                <PenSquare className="size-4" />
                Chỉnh sửa hồ sơ
              </Button>
              <Button asChild className="w-full">
                <Link to="/mangaka" state={{ tab: 'annotate', series: series.title }}>
                  <Upload className="size-4" />
                  Upload chapter
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/mangaka" state={{ tab: 'annotate', series: series.title }}>
                  <PenSquare className="size-4" />
                  Ghi chú trang
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">Giới thiệu</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setEditSeriesOpen(true)}>
                  Chỉnh sửa
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!series.metadataComplete ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Hồ sơ chưa đầy đủ — bấm "Chỉnh sửa" để bổ sung tóm tắt, thể loại…
                </p>
              ) : null}
              <p className="text-sm leading-relaxed">
                {series.synopsis || <span className="text-muted-foreground italic">Chưa có tóm tắt truyện.</span>}
              </p>
              {series.genres?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {series.genres.map(g => (
                    <Badge key={g} variant="secondary">{g}</Badge>
                  ))}
                </div>
              ) : null}
              {series.tags?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {series.tags.map(t => (
                    <Badge key={t} variant="outline">#{t}</Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Chapter đã upload</h2>
                <p className="text-sm text-muted-foreground">Bấm chapter để xem toàn bộ ảnh trang</p>
              </div>
              <Badge variant="outline">{chapterCards.length} chapter</Badge>
            </div>

            {chapterCards.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileImage className="size-10 text-muted-foreground/60" />
                  <p>Chưa có chapter — bắt đầu upload từ workspace.</p>
                  <Button asChild>
                    <Link to="/mangaka" state={{ tab: 'annotate', series: series.title }}>
                      <Upload className="size-4" />
                      Upload chapter đầu tiên
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chapterCards.map(({ row, cover, uploaded }) => {
                  const pct = uploaded > 0 ? Math.min(100, uploaded * 4) : null
                  const chapterBadge = STATUS_BADGE[row.status] ?? STATUS_BADGE.draft
                  return (
                    <li key={row.id}>
                      <Link
                        to={`${basePath}/chapter/${row.id}`}
                        className="group block"
                      >
                        <Card className="overflow-hidden p-0 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                          <div className="relative manga-page manga-page--card overflow-hidden bg-muted">
                            {cover?.url ? (
                              <img src={cover.url} alt="" className="manga-page__media" />
                            ) : (
                              <div className="manga-page__empty">
                                <span>Ch.{row.num}</span>
                              </div>
                            )}
                            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent py-3 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                              Xem trang →
                            </span>
                          </div>
                          <CardContent className="space-y-2 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <strong className="text-sm">Chapter {row.num}</strong>
                              <Badge className={cn('text-[10px]', chapterBadge.className)} variant="secondary">
                                {chapterBadge.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {uploaded} trang · {row.type}
                            </p>
                            {pct !== null ? (
                              <div className="h-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: series.color }}
                                />
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="mt-8">
        <Button asChild variant="ghost" size="sm">
          <Link to="/mangaka" state={{ tab: 'series' }}>
            <ArrowLeft className="size-4" />
            Quay lại danh sách series
          </Link>
        </Button>
      </div>

      <AddSeriesModal
        open={editSeriesOpen}
        mode="edit"
        initialSeries={series}
        onClose={() => setEditSeriesOpen(false)}
        onSubmit={handleEditSeriesSubmit}
        authorName={series.authorName}
        existingTitles={workspace.seriesList.map(s => s.title)}
      />
    </DetailShell>
  )
}

export { seriesPath }
