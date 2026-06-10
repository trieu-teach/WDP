import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Check, ImagePlus, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { LABEL_EDITOR_BOARD, PATH_EDITOR_BOARD } from '@/constants/roleTerminology.js'
import {
  SERIES_CONTENT_RATINGS,
  SERIES_DEMOGRAPHICS,
  SERIES_FORMATS,
  SERIES_GENRES,
  SERIES_LANGUAGES,
  SERIES_PALETTE,
  SERIES_PUBLICATION_STATUSES,
  SERIES_PUBLISH_TYPES,
  createEmptySeriesForm,
  seriesToForm,
  validateSeriesForm,
} from '@/utils/seriesModel.js'
import './AddSeriesModal.css'

export default function AddSeriesModal({
  open,
  onClose,
  onSubmit,
  mode = 'create',
  initialSeries = null,
  authorName = '',
  existingTitles = [],
}) {
  const isEdit = mode === 'edit' && initialSeries

  const [form, setForm] = useState(() => createEmptySeriesForm(authorName))
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    if (isEdit) setForm(seriesToForm(initialSeries))
    else setForm(createEmptySeriesForm(authorName))
    setTouched(false)
    setCoverFile(null)
    setCoverPreview(initialSeries?.coverImage ?? null)
  }, [open, isEdit, initialSeries?.id, authorName, initialSeries?.coverImage])

  const titlesForValidation = useMemo(() => {
    if (!isEdit) return existingTitles
    const self = String(initialSeries.title ?? '').toLowerCase()
    return existingTitles.filter(t => String(t).toLowerCase() !== self)
  }, [existingTitles, isEdit, initialSeries?.title])

  const validation = useMemo(
    () => validateSeriesForm(form, titlesForValidation),
    [form, titlesForValidation],
  )

  function patch(updates) { setForm(prev => ({ ...prev, ...updates })) }

  function toggleGenre(genre) {
    setForm(prev => {
      const has = prev.genres.includes(genre)
      const genres = has
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre].slice(0, 5)
      return { ...prev, genres }
    })
  }

  function handleCoverChange(file) {
    setCoverFile(file)
    setCoverPreview(file ? URL.createObjectURL(file) : (initialSeries?.coverImage ?? null))
  }

  function handleClose() {
    setForm(isEdit ? seriesToForm(initialSeries) : createEmptySeriesForm(authorName))
    setTouched(false)
    onClose()
  }

  function handleSubmit(e) {
    e.preventDefault()
    setTouched(true)
    if (!validation.ok) return
    onSubmit(form, { mode: isEdit ? 'edit' : 'create', seriesId: initialSeries?.id, coverFile })
    if (!isEdit) setForm(createEmptySeriesForm(authorName))
    setTouched(false)
  }

  const err = (key) => (touched ? validation.errors[key] : null)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="series-modal bg-card sm:max-w-[640px]">
        <div className="series-modal__hero">
          <p className="series-modal__eyebrow">
            <Sparkles className="size-3.5" />
            {isEdit ? 'Chỉnh sửa hồ sơ' : 'Series mới'}
          </p>
          <DialogTitle className="series-modal__title">
            {isEdit ? initialSeries?.title || 'Series' : 'Đăng ký series mới'}
          </DialogTitle>
          <DialogDescription className="series-modal__subtitle">
            {isEdit
              ? 'Cập nhật thông tin series — tóm tắt, thể loại và cài đặt phát hành.'
              : 'Tạo hồ sơ series một lần. Assistant, Editor và EB chỉ xem phần tóm tắt.'}
          </DialogDescription>
          {isEdit && !initialSeries.metadataComplete ? (
            <Alert className="series-modal__notice mt-4 border-0">
              <AlertCircle className="size-4 text-primary" />
              <AlertDescription>
                Hồ sơ chưa đầy đủ — nên điền tóm tắt và chọn ít nhất một thể loại.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <form id="series-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="series-modal__body">
            <div className="series-modal__flow">
              <div className="series-modal__block">
                <div className="series-modal__block-head">
                  <h3 className="series-modal__block-title">Thông tin cơ bản</h3>
                  <span className="series-modal__block-note">Bước 1/4</span>
                </div>

                <div className="series-modal__intro">
                  <label className="series-modal__dropzone">
                    {coverPreview ? (
                      <>
                        <img src={coverPreview} alt="Xem trước bìa" />
                        <span className="series-modal__dropzone-overlay">Đổi ảnh bìa</span>
                      </>
                    ) : (
                      <span className="series-modal__dropzone-text">
                        <span className="series-modal__dropzone-icon">
                          <ImagePlus className="size-4" />
                        </span>
                        Ảnh bìa
                        <span className="opacity-70">Tuỳ chọn</span>
                      </span>
                    )}
                    <input
                      className="series-modal__file-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={e => handleCoverChange(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  <div className="series-modal__intro-fields">
                    <div className="series-modal__field">
                      <Label htmlFor="series-title">
                        Tên hiển thị <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="series-title"
                        className="series-modal__control"
                        value={form.title}
                        onChange={e => patch({ title: e.target.value })}
                        placeholder="Ví dụ: Huyền Long Ký"
                        maxLength={120}
                        autoFocus
                        aria-invalid={!!err('title')}
                      />
                      {err('title') ? <p className="series-modal__error">{err('title')}</p> : null}
                    </div>

                    <div className="series-modal__grid-2">
                      <div className="series-modal__field">
                        <Label htmlFor="series-alt">Tên khác / Romaji</Label>
                        <Input
                          id="series-alt"
                          className="series-modal__control"
                          value={form.altTitle}
                          onChange={e => patch({ altTitle: e.target.value })}
                          placeholder="Tùy chọn"
                          maxLength={120}
                        />
                      </div>
                      <div className="series-modal__field">
                        <Label htmlFor="series-tags">Tag</Label>
                        <Input
                          id="series-tags"
                          className="series-modal__control"
                          value={form.tags}
                          onChange={e => patch({ tags: e.target.value })}
                          placeholder="school-life, magic"
                          maxLength={120}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="series-modal__field">
                  <Label htmlFor="series-synopsis">
                    Tóm tắt / giới thiệu <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="series-synopsis"
                    className={cn('series-modal__control', 'series-modal__textarea')}
                    value={form.synopsis}
                    onChange={e => patch({ synopsis: e.target.value })}
                    placeholder="Cốt truyện, bối cảnh, nhân vật chính..."
                    rows={4}
                    maxLength={2000}
                    aria-invalid={!!err('synopsis')}
                  />
                  <div className="series-modal__counter">
                    <span>{form.synopsis.length}/2000</span>
                    {err('synopsis') ? <span className="series-modal__error">{err('synopsis')}</span> : null}
                  </div>
                </div>
              </div>

              <div className="series-modal__divider" />

              <div className="series-modal__block">
                <div className="series-modal__block-head">
                  <h3 className="series-modal__block-title">Phân loại</h3>
                  <span className="series-modal__block-note">Bước 2/4</span>
                </div>

                <div className="series-modal__field">
                  <Label>Thể loại <span className="series-modal__hint">· tối đa 5</span></Label>
                  <div className="series-modal__genre-panel">
                    <div className="series-modal__genres">
                      {SERIES_GENRES.map(g => {
                        const active = form.genres.includes(g)
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => toggleGenre(g)}
                            aria-pressed={active}
                            className={cn('series-modal__genre', active && 'series-modal__genre--active')}
                          >
                            {active ? <Check className="size-3" strokeWidth={2.5} /> : null}
                            {g}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {err('genres') ? <p className="series-modal__error">{err('genres')}</p> : null}
                </div>

                <div className="series-modal__grid-2">
                  <div className="series-modal__field">
                    <Label>Độc giả mục tiêu</Label>
                    <Select value={form.demographic} onValueChange={v => patch({ demographic: v })}>
                      <SelectTrigger className="series-modal__select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SERIES_DEMOGRAPHICS.map(d => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="series-modal__field">
                    <Label>Định dạng</Label>
                    <Select value={form.format} onValueChange={v => patch({ format: v })}>
                      <SelectTrigger className="series-modal__select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SERIES_FORMATS.map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="series-modal__field">
                    <Label>Ngôn ngữ gốc</Label>
                    <Select value={form.language} onValueChange={v => patch({ language: v })}>
                      <SelectTrigger className="series-modal__select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SERIES_LANGUAGES.map(l => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="series-modal__field">
                    <Label>Phân loại nội dung</Label>
                    <Select value={form.contentRating} onValueChange={v => patch({ contentRating: v })}>
                      <SelectTrigger className="series-modal__select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SERIES_CONTENT_RATINGS.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="series-modal__divider" />

              <div className="series-modal__block">
                <div className="series-modal__block-head">
                  <h3 className="series-modal__block-title">Phát hành</h3>
                  <span className="series-modal__block-note">Bước 3/4</span>
                </div>

                <div className="series-modal__field">
                  <Label>Trạng thái phát hành</Label>
                  <Select value={form.publicationStatus} onValueChange={v => patch({ publicationStatus: v })}>
                    <SelectTrigger className="series-modal__select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERIES_PUBLICATION_STATUSES.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="series-modal__field">
                  <Label>Loại phát hành</Label>
                  <div className="series-modal__publish">
                    {SERIES_PUBLISH_TYPES.map(pt => {
                      const active = form.publishType === pt.value
                      return (
                        <button
                          key={pt.value}
                          type="button"
                          onClick={() => patch({ publishType: pt.value })}
                          aria-pressed={active}
                          className={cn(
                            'series-modal__publish-card',
                            active && 'series-modal__publish-card--active',
                          )}
                        >
                          <span className="series-modal__publish-dot" aria-hidden />
                          <span className="series-modal__publish-title">{pt.label}</span>
                          <span className="series-modal__publish-hint">{pt.hint}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {form.publishType === 'debut' ? (
                  <Alert className="series-modal__notice border-0">
                    <AlertCircle className="size-4 text-primary" />
                    <AlertDescription className="text-sm">
                      {LABEL_EDITOR_BOARD} duyệt trên{' '}
                      <Link to={PATH_EDITOR_BOARD} className="font-medium text-primary hover:underline">
                        trang {LABEL_EDITOR_BOARD}
                      </Link>
                      {' '}— Mangaka không tự chấp nhận.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <div className="series-modal__divider" />

              <div className="series-modal__block">
                <div className="series-modal__block-head">
                  <h3 className="series-modal__block-title">Màu nhận diện</h3>
                  <span className="series-modal__block-note">Bước 4/4</span>
                </div>
                <div className="series-modal__colors">
                  {SERIES_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patch({ color: c })}
                      aria-pressed={form.color === c}
                      aria-label={`Màu ${c}`}
                      className={cn('series-modal__color', form.color === c && 'series-modal__color--active')}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="series-modal__foot">
            {touched && !validation.ok ? (
              <p className="series-modal__foot-error">Vui lòng kiểm tra các trường còn thiếu</p>
            ) : null}
            <Button type="button" variant="outline" className="series-modal__cancel" onClick={handleClose}>
              Hủy
            </Button>
            <Button type="submit" form="series-form" className="series-modal__submit">
              {isEdit ? 'Lưu thay đổi' : 'Tạo series draft'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
