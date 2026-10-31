# Tra cứu TDP Quy Nhơn V4.0.0

V4 dùng dữ liệu từ **CSDL_tra_cuu_dia_chi_phuong_Quy_Nhon_V4 (đã cập nhật).xlsx**.
Ngày phát hành gói: **31/10/2026**. V3.1.0 được giữ nguyên trên nhánh main.
Hai header dùng nguyên ảnh đã được tác giả chốt. Quy Nhơn Nam hiện màn thông
báo sắp ra mắt. Phiên bản và ngày phát hành nằm ở phần thông tin cuối trang.
Gói ZIP đầy đủ có source và thư mục `dist/` đã build. Chưa deploy lên website.

## Chạy bản phát hành

Giải nén ZIP, mở terminal tại thư mục có `package.json`, chạy:

```sh
npm run preview
```

Mở **http://127.0.0.1:4174/** trên cùng máy. Giữ terminal mở trong lúc dùng app.
Không cần `npm install`. Sau khi sửa source, chạy `npm run build` rồi mở lại app.
Không mở trực tiếp `index.html` bằng cách nhấp đúp.

Khi deploy, dùng HTTPS để tính năng SĐT được trình duyệt hỗ trợ. Khi chạy tại
máy, địa chỉ `127.0.0.1`/`localhost` dùng được. Lệnh `npm run check` cần Node.js
18 trở lên. Bộ chuyển Excel cần thêm Python 3.

## Cập nhật dữ liệu

Chỉnh bản ghi số nhà ở sheet **Master Data**; chỉnh tên chính và alias tại
**Tên đường và alias V4**; chỉnh liên hệ/SĐT ở **Liên hệ và SĐT**; chỉnh lịch sử
địa bàn ở **Quy đổi địa bàn V4**. Khi đổi tên đường có sẵn, chỉnh tên chính trong
sheet tên đường và alias: bộ chuyển dữ liệu tự áp dụng tên đó cho các bản ghi
cũ. Khi thêm đường mới, thêm các đoạn vào Master Data. Địa chỉ có hậu tố riêng
như 58A/58B nên ghi mỗi số thành một bản ghi riêng.

Chạy từ thư mục dự án:

```sh
npm run data:build -- "/đường/dẫn/CSDL_tra_cuu_dia_chi_phuong_Quy_Nhon_V4.xlsx"
npm run check
npm run build
npm run preview
```

Công cụ yêu cầu nhập mật khẩu mã hóa SĐT trong terminal, rồi tạo các JSON cho
web. Không cần tự sửa JSON hoặc source. Nếu dữ liệu mới tạo xung đột TDP chưa
được chốt, công cụ dừng và báo địa chỉ liên quan. Bốn xung đột đã chờ xác minh
và bản ghi Đường 31/3 được giữ như CSDL V3. Đối với hẻm, lô và khoảng hậu tố
phức tạp, cần xem kết quả tra cứu sau khi sửa vì kiểm tra tự động tập trung
vào các khoảng thuần số.

Chỉ xuất nội dung `dist/` khi đến bước deploy. Excel gốc và SĐT dạng rõ không
được đưa lên website. Mật khẩu chung ngắn vẫn có thể bị đoán qua dữ liệu mã hóa
được công khai; cơ chế này không phân quyền theo từng người.
