import { http } from './http.js'

function unwrap(res) {
  return res?.data !== undefined && res?.success !== undefined ? res.data : res
}

export const tasksService = {
  create(payload) {
    return http.post('/tasks', payload).then(unwrap)
  },

  getMyAssignments(params) {
    return http.get('/tasks/my-assignments', { params }).then(res => ({
      items: unwrap(res),
      pagination: res?.pagination ?? null,
    }))
  },

  getByChapter(chapterId) {
    return http.get(`/tasks/chapter/${chapterId}`).then(unwrap)
  },

  start(taskId) {
    return http.patch(`/tasks/${taskId}/start`).then(unwrap)
  },

  submit(taskId, resultFile) {
    const fd = new FormData()
    fd.append('result_image', resultFile)
    return http.post(`/tasks/${taskId}/submit`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },

  approve(taskId) {
    return http.patch(`/tasks/${taskId}/approve`).then(unwrap)
  },

  requestRevision(taskId, note = '') {
    return http.patch(`/tasks/${taskId}/revision`, note ? { note } : {}).then(unwrap)
  },

  getStats(params) {
    return http.get('/tasks/stats', { params }).then(unwrap)
  },
}
