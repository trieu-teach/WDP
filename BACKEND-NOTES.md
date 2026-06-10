# Ghi chú cho Backend — WDP Manga

> File này tổng hợp những gì frontend cần backend bổ sung/sửa.  
> Base URL: `https://wdp-be-a2qb.onrender.com` (không có `/swagger` trong path gọi API).

---

## Luồng nghiệp vụ (đã thống nhất)

```
Mangaka upload chapter (nhiều trang)
  → vẽ ghi chú trên từng trang
  → chọn 1 Assistant
  → POST /chapters/{id}/assign  (gửi CẢ chapter)

Assistant
  → GET /chapters/my-assignments  (danh sách chapter)
  → bấm chapter → xem từng trang
  → GET /chapters/{id}/pages
  → GET /pages/{pageId}/notes
  → làm việc / upload layer (chưa có API — xem mục Thiếu)
```

**Quy tắc:** 1 chapter = nhiều trang, 1 chapter chỉ gán **1 Assistant**.

---

## Ưu tiên cao — cần sửa ngay

### 1. CORS
- Cho phép origin frontend dev: `http://localhost:5173`
- Cho phép origin production khi deploy (domain thật)
- Header: `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers` (Authorization, Content-Type)

### 2. Cooperation / Hire Assistant — **đã có API** (frontend đã gắn)

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/cooperation-requests/requests` | Mangaka gửi yêu cầu (`assistant_id`, optional `message`, `series_id`) |
| GET | `/cooperation-requests/requests/mine` | Yêu cầu đã gửi |
| GET | `/cooperation-requests/requests/incoming` | Yêu cầu nhận được |
| POST | `/cooperation-requests/requests/{id}/accept-meet` | Assistant đồng ý gặp |
| POST | `/cooperation-requests/requests/{id}/reject` | Assistant từ chối |
| POST | `/cooperation-requests/requests/{id}/accept-cooperation` | Chốt hợp tác sau gặp |
| POST | `/cooperation-requests/requests/{id}/decline-cooperation` | Từ chối hợp tác sau gặp |
| GET | `/cooperation-requests/mine` | Roster hợp tác của Mangaka (để assign chapter) |
| GET | `/cooperation-requests/assistant/mine` | Hợp tác của Assistant |
| GET | `/cooperation-requests/assistants` | Danh sách tất cả Assistant trong hệ thống |

**Luồng status:** `pending` → `accept-meet` → `accepted_meet` → `accept-cooperation` → `accepted` (+ tạo cooperation).

Frontend đã gắn browse Assistant qua `GET /cooperation-requests/assistants`.

`assistant_id` trong `POST /chapters/{id}/assign` phải là **userId** từ roster hợp tác (`/cooperation-requests/mine`).

### 3. Notes API — **đã có schema mới** (frontend đã gắn)

| Method | Path | Body |
|--------|------|------|
| GET | `/pages/{pageId}/notes` | — |
| POST | `/pages/{pageId}/notes` | `text`, `x`, `y`, `w`, `h`, `taskType` |
| PUT | `/pages/{pageId}/notes/{noteId}` | partial update cùng các field |
| DELETE | `/pages/{pageId}/notes/{noteId}` | — |

`x`, `y`, `w`, `h` trong khoảng **0–100** (% trên ảnh). `taskType`: `background | shading | fx | other`.

Frontend vẫn đọc được data cũ (`content` JSON) nếu DB chưa migrate.

### 4. `GET /chapters/my-assignments` — response cần đủ
Mỗi item nên trả:
```json
{
  "_id": "chapterId",
  "series_id": "...",
  "series_name": "Tên truyện",
  "chapter_number": 1,
  "title": "optional",
  "status": "assigned | in_progress | ...",
  "page_count": 24,
  "assistant_id": "..."
}
```

Optional nhưng hữu ích: embed `pages[]` preview hoặc `cover_page_url` để sidebar không phải gọi thêm N request.

### 5. `POST /chapters/{id}/assign`
- Body: `{ "assistant_id": "userId" }` — đúng với swagger
- Validate: chapter chưa có assistant khác (409 nếu đã assign)
- Validate: assistant đã hợp tác với mangaka (cooperation)
- Sau assign: cập nhật `chapter.status` → `assigned` (hoặc tương đương)

### 6. Upload pages — field name
Swagger: `images` (multipart, array). Xác nhận backend nhận đúng tên field `images` (nhiều file).

Response nên trả:
```json
{
  "success": true,
  "data": [
    { "_id": "pageId", "page_number": 1, "image_url": "https://..." }
  ]
}
```

---

## Ưu tiên trung bình — Series metadata

Frontend form có nhiều field hơn backend:

| Frontend | Backend hiện có | Đề xuất |
|----------|-----------------|---------|
| `genres[]` | `genre` (1 string) | `genres: string[]` hoặc `genre` CSV |
| `demographic`, `format`, `language` | `target_audience` | Thêm field hoặc map rõ |
| `contentRating` | — | Thêm |
| `publicationStatus` | `status` / `is_public` | Thống nhất enum |
| `publishType` (debut/continuing) | — | Thêm cho pipeline EB |
| `altTitle`, `tags`, `color` | — | Optional |
| Xóa series | Không có | `DELETE /series/{id}` |

`POST /series`: swagger ghi `multipart/form-data` nhưng backend cũng nhận JSON — **thống nhất docs**.

---

## Thiếu hoàn toàn — chưa có API

| Tính năng | Ghi chú |
|-----------|---------|
| Assistant gửi deliverable về Mangaka | Overlay/composite PNG, duyệt/reject |
| Paint layers (6 bước sản xuất) | Upload/lưu layer theo page |
| Tantou Editor workflow | Gửi chapter sang editor |
| Editor Board / EB biểu quyết | Debut pipeline |
| Xóa chapter | `DELETE /chapters/{id}` |
| Xóa page | `DELETE /pages/{id}` |
| Chapter cover (khác series cover) | Optional |
| Cập nhật status chapter qua PATCH | Document các giá trị: `draft`, `assigned`, `in_progress`, `submitted`, `published` |

---

## Trạng thái kết nối API (User workspace)

| Nhóm | Đã nối FE |
|------|-----------|
| Auth: send-otp, verify-otp, login, **me** | ✅ |
| Series: mine, ranking, all, CRUD, cover, chapters | ✅ |
| Chapters: CRUD, pages, assign/unassign, my-assignments | ✅ (unassign có service, chưa có nút UI) |
| Notes: GET/POST/PUT/DELETE | ✅ (fallback `/pages/...` và `/chapters/pages/...`) |
| Cooperation: requests + roster + **assistants** | ✅ |
| **Tasks**: create, my-assignments, by-chapter, start, submit, approve, revision, stats | ✅ |
| **Submissions**: mangaka list, submit-to-te | ✅ (Mangaka gửi TE) |
| Submissions: te queue, eb queue | ✅ service — **chưa gắn UI Tantou/EB** |
| Paint layers (6 bước) | ❌ vẫn localStorage/IndexedDB |
| Tantou nhận xét / revision | ❌ vẫn localStorage |
| Editor Board / EB biểu quyết | ❌ vẫn localStorage |
| Admin panel (/dashboard, /manga, /users…) | ❌ backend WDP không có route |

---

## Backend cần bổ sung / làm rõ (gửi team BE)

| # | Vấn đề | Chi tiết |
|---|--------|----------|
| 1 | **GET `/pages/{pageId}/notes`** | Trả 404 — FE fallback sang `/chapters/pages/{pageId}/notes`. Nên thống nhất 1 path. |
| 2 | **DELETE series/chapter** | FE có nút xóa nhưng chưa gọi API (backend chưa có route). |
| 3 | **Paint layers API** | Upload/lưu nhiều layer PNG theo page (6 bước sản xuất) — Assistant vẫn lưu browser. |
| 4 | **Task submit metadata** | FE nộp **cả chapter** (ảnh từng trang, không ghi chú) bằng cách gọi `POST /tasks/{id}/submit` lặp — nên có **`POST /chapters/{id}/submit-to-mangaka`** (multipart nhiều ảnh) cho gọn. |
| 5 | **Bulk tasks pending review** | Mangaka phải gọi `GET /tasks/chapter/{id}` từng chapter — cần `GET /tasks/mine?status=submitted` cho Mangaka. |
| 6 | **Submissions TE/EB response** | Document đủ field chapter + pages khi TE/EB lấy queue (`/submissions/te`, `/submissions/eb`). |
| 7 | **CORS + Render cold start** | `send-otp` đôi khi timeout khi server sleep. |
| 8 | **Series metadata** | `genres[]`, `publishType`, `contentRating` — form FE nhiều field hơn DB. |
| 9 | **Admin routes** | `/dashboard`, `/manga`, `/users`, `/stats`… — nếu cần admin panel riêng schema WDP. |

---

## Tasks API (đã nối FE — 2026-06-10)

| Method | Path | UI |
|--------|------|-----|
| POST | `/tasks` | Mangaka gửi chapter → tạo task từ ghi chú/trang |
| GET | `/tasks/my-assignments` | Assistant — danh sách task |
| GET | `/tasks/chapter/{chapterId}` | Mangaka — task trong chapter |
| PATCH | `/tasks/{id}/start` | Assistant bắt đầu |
| POST | `/tasks/{id}/submit` | Assistant nộp `result_image` |
| PATCH | `/tasks/{id}/approve` | Mangaka duyệt |
| PATCH | `/tasks/{id}/revision` | Mangaka yêu cầu sửa |
| GET | `/tasks/stats` | Assistant thu nhập/thống kê |

## Submissions API (đã nối FE — 2026-06-10)

| Method | Path | UI |
|--------|------|-----|
| GET | `/submissions/mangaka` | Hook `useMangakaTasks` (sẵn sàng dùng) |
| POST | `/submissions/chapters/{chapterId}/submit-to-te` | Mangaka gửi TE |
| GET | `/submissions/te` | Chưa gắn Tantou Editor |
| GET | `/submissions/eb` | Chưa gắn Editor Board |

---

## Auth (đã nối)

| Method | Path | Ghi chú |
|--------|------|---------|
| POST | `/auth/register/send-otp` | Gửi OTP 6 số qua email — **chưa tạo tài khoản** |
| POST | `/auth/register/verify-otp` | Gửi lại form + `otp` → tạo tài khoản |
| POST | `/auth/login` | `username`, `password` → JWT |
| GET | `/auth/me` | Bearer token |

**Luồng đăng ký:** form → `send-otp` → user nhập OTP → `verify-otp` → login.

Payload đăng ký: `username`, `full_name`, `email`, `password`, `role` (+ `otp` ở bước 2).

Role enum: `Mangaka`, `Assistant`, `Editor`, `EB`, `Reader`.

---

## Checklist test nhanh cho backend

1. [ ] CORS OK từ `localhost:5173`
2. [ ] Mangaka login → `GET /series/mine` → `POST /series` → `POST /chapters` → `POST /chapters/{id}/pages`
3. [ ] Mangaka tạo note → `POST /pages/{pageId}/notes` (field `text`, `x`, `y`, `w`, `h`, `taskType`)
4. [ ] Cooperation: Mangaka + Assistant đã hợp tác
5. [ ] `POST /chapters/{id}/assign` với `assistant_id` = userId
6. [ ] Assistant login → `GET /chapters/my-assignments` thấy chapter
7. [ ] Assistant → `GET /chapters/{id}/pages` + `GET /pages/{pageId}/notes`
8. [ ] Đăng ký: `send-otp` → `verify-otp` → login
9. [ ] Mangaka → `GET /cooperation-requests/assistants` browse Assistant

---

*Cập nhật: 2026-06-10 — OTP đăng ký, assistants API, PageNote schema mới.*
