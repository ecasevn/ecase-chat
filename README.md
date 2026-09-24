# Ecase Chat

Phòng chat công khai, API Node lưu toàn bộ tin nhắn vào `data/messages.json` trên server.

## Ba cổng

| Cổng | Vai trò |
|---|---|
| `5173` | Người dùng bình thường |
| `5174` | Admin: xem toàn bộ và xóa lịch sử |
| `13000` | Dev monitor: xem trạng thái API và toàn bộ tin nhắn |

Các cổng đều lắng nghe IPv4 `0.0.0.0` và cho phép:

- `ecase.net.vn`
- mọi subdomain của `ecase.net.vn` qua `.ecase.net.vn`

## Chạy development

```bash
npm install
npm run dev
```

Mở:

```text
http://IP_SERVER:5173       # user
http://IP_SERVER:5174       # admin
http://IP_SERVER:13000      # dev
```

Ba giao diện dùng chung API nội bộ ở port `3001`. Tin nhắn được lưu trên server và toàn bộ lịch sử được render, không dùng `localStorage` cho tin nhắn và không phân trang.

## Chạy sau khi build

```bash
npm run build
npm run start:ports
```

Admin hiện chưa có cơ chế đăng nhập, nên chỉ nên mở port `5174` trong mạng test nội bộ hoặc thêm auth/reverse proxy trước khi public Internet.

File `data/messages.json` được tạo tự động và đã được gitignore để dữ liệu chat không bị commit lên GitHub.
