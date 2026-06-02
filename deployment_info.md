# Thông tin Server Deploy (KySoServer)

> [!WARNING]
> File này chứa cấu hình kết nối tới Production Server. Tuyệt đối không commit file này lên Github Public.

- **IP Address (Local):** `192.168.99.150`
- **SSH Port:** `22`
- **Username:** `n8n`
- **Password:** `Vinhduc@2025`
- **Service Port:** `7000` (Port chạy WebSocket/HTTP)

## Ghi chú
Sử dụng script `deploy.ps1` để tự động đẩy code lên host này mỗi khi có bản cập nhật mới.
Đường dẫn deploy trên server (dự kiến): `/home/n8n/KySoServer`
