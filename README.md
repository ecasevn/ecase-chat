# Ecase Chat

Một phòng chat realtime tối giản, chạy hoàn toàn ở frontend với Vite.

## Chạy local

```bash
npm install
npm run dev
```

Mở URL Vite ở hai tab hoặc hai thiết bị, nhập cùng tên phòng và hai tên hiển thị khác nhau. Người tạo phòng cần giữ tab mở để làm host tạm thời.

## Build để deploy

```bash
npm run build
npm run preview
```

Project không có backend riêng và không lưu tin nhắn. Kết nối giữa các trình duyệt dùng WebRTC thông qua PeerJS Cloud ở bước signaling; dữ liệu chat đi trực tiếp qua peer đang giữ phòng. Vì vậy server chỉ cần phục vụ các file frontend tĩnh.

## Lưu ý vận hành

Phòng cần có ít nhất một người đang mở tab để làm host. Nếu host rời đi, những người còn lại cần mở lại link khi host vào lại. Nếu cần chạy production độc lập hoàn toàn, có thể thay PeerJS Cloud bằng một PeerServer tự host sau này.
