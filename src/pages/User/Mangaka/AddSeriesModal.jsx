import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import {
  createEmptySeriesForm,
  seriesToForm,
  validateSeriesForm,
} from '@/utils/seriesModel.js'

const TARGET_AUDIENCES = [
  { value: 'shonen', label: 'Shōnen (13-18 tuổi)' },
  { value: 'shojo', label: 'Shōjo (13-18 tuổi)' },
  { value: 'seinen', label: 'Seinen (18+)' },
  { value: 'josei', label: 'Josei (18+)' },
  { value: 'all', label: 'Mọi lứa tuổi' },
]

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
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    if (isEdit) setForm(seriesToForm(initialSeries))
    else setForm(createEmptySeriesForm(authorName))
    setTouched(false)
  }, [open, isEdit, initialSeries?.id, authorName])

  const titlesForValidation = useMemo(() => {
    if (!isEdit) return existingTitles
    const self = String(initialSeries?.title ?? '').toLowerCase()
    return existingTitles.filter(t => String(t).toLowerCase() !== self)
  }, [existingTitles, isEdit, initialSeries?.title])

  const validation = useMemo(
    () => validateSeriesForm(form, titlesForValidation),
    [form, titlesForValidation],
  )

  function patch(updates) { setForm(prev => ({ ...prev, ...updates })) }

  function handleClose() {
    setForm(createEmptySeriesForm(authorName))
    setTouched(false)
    onClose()
  }

  function handleSubmit(e) {
    e.preventDefault()
    setTouched(true)
    if (!validation.ok) return
    onSubmit(form, { mode: isEdit ? 'edit' : 'create', seriesId: initialSeries?.id })
    if (!isEdit) setForm(createEmptySeriesForm(authorName))
    setTouched(false)
  }

  const err = (key) => (touched ? validation.errors[key] : null)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            {isEdit ? 'Chỉnh sửa series' : 'Series mới'}
          </p>
          <DialogTitle className="text-xl font-bold">
            {isEdit ? initialSeries?.title || 'Series' : 'Tạo series mới'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Điền thông tin cơ bản để tạo series.
          </DialogDescription>
        </div>

        <form id="series-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="s-name">
              Tên series <span className="text-destructive">*</span>
            </Label>
            <Input
              id="s-name"
              value={form.name}
              onChange={e => patch({ name: e.target.value })}
              placeholder="Ví dụ: Kiếm Thần Vô Song"
              maxLength={120}
              autoFocus
              aria-invalid={!!err('name')}
              className={cn(err('name') && 'border-destructive')}
            />
            {err('name') && <p className="text-xs text-destructive">{err('name')}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="s-desc">
              Mô tả <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="s-desc"
              value={form.description}
              onChange={e => patch({ description: e.target.value })}
              placeholder="Cốt truyện, bối cảnh, nhân vật chính..."
              rows={4}
              maxLength={1000}
              aria-invalid={!!err('description')}
              className={cn('resize-none', err('description') && 'border-destructive')}
            />
            <div className="flex justify-between">
              {err('description') ? (
                <p className="text-xs text-destructive">{err('description')}</p>
              ) : <span />}
              <p className="text-xs text-muted-foreground">{form.description.length}/1000</p>
            </div>
          </div>

          {/* Genre */}
          <div className="space-y-1.5">
            <Label htmlFor="s-genre">
              Thể loại <span className="text-destructive">*</span>
            </Label>
            <Input
              id="s-genre"
              value={form.genre}
              onChange={e => patch({ genre: e.target.value })}
              placeholder="Ví dụ: Hành động, Phiêu lưu, Giả tưởng"
              aria-invalid={!!err('genre')}
              className={cn(err('genre') && 'border-destructive')}
            />
            {err('genre') && <p className="text-xs text-destructive">{err('genre')}</p>}
          </div>

          {/* Target Audience */}
          <div className="space-y-1.5">
            <Label htmlFor="s-target">
              Đối tượng <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.target_audience}
              onValueChange={v => patch({ target_audience: v })}
            >
              <SelectTrigger
                id="s-target"
                aria-invalid={!!err('target_audience')}
                className={cn(err('target_audience') && 'border-destructive')}
              >
                <SelectValue placeholder="Chọn đối tượng độc giả" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_AUDIENCES.map(a => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err('target_audience') && <p className="text-xs text-destructive">{err('target_audience')}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Huỷ
            </Button>
            <Button type="submit" disabled={touched && !validation.ok}>
              {isEdit ? 'Lưu thay đổi' : 'Tạo series'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
