# Ecase Chat

Một phòng chat realtime công khai, chạy hoàn toàn ở frontend với Vite.

## Chạy local

```bash
npm install
npm run dev
```

Vite đã được cấu hình lắng nghe trên IPv4 `0.0.0.0`. Truy cập từ máy khác bằng `http://IP_SERVER:5173` (hoặc port bạn đã cấu hình firewall/proxy). Mở link là vào ngay phòng chung; tên khách được tạo tự động và có thể sửa ngay trên thanh đầu trang. Người tạo phòng cần giữ tab mở để làm host tạm thời.

## Build để deploy

```bash
npm run build
npm run preview
```

Lệnh preview cũng lắng nghe trên IPv4 `0.0.0.0`.

Project không có backend riêng và không lưu tin nhắn trên server. Kết nối giữa các trình duyệt dùng WebRTC thông qua PeerJS Cloud ở bước signaling; dữ liệu chat đi trực tiếp qua peer đang giữ phòng. Vì vậy server chỉ cần phục vụ các file frontend tĩnh.

Lịch sử tối đa 100 tin nhắn cũng được lưu trong `localStorage` của từng trình duyệt để giữ lại sau khi refresh. Xóa dữ liệu site sẽ xóa lịch sử local.

## Lưu ý vận hành

Phòng cần có ít nhất một người đang mở tab để làm host. Nếu host rời đi, những người còn lại cần mở lại link khi host vào lại. Nếu cần chạy production độc lập hoàn toàn, có thể thay PeerJS Cloud bằng một PeerServer tự host sau này.
