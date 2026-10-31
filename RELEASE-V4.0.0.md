# V4.0.0 — 31/10/2026

- Tách giao diện, logic tra cứu, dữ liệu và công cụ chuyển dữ liệu Excel.
- Dữ liệu từ CSDL V4 đã cập nhật, giữ các cách xử lý xung đột đã chốt.
- Xem SĐT cạnh liên hệ: hộp mật khẩu, Hiện/Ẩn mật khẩu, tên liên hệ và TDP,
  báo mật khẩu sai, hiện SĐT và Copy SĐT với cách sao chép dự phòng.
- SĐT dùng AES-GCM và PBKDF2; không chứa SĐT dạng rõ trong gói web.
- Header Quy Nhơn và Quy Nhơn Nam dùng đúng hai ảnh đã được tác giả duyệt.
- Nút chuyển phường dùng biểu tượng định vị/nguyên tử và màu xanh tương ứng.
- Quy Nhơn Nam hiển thị thông báo chuẩn bị tính năng tra cứu Khu phố.
- Bỏ phiên bản/ngày phát hành dưới header, giữ thông tin này ở cuối trang.

Đã kiểm tra build, 6 kiểm tra tự động, giải mã 22 SĐT với đúng mật khẩu và từ
chối mật khẩu sai; kiểm tra tra cứu mẫu và chuyển phường trên trình duyệt.
Địa chỉ preview nội bộ không hỗ trợ Web Crypto nên phần giải mã được xác minh
riêng bằng Web Crypto trong Node. Cần kiểm tra cuối trên máy Windows/điện thoại
thực tế của tác giả trước khi deploy. Quy trình deploy sẽ được chốt riêng.
