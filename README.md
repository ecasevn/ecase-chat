# Ecase Chat

Một phòng chat công khai đơn giản: frontend chạy bằng Vite, API Node lưu toàn bộ tin nhắn vào `data/messages.json` trên server.

## Chạy development

```bash
npm install
npm run dev
```

Lệnh này chạy cả API ở port `3001` và Vite ở port `5173`. Vite lắng nghe IPv4 `0.0.0.0`, truy cập từ máy khác bằng:

```text
http://IP_SERVER:5173
```

Tin nhắn được POST vào server, polling mỗi giây rồi render toàn bộ lịch sử chung. Không dùng `localStorage` để lưu tin nhắn và không phân trang.

## Chạy production

```bash
npm run build
npm start
```

Server Node sẽ vừa phục vụ thư mục `dist`, vừa chạy API tại port `3001` trên IPv4 `0.0.0.0`. Truy cập:

```text
http://IP_SERVER:3001
```

Có thể đổi port bằng biến môi trường:

```bash
PORT=8080 npm start
```

File `data/messages.json` được tạo tự động và nằm trên server. File này đã được gitignore để dữ liệu chat không bị commit lên GitHub.
