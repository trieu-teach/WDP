import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tasksService } from '@/api/tasks.service.js'
import { submissionsService } from '@/api/submissions.service.js'
import { apiSubmissionChapterToUi, apiTaskToUi } from '@/utils/apiMappers.js'

export function useMangakaTasks(chapterRows) {
  const [pendingReviews, setPendingReviews] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)
  const chapterRowsRef = useRef(chapterRows)
  chapterRowsRef.current = chapterRows

  const chapterIdKey = useMemo(
    () => (chapterRows ?? []).map(r => r.id).sort().join('|'),
    [chapterRows],
  )

  const refresh = useCallback(async () => {
    const rows = chapterRowsRef.current ?? []
    if (!rows.length) {
      setPendingReviews([])
      setSubmissions([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [reviews, subs] = await Promise.all([
        (async () => {
          const items = []
          await Promise.all(
            rows.map(async (row) => {
              try {
                const raw = await tasksService.getByChapter(row.id)
                const tasks = (Array.isArray(raw) ? raw : []).map(apiTaskToUi)
                if (tasks.length === 0) return
                const allSubmitted = tasks.every(t => t.status === 'submitted')
                if (allSubmitted) {
                  items.push({ chapter: row, tasks })
                }
              } catch {
                /* chapter chưa có task */
              }
            }),
          )
          return items
        })(),
        submissionsService.getMangakaSubmissions().catch(() => []),
      ])
      setPendingReviews(reviews)
      const subList = Array.isArray(subs) ? subs : []
      setSubmissions(subList.map(apiSubmissionChapterToUi))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [chapterIdKey, refresh])

  const approveChapterTasks = useCallback(async (tasks) => {
    const list = Array.isArray(tasks) ? tasks : []
    await Promise.all(list.map(t => tasksService.approve(t.id)))
    await refresh()
  }, [refresh])

  const requestRevision = useCallback(async (tasks, note = '') => {
    const list = Array.isArray(tasks) ? tasks : []
    await Promise.all(list.map(t => tasksService.requestRevision(t.id, note)))
    await refresh()
  }, [refresh])

  return {
    pendingReviews,
    submissions,
    loading,
    refresh,
    approveChapterTasks,
    requestRevision,
  }
}
