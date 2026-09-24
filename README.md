# Ecase Chat

Phòng chat công khai với ba giao diện riêng.

## Cổng truy cập

| Cổng | Giao diện |
|---|---|
| `5173` | Chat công khai |
| `5174` | Quản lý tin nhắn |
| `13000` | Bảng kiểm tra |

Các cổng chấp nhận:

- `ecase.net.vn`
- `*.ecase.net.vn`

## Chạy

```bash
npm install
npm run dev
```

Truy cập:

```text
http://IP_SERVER:5173
http://IP_SERVER:5174
http://IP_SERVER:13000
```

## Chạy bản build

```bash
npm run build
npm run start:ports
```

Ba giao diện dùng chung một lịch sử tin nhắn. Giao diện quản lý hiện dành cho môi trường kiểm thử nội bộ.
