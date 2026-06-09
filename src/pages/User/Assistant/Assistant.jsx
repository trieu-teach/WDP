import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  Handshake,
  Image as ImageIcon,
  Inbox,
  Layers as LayersIcon,
  Lightbulb,
  Lock,
  MonitorOff,
  Send,
  Sparkles,
  StickyNote,
  TrendingUp,
} from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { WorkspaceHero } from '@/components/layout/WorkspaceHero.jsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { getSession, logout } from '@/lib/auth.js'
import { ASSISTANT_PRODUCTION_STEPS } from '@/constants/assistantProductionLayers.js'
import { MANGA_PAGE_HEIGHT, MANGA_PAGE_WIDTH } from '@/constants/mangaPageDimensions.js'
import { noteTaskLabel } from '@/constants/workspaceTasks.js'
import { ProductionLayerRow } from '@/components/Assistant/ProductionLayerRow.jsx'
import {
  getBlob,
  paintLayerVersionBlobKey,
} from '@/utils/assistantLayerBlobs.js'
import {
  appendLayerVersion,
  moveLayerOrder,
  setActiveLayerVersion,
  sortLayersForStack,
} from '@/utils/assistantProductionLayerUtils.js'
import {
  hydrateAssistantSubmission,
  listAssistantSubmissions,
  loadAssistantPaintLayers,
  migrateAssistantStorage,
  pushAssistantDeliverable,
  saveAssistantPaintLayers,
  updateAssistantSubmission,
} from '@/utils/assistantWorkspaceStorage.js'
import { getAssistantByUserId } from '@/constants/assistantCatalog.js'
import {
  listPendingRequestsForAssistantUser,
  respondToHireRequest,
} from '@/utils/assistantRosterStorage.js'
import '@/styles/mangaPage.css'

const NAV_LINKS = [{ to: '/', label: 'Trang chủ' }]

const STATS = [
  { label: 'Việc được giao', icon: Inbox, color: 'sky' },
  { label: 'Đang xử lý', icon: LayersIcon, color: 'violet' },
  { label: 'Chờ Mangaka duyệt', icon: Clock, color: 'amber' },
  { label: 'Trang đã duyệt', icon: CheckCircle2, color: 'emerald' },
  { label: 'Thu nhập tháng này', icon: DollarSign, color: 'rose' },
]

const STAT_ICON_BG = {
  sky: 'bg-sky-500/10 text-sky-600',
  violet: 'bg-violet-500/10 text-violet-600',
  amber: 'bg-amber-500/10 text-amber-600',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  rose: 'bg-rose-500/10 text-rose-600',
}

const STATUS_BADGE = {
  pending_assistant: { label: 'Chờ nhận', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  in_progress: { label: 'Đang xử lý', className: 'bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400' },
  submitted_to_mangaka: { label: 'Đã gửi', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
}

const INCOME_MONTHS = [
  { month: '05/2026', pages: 24, amount: '4.2M' },
  { month: '04/2026', pages: 19, amount: '3.1M' },
  { month: '03/2026', pages: 22, amount: '3.6M' },
]

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawFitted(ctx, img, width, height) {
  const iw = img.naturalWidth || img.width || 1
  const ih = img.naturalHeight || img.height || 1
  const scale = Math.min(width / iw, height / ih)
  const w = iw * scale
  const h = ih * scale
  const x = (width - w) / 2
  const y = (height - h) / 2
  ctx.drawImage(img, x, y, w, h)
}

async function renderComposite({
  baseUrl,
  notes,
  paintLayers,
  notesVisible,
  includeBase,
  transparentBg,
}) {
  const W = MANGA_PAGE_WIDTH
  const H = MANGA_PAGE_HEIGHT
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (!transparentBg) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
  }

  if (includeBase && baseUrl) {
    try {
      const img = await loadImage(baseUrl)
      drawFitted(ctx, img, W, H)
    } catch {
      /* ignore */
    }
  }

  for (const layer of sortLayersForStack(paintLayers)) {
    if (!layer.visible || !layer.dataUrl) continue
    try {
      const img = await loadImage(layer.dataUrl)
      ctx.globalAlpha = Math.max(0, Math.min(1, (layer.opacity ?? 100) / 100))
      drawFitted(ctx, img, W, H)
      ctx.globalAlpha = 1
    } catch {
      /* ignore */
    }
  }

  if (notesVisible && notes?.length) {
    notes.forEach((n, idx) => {
      const x = (n.x / 100) * W
      const y = (n.y / 100) * H
      const w = (n.w / 100) * W
      const h = (n.h / 100) * H
      ctx.save()
      ctx.fillStyle = 'rgba(230, 57, 70, 0.10)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#e63946'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 5])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(230, 57, 70, 0.92)'
      ctx.fillRect(x, y, 22, 18)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(idx + 1), x + 11, y + 9)
      ctx.restore()
    })
  }

  return canvas.toDataURL('image/png')
}

function LayerStack({ baseUrl, notes, baseVisible, notesVisible, paintLayers, className }) {
  return (
    <div
      className={cn(
        'manga-page manga-page--canvas relative mx-auto overflow-hidden rounded-lg border-2 border-dashed border-white/10 shadow-2xl',
        className,
      )}
    >
      {baseVisible && baseUrl ? (
        <img src={baseUrl} alt="" className="manga-page__media absolute inset-0 size-full" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 text-xs text-zinc-500">
          {baseUrl ? 'Layer ảnh gốc đang ẩn' : 'Chưa có ảnh gốc'}
        </div>
      )}

      {sortLayersForStack(paintLayers).map(layer => (
        layer.visible && layer.dataUrl ? (
          <img
            key={layer.id}
            src={layer.dataUrl}
            alt={layer.name}
            className="manga-page__media pointer-events-none absolute inset-0 size-full"
            style={{ opacity: Math.max(0, Math.min(1, (layer.opacity ?? 100) / 100)) }}
          />
        ) : null
      ))}

      {notesVisible && notes?.length ? (
        <div className="pointer-events-none absolute inset-0">
          {notes.map((n, idx) => (
            <div
              key={n.id ?? idx}
              className="absolute rounded-md border-2 border-dashed border-rose-500/90 bg-rose-500/10"
              style={{ left: `${n.x}%`, top: `${n.y}%`, width: `${n.w}%`, height: `${n.h}%` }}
            >
              <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-sm bg-rose-500 text-[10px] font-bold text-white shadow">
                {idx + 1}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function Assistant() {
  const navigate = useNavigate()
  const user = getSession()

  const [submissions, setSubmissions] = useState(() => listAssistantSubmissions())
  const [selectedId, setSelectedId] = useState(() => listAssistantSubmissions()[0]?.id ?? null)
  const [baseVisible, setBaseVisible] = useState(true)
  const [notesVisible, setNotesVisible] = useState(true)
  const [paintLayers, setPaintLayers] = useState([])
  const [busy, setBusy] = useState(false)
  const [layerToReplace, setLayerToReplace] = useState(null)
  const [hydratedSelected, setHydratedSelected] = useState(null)
  const skipNextPersistRef = useRef(false)
  const [hireRequests, setHireRequests] = useState([])
  const [hireBusyId, setHireBusyId] = useState(null)

  const assistantProfile = useMemo(
    () => (user?.id ? getAssistantByUserId(user.id) : null),
    [user?.id],
  )

  const reloadHireRequests = useCallback(() => {
    if (!user?.id) {
      setHireRequests([])
      return
    }
    setHireRequests(listPendingRequestsForAssistantUser(user.id))
  }, [user?.id])

  const reloadInbox = useCallback(() => {
    const list = listAssistantSubmissions()
    setSubmissions(list)
    if (!list.some(s => s.id === selectedId)) {
      setSelectedId(list[0]?.id ?? null)
    }
  }, [selectedId])

  useEffect(() => {
    migrateAssistantStorage().finally(() => reloadInbox())
    const onSync = () => reloadInbox()
    window.addEventListener('storage', onSync)
    window.addEventListener('mk-assistant-storage', onSync)
    return () => {
      window.removeEventListener('storage', onSync)
      window.removeEventListener('mk-assistant-storage', onSync)
    }
  }, [reloadInbox])

  useEffect(() => {
    reloadHireRequests()
    const onRoster = () => reloadHireRequests()
    window.addEventListener('storage', onRoster)
    window.addEventListener('mk-assistant-roster-update', onRoster)
    return () => {
      window.removeEventListener('storage', onRoster)
      window.removeEventListener('mk-assistant-roster-update', onRoster)
    }
  }, [reloadHireRequests])

  const selectedSlim = useMemo(
    () => submissions.find(s => s.id === selectedId) ?? null,
    [submissions, selectedId],
  )

  // Hydrate selected submission (load mangakaImageUrl from IDB if needed)
  useEffect(() => {
    if (!selectedSlim) {
      setHydratedSelected(null)
      return undefined
    }
    let cancelled = false
    hydrateAssistantSubmission(selectedSlim).then(h => {
      if (!cancelled) setHydratedSelected(h)
    })
    return () => { cancelled = true }
  }, [selectedSlim])

  const selected = hydratedSelected ?? selectedSlim

  // Load paint layers from IDB whenever selected changes
  useEffect(() => {
    if (!selectedSlim) {
      setPaintLayers([])
      return undefined
    }
    let cancelled = false
    setBaseVisible(true)
    setNotesVisible(true)
    loadAssistantPaintLayers(selectedSlim.id).then(layers => {
      if (cancelled) return
      skipNextPersistRef.current = true
      setPaintLayers(layers)
    })
    if (selectedSlim.status === 'pending_assistant') {
      updateAssistantSubmission(selectedSlim.id, { status: 'in_progress' })
      reloadInbox()
    }
    return () => { cancelled = true }
  }, [selectedSlim?.id])

  // Persist paint layers (skip if state was just loaded from IDB)
  useEffect(() => {
    if (!selectedSlim) return
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }
    saveAssistantPaintLayers(selectedSlim.id, paintLayers).catch((err) => {
      console.error('saveAssistantPaintLayers failed', err)
      toast.error('Không lưu được layer.')
    })
  }, [paintLayers, selectedSlim?.id])

  const statsDisplayed = useMemo(() => {
    const progress = submissions.filter(s => s.status === 'in_progress').length
    const review = submissions.filter(s => s.status === 'submitted_to_mangaka').length
    return [
      { ...STATS[0], value: String(submissions.length) },
      { ...STATS[1], value: String(progress || (selected ? 1 : 0)) },
      { ...STATS[2], value: String(review) },
      { ...STATS[3], value: '24' },
      { ...STATS[4], value: '4.2M' },
    ]
  }, [submissions, selected])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  async function handleHireResponse(requestId, accept) {
    if (!user?.id) return
    setHireBusyId(requestId)
    try {
      const result = respondToHireRequest(requestId, accept, user.id)
      if (accept) {
        toast.success('Đã chấp nhận — bạn đã thêm vào đội của Mangaka này.')
      } else {
        toast.message('Đã từ chối yêu cầu thuê.')
      }
      reloadHireRequests()
    } catch (err) {
      toast.error(err?.message ?? 'Không xử lý được yêu cầu.')
    } finally {
      setHireBusyId(null)
    }
  }

  function handleSelectSubmission(sub) {
    setSelectedId(sub.id)
  }

  function toggleLayerVisible(layerId) {
    setPaintLayers(prev => prev.map(l => (l.id === layerId ? { ...l, visible: !l.visible } : l)))
  }

  function changeLayerOpacity(layerId, value) {
    setPaintLayers(prev => prev.map(l => (l.id === layerId ? { ...l, opacity: value } : l)))
  }

  function moveLayer(layerId, direction) {
    setPaintLayers(prev => moveLayerOrder(prev, layerId, direction))
  }

  async function handleSelectVersion(layerId, versionId) {
    if (!selectedSlim) return
    const layer = paintLayers.find(l => l.id === layerId)
    const ver = layer?.versions?.find(v => v.id === versionId)
    let dataUrl = ver?.dataUrl ?? null
    if (!dataUrl) {
      try {
        dataUrl = await getBlob(
          paintLayerVersionBlobKey(selectedSlim.id, layerId, versionId),
        )
      } catch {
        dataUrl = null
      }
    }
    setPaintLayers(prev =>
      prev.map(l =>
        l.id === layerId ? setActiveLayerVersion(l, versionId, dataUrl) : l,
      ),
    )
  }

  function handleDownloadLayer(layerId) {
    const layer = paintLayers.find(l => l.id === layerId)
    if (!layer?.dataUrl || !selected) return
    const step = ASSISTANT_PRODUCTION_STEPS.find(s => layer.stepType === s.key)
    const ver = layer.versions?.find(v => v.id === layer.activeVersionId)
    const a = document.createElement('a')
    a.href = layer.dataUrl
    a.download = `${selected.seriesTitle}-Ch${selected.chapterNum}-${step?.key ?? 'layer'}-${ver?.label ?? 'file'}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(`Đã tải ${layer.name}.`)
  }

  async function handleAddLayerFiles(files, replaceLayerId = null) {
    if (!selected || !replaceLayerId || !files?.length) return
    const arr = Array.from(files).filter(
      f => f.type === 'image/png' || f.type === 'image/webp',
    )
    if (!arr.length) {
      toast.error('Chỉ chấp nhận PNG hoặc WebP (nền trong suốt).')
      return
    }
    setBusy(true)
    try {
      const dataUrl = await fileToDataUrl(arr[0])
      setPaintLayers(prev =>
        prev.map(l => {
          if (l.id !== replaceLayerId) return l
          const updated = appendLayerVersion(l, dataUrl)
          return {
            ...updated,
            versions: updated.versions.map(v =>
              v.id === updated.activeVersionId ? { ...v, dataUrl } : v,
            ),
          }
        }),
      )
      const layerName = paintLayers.find(l => l.id === replaceLayerId)?.name
      toast.success(`Đã upload phiên bản mới cho ${layerName ?? 'layer'}.`)
    } catch {
      toast.error('Không đọc được ảnh — thử file khác.')
    } finally {
      setBusy(false)
      setLayerToReplace(null)
    }
  }

  function onFileInputChange(e) {
    const files = e.target.files
    void handleAddLayerFiles(files, layerToReplace)
    e.target.value = ''
  }

  function pickReplaceFile(layerId) {
    setLayerToReplace(layerId)
    document.getElementById('as-layer-file-input')?.click()
  }

  function handleDownloadOriginal() {
    if (!selected?.mangakaImageUrl) return
    const a = document.createElement('a')
    a.href = selected.mangakaImageUrl
    a.download = `${selected.seriesTitle}-Ch${selected.chapterNum}-${selected.pageLabel || 'page'}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Đã tải bản phác thảo — chỉnh trong Photoshop / Clip Studio Paint rồi upload từng layer PNG/WebP.')
  }

  async function handleSubmitToMangaka(mode) {
    if (!selected) return
    const visibleCount = paintLayers.filter(l => l.visible && l.dataUrl).length
    if (visibleCount === 0) {
      toast.error('Hãy bật ít nhất một layer có ảnh trước khi gửi.')
      return
    }

    setBusy(true)
    try {
      const compositeDataUrl = mode === 'overlay' ? null : await renderComposite({
        baseUrl: selected.mangakaImageUrl,
        notes: selected.notes,
        paintLayers,
        notesVisible: false,
        includeBase: true,
        transparentBg: false,
      })
      const overlayDataUrl = mode === 'composite' ? null : await renderComposite({
        baseUrl: null,
        notes: selected.notes,
        paintLayers,
        notesVisible: false,
        includeBase: false,
        transparentBg: true,
      })

      await pushAssistantDeliverable({
        id: `del-${Date.now()}`,
        submissionId: selected.id,
        seriesTitle: selected.seriesTitle,
        chapterId: selected.chapterId,
        chapterNum: selected.chapterNum,
        pageIndex: selected.pageIndex,
        pageLabel: selected.pageLabel,
        mangakaImageUrl: selected.mangakaImageUrl,
        mangakaImageBlobKey: selectedSlim?.mangakaImageBlobKey,
        compositeDataUrl,
        overlayDataUrl,
        layersMeta: sortLayersForStack(paintLayers).map(l => ({
          id: l.id,
          name: l.name,
          stepType: l.stepType,
          type: l.type,
          visible: l.visible,
          opacity: l.opacity ?? 100,
          sortOrder: l.sortOrder,
          activeVersionId: l.activeVersionId,
          versionCount: l.versions?.length ?? 0,
        })),
        status: 'pending_mangaka_review',
        sentAt: new Date().toISOString(),
        sendMode: mode,
      })

      const label = mode === 'overlay' ? 'layer trong suốt' : 'bản ghép (ảnh gốc + layer)'
      toast.success(`Đã gửi ${label} — ${selected.seriesTitle} ${selected.pageLabel}.`)
      reloadInbox()
    } catch {
      toast.error('Không tạo được file gửi đi — thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const noteCount = selected?.notes?.length ?? 0
  const visibleLayerCount = paintLayers.filter(l => l.visible && l.dataUrl).length

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        className="from-violet-950 to-zinc-950"
        label="Assistant Workspace"
        title={`Xin chào${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description="Mangaka gửi bản phác thảo PNG/WebP. Assistant tải về, chỉnh trong Photoshop hoặc Clip Studio Paint, rồi upload lại từng layer sản xuất. Website không chỉnh ảnh trực tiếp."
      >
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-300">
          <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            <ArrowDownToLine className="size-3" />
            Download bản gốc
          </Badge>
          <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            <MonitorOff className="size-3" />
            Chỉnh ngoài PS / CSP
          </Badge>
          <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            <LayersIcon className="size-3" />
            6 layer sản xuất
          </Badge>
        </div>
      </WorkspaceHero>

      <main className="page-container flex-1 py-8">
        <input
          id="as-layer-file-input"
          type="file"
          accept="image/png,image/webp"
          hidden
          onChange={onFileInputChange}
        />

        {assistantProfile && hireRequests.length > 0 ? (
          <Card className="mb-6 overflow-hidden border-violet-200 bg-gradient-to-br from-violet-500/5 via-background to-background dark:border-violet-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Handshake className="size-4 text-violet-600" />
                Yêu cầu thuê từ Mangaka
              </CardTitle>
              <CardDescription>
                Assistant có thể chấp nhận nhiều Mangaka — mỗi lời mời thêm bạn vào đội của họ.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {hireRequests.map(req => (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold">{req.mangakaName}</p>
                    {req.note ? (
                      <p className="text-sm text-muted-foreground">&ldquo;{req.note}&rdquo;</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Mời bạn làm Assistant cho dự án của họ.</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Gửi lúc {new Date(req.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={hireBusyId === req.id}
                      onClick={() => void handleHireResponse(req.id, false)}
                    >
                      Từ chối
                    </Button>
                    <Button
                      size="sm"
                      disabled={hireBusyId === req.id}
                      onClick={() => void handleHireResponse(req.id, true)}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Chấp nhận
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {statsDisplayed.map(s => {
            const Icon = s.icon
            return (
              <Card key={s.label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={cn('flex size-10 items-center justify-center rounded-xl', STAT_ICON_BG[s.color])}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-bold leading-tight">{s.value}</div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[300px_1fr_360px]">
          <Card className="flex flex-col gap-0 overflow-hidden p-0">
            <CardHeader className="border-b p-4">
              <CardTitle className="text-base">Trang từ Mangaka</CardTitle>
              <CardDescription>Chọn trang để mở chế độ layer</CardDescription>
            </CardHeader>
            {submissions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Chưa có trang nào. Mangaka bấm <strong>Gửi Assistant</strong> ở tab Upload &amp; Ghi chú.
              </div>
            ) : (
              <ScrollArea className="max-h-[calc(100vh-220px)]">
                <ul className="divide-y">
                  {submissions.map(sub => {
                    const badge = STATUS_BADGE[sub.status] ?? STATUS_BADGE.pending_assistant
                    const layerCount = Array.isArray(sub.paintLayers) ? sub.paintLayers.length : 0
                    return (
                      <li key={sub.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectSubmission(sub)}
                          className={cn(
                            'flex w-full items-start gap-3 p-3 text-left transition-colors',
                            selectedId === sub.id ? 'bg-primary/10' : 'hover:bg-muted/50',
                          )}
                        >
                          <span className="manga-page manga-page--thumb-md shrink-0 overflow-hidden rounded">
                            {sub.mangakaImageUrl ? (
                              <img src={sub.mangakaImageUrl} alt="" className="manga-page__media" />
                            ) : (
                              <span className="flex h-full items-center justify-center text-xs text-muted-foreground">📄</span>
                            )}
                          </span>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="truncate text-sm font-semibold">{sub.seriesTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              Ch. {sub.chapterNum} · {sub.pageLabel}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {sub.notes?.length ?? 0} vùng · {layerCount || 6} bước layer
                            </p>
                            <Badge className={cn('mt-1', badge.className)} variant="secondary">
                              {badge.label}
                            </Badge>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            )}
          </Card>

          <div className="space-y-4">
            {selected ? (
              <>
                <Card className="overflow-hidden p-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {selected.seriesTitle} · Ch. {selected.chapterNum}
                      </p>
                      <p className="text-xs text-muted-foreground">{selected.pageLabel}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant={baseVisible ? 'default' : 'outline'} onClick={() => setBaseVisible(v => !v)}>
                        {baseVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                        Ảnh gốc
                      </Button>
                      <Button
                        size="sm"
                        variant={notesVisible ? 'default' : 'outline'}
                        onClick={() => setNotesVisible(v => !v)}
                        disabled={noteCount === 0}
                      >
                        {notesVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                        Ghi chú ({noteCount})
                      </Button>
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-4">
                    <LayerStack
                      baseUrl={selected.mangakaImageUrl}
                      notes={selected.notes}
                      baseVisible={baseVisible}
                      notesVisible={notesVisible}
                      paintLayers={paintLayers}
                      className="w-full max-w-[640px]"
                    />
                    <p className="mt-3 text-center text-xs text-zinc-400">
                      Preview · <strong className="text-white">{visibleLayerCount}</strong>/
                      {paintLayers.length} layer đang bật
                      {baseVisible ? ' · ảnh gốc' : ''}
                      {notesVisible && noteCount > 0 ? ' · ghi chú' : ''}
                    </p>
                  </div>
                </Card>

                {selected.notes?.length > 0 ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <StickyNote className="size-4 text-rose-500" />
                        Vùng việc Mangaka đã đánh dấu
                      </CardTitle>
                      <CardDescription>
                        Tải ảnh gốc, vẽ những phần này trên phần mềm yêu thích rồi upload PNG trong suốt lên đây.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {selected.notes.map((n, i) => (
                          <li key={n.id ?? i} className="flex items-start gap-2 rounded-md border p-2.5">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1 space-y-1">
                              <Badge variant="outline" className="text-[10px]">
                                {noteTaskLabel(n.taskType)}
                              </Badge>
                              <p className="text-xs">{n.text || <span className="italic text-muted-foreground">Không có mô tả</span>}</p>
                              {n.assignee ? (
                                <p className="text-[10px] text-muted-foreground">Giao: {n.assignee}</p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ) : null}
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <ImageIcon className="size-12 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Chọn một trang ở danh sách bên trái để bắt đầu.</p>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-4">
            <Card className="border-violet-200 bg-gradient-to-b from-violet-50 to-transparent dark:border-violet-500/20 dark:from-violet-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MonitorOff className="size-4 text-violet-600" />
                  Không chỉnh ảnh trên web
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>
                  Website chỉ <strong className="text-foreground">quản lý layer</strong> (upload, preview, bật/tắt, thứ tự, download, phiên bản).
                </p>
                <p>
                  Toàn bộ chỉnh sửa nét vẽ / màu / chữ thực hiện trong{' '}
                  <strong className="text-foreground">Photoshop</strong> hoặc{' '}
                  <strong className="text-foreground">Clip Studio Paint</strong>.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <LayersIcon className="size-4 text-primary" />
                  Layer sản xuất ({paintLayers.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Sketch → Line Art → Color → Text → Effect → Final
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selected ? (
                  <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Chọn một trang để bắt đầu quản lý layer.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-lg border p-2.5',
                          baseVisible ? 'bg-card' : 'border-dashed bg-muted/40',
                        )}
                        style={{ borderLeftColor: '#71717a', borderLeftWidth: 3 }}
                      >
                        <Button
                          size="icon-sm"
                          variant={baseVisible ? 'default' : 'outline'}
                          onClick={() => setBaseVisible(v => !v)}
                        >
                          {baseVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                        </Button>
                        <div className="size-9 shrink-0 overflow-hidden rounded border bg-muted">
                          {selected.mangakaImageUrl ? (
                            <img src={selected.mangakaImageUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center">🖼️</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1 truncate text-sm font-medium">
                            Ảnh gốc Mangaka
                            <Lock className="size-3 text-muted-foreground" />
                          </p>
                          <p className="text-[10px] text-muted-foreground">Không thể chỉnh sửa</p>
                        </div>
                      </div>

                      {selected.notes?.length ? (
                        <div
                          className={cn(
                            'flex items-center gap-2 rounded-lg border p-2.5',
                            notesVisible ? 'bg-card' : 'border-dashed bg-muted/40',
                          )}
                          style={{ borderLeftColor: '#e63946', borderLeftWidth: 3 }}
                        >
                          <Button
                            size="icon-sm"
                            variant={notesVisible ? 'default' : 'outline'}
                            onClick={() => setNotesVisible(v => !v)}
                          >
                            {notesVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                          </Button>
                          <div className="flex size-9 shrink-0 items-center justify-center rounded border bg-rose-500/10 text-base">
                            📝
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">Ô ghi chú ({selected.notes.length})</p>
                            <p className="text-[10px] text-muted-foreground">Đỏ – chỉ tham khảo</p>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <ul className="space-y-2">
                      {sortLayersForStack(paintLayers).map((layer, index, arr) => {
                        const step = ASSISTANT_PRODUCTION_STEPS.find(
                          s => s.key === layer.stepType,
                        )
                        return (
                          <ProductionLayerRow
                            key={layer.id}
                            layer={layer}
                            step={step}
                            onToggle={toggleLayerVisible}
                            onChangeOpacity={changeLayerOpacity}
                            onPickFile={pickReplaceFile}
                            onDownload={handleDownloadLayer}
                            onMoveUp={id => moveLayer(id, 'up')}
                            onMoveDown={id => moveLayer(id, 'down')}
                            canMoveUp={index > 0}
                            canMoveDown={index < arr.length - 1}
                            onSelectVersion={handleSelectVersion}
                          />
                        )
                      })}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Hành động</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!selected?.mangakaImageUrl}
                  onClick={handleDownloadOriginal}
                >
                  <ArrowDownToLine className="size-4" />
                  Tải ảnh gốc về máy
                </Button>
                <Button
                  className="w-full"
                  disabled={!selected || busy || visibleLayerCount === 0}
                  onClick={() => handleSubmitToMangaka('overlay')}
                  variant="outline"
                >
                  <LayersIcon className="size-4" />
                  Gửi layer trong suốt
                </Button>
                <Button
                  className="w-full"
                  disabled={!selected || busy || visibleLayerCount === 0}
                  onClick={() => handleSubmitToMangaka('composite')}
                >
                  <Send className="size-4" />
                  Gửi bản ghép
                </Button>
                {visibleLayerCount === 0 && selected ? (
                  <p className="text-[10px] text-amber-600">
                    Bật ít nhất 1 layer (có ảnh) trước khi gửi.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="size-4 text-primary" />
                  Quy trình gợi ý
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-2.5 border-l border-muted pl-5">
                  {[
                    { step: 1, text: 'Mangaka gửi bản phác thảo PNG/WebP' },
                    { step: 2, text: 'Assistant download ảnh gốc + từng layer (nếu có)' },
                    { step: 3, text: 'Chỉnh trong Photoshop / Clip Studio Paint (không vẽ trên web)' },
                    { step: 4, text: 'Upload lại từng bước: Sketch, Line Art, Color, Text, Effect, Final' },
                    { step: 5, text: 'Preview, bật/tắt, sắp xếp thứ tự, quản lý version' },
                    { step: 6, text: 'Gửi Mangaka duyệt (layer trong suốt hoặc bản ghép)' },
                  ].map(it => (
                    <li key={it.step} className="relative">
                      <span className="absolute -left-[26px] flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                        {it.step}
                      </span>
                      <p className="text-xs text-muted-foreground">{it.text}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="size-4 text-emerald-600" />
                  Trang duyệt & thu nhập
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {INCOME_MONTHS.map(m => (
                  <div key={m.month} className="flex items-center justify-between rounded-md border p-2.5">
                    <div>
                      <p className="text-sm font-medium">{m.month}</p>
                      <p className="text-xs text-muted-foreground">{m.pages} trang duyệt</p>
                    </div>
                    <span className="font-bold tabular-nums text-emerald-600">{m.amount}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
