# BÁO CÁO TỔNG KẾT DỰ ÁN VIBECHAT
**Tài liệu hỗ trợ trình bày dự án (Presentation Guide)**

---

## 1. TỔNG QUAN HỆ THỐNG CÔNG NGHỆ (TECH STACK)

Dự án VibeChat được xây dựng theo mô hình **Client-Server** với các công nghệ hiện đại nhất hiện nay, bao gồm:

### 1.1. Frontend (Giao diện người dùng)
- **Framework:** React.js (xây dựng qua Vite giúp biên dịch siêu tốc).
- **Styling:** CSS thuần (Vanilla CSS) kết hợp mô hình CSS Variables, ứng dụng phong cách thiết kế **Glassmorphism** (hiệu ứng kính mờ trong suốt, hiện đại).
- **Real-time (Thời gian thực):** `socket.io-client` để nhận gửi tin nhắn ngay lập tức.
- **WebRTC (Gọi điện/Video):** `peerjs` để tạo kết nối mạng ngang hàng (P2P) hỗ trợ gọi video và âm thanh.
- **HTTP Client:** `axios` dùng để gọi API (RESTful).
- **Thư viện phụ trợ:** `lucide-react` (icon), `emoji-picker-react` (bộ chọn cảm xúc).

### 1.2. Backend (Máy chủ & Logic)
- **Nền tảng:** Node.js.
- **Web Framework:** Express.js (để xây dựng các RESTful API).
- **Real-time Server:** `socket.io` (quản lý kết nối, phòng chat, thông báo theo thời gian thực).
- **Peer Server:** Sử dụng thư viện `peer` chạy trên cổng 5001 làm server trung gian (Signaling server) cho các cuộc gọi WebRTC.
- **Bảo mật:** `jsonwebtoken` (JWT) để cấp phiên đăng nhập, `bcryptjs` để mã hóa mật khẩu 1 chiều.
- **Xử lý file:** `multer` để nhận và lưu trữ file upload (ảnh, tài liệu, âm thanh).

### 1.3. Database (Cơ sở dữ liệu)
- **Hệ quản trị CSDL:** Microsoft SQL Server (LocalDB).
- **Kết nối:** Thư viện `mssql` kết hợp `msnodesqlv8` giúp truy vấn SQL trực tiếp bằng Node.js thông qua Windows Authentication (không cần username/password DB).

---

## 2. CÁC TÍNH NĂNG ĐÃ LÀM ĐƯỢC (HIGHLIGHTS)

Khi lên trình bày, bạn có thể demo trực tiếp (chạy thử) các tính năng xịn sò sau đây của ứng dụng:

### 2.1. Nhắn tin thời gian thực (Real-time Messaging)
- Nhắn tin 1-1 và Nhắn tin nhóm (Group chat).
- Hiển thị trạng thái "Đang gõ..." (Typing indicator).
- Hiển thị trạng thái Online / Offline theo thời gian thực (chấm xanh).
- Tính năng thông báo tin nhắn chưa đọc (Unread badge).

### 2.2. Xử lý Đa phương tiện (Media Handling)
- **Gửi ảnh & File:** Gửi hình ảnh hiển thị trực tiếp trên chat, gửi các tệp tài liệu cho phép click để tải về.
- **Tin nhắn thoại (Voice message):** Tính năng bấm để ghi âm (Record) trực tiếp trên trình duyệt và gửi đi nhanh chóng.
- Upload Avatar người dùng.

### 2.3. Trải nghiệm người dùng cực cao (UX/UI Features)
- **Thả cảm xúc (Reactions):** Thả tim, like, haha... vào từng bong bóng tin nhắn cụ thể, tương tự Messenger/Zalo.
- **Trả lời tin nhắn (Reply):** Nhấn reply để trích dẫn lại một tin nhắn cũ, bấm vào có thể xem lại ngữ cảnh.
- **Tải tin nhắn thông minh (Infinite Scroll / Pagination):** Không tải toàn bộ dữ liệu làm đơ máy, mặc định tải 20 tin nhắn mới nhất. Khi cuộn màn hình lên trên cùng sẽ mượt mà tải thêm tin nhắn cũ (Scroll to load more).
- **Đa ngôn ngữ (I18n):** Chuyển đổi linh hoạt giữa Tiếng Việt, Tiếng Anh và Tiếng Nhật.
- **Dark Mode:** Nút chuyển đổi giao diện sáng/tối.

### 2.4. Gọi điện Video & Chia sẻ màn hình (WebRTC Calls)
- Cung cấp tính năng gọi thoại (Audio Call).
- Gọi Video (Video Call) với độ trễ cực thấp do kết nối trực tiếp hai máy tính (P2P).
- **Đặc biệt:** Tính năng Chia sẻ màn hình (Share Screen) thích hợp cho làm việc nhóm.

### 2.5. Bảo mật & Quản lý dữ liệu
- Mật khẩu người dùng không lưu chữ thô mà được băm (hash) bằng Bcrypt.
- Xác thực người dùng bằng JWT Token để đảm bảo các API gọi lên là hợp lệ.
- Cơ chế khởi tạo Database tự động (Auto Migration): Chỉ cần chạy server là các bảng (Tables) tự động được tạo/cập nhật, không cần setup SQL thủ công rườm rà.

---

## 3. GỢI Ý CÁCH TRÌNH BÀY (LUỒNG DEMO)
1. **Mở đầu:** Giới thiệu tổng quan về mục đích ứng dụng (app chat kết nối mọi người với giao diện mượt mà). Đọc sơ qua các công nghệ sử dụng.
2. **Đăng nhập/Đăng ký:** Mở 2 cửa sổ trình duyệt (1 cái Chrome, 1 cái Ẩn danh) để đăng nhập 2 tài khoản khác nhau.
3. **Demo Real-time:** Dùng tab này nhắn tin cho tab kia, chỉ ra tốc độ nhận tin nhắn ngay lập tức và tính năng "Đang gõ...".
4. **Demo Tính năng chuyên sâu:** Gửi 1 tấm ảnh, thu âm 1 đoạn voice để gửi, sau đó tiến hành "Reply" (trả lời) và "Thả tim" vào tin nhắn đó.
5. **Demo Scroll:** Lướt lên để cho giảng viên thấy tính năng tải thêm tin nhắn mượt mà (Pagination).
6. **Demo Call (Tùy chọn):** Bấm nút gọi video hoặc chia sẻ màn hình giữa 2 tab để show tính năng nâng cao (Điểm cộng rất lớn).
7. **Kết luận:** Show một chút đoạn code `server.js` hoặc `Chat.jsx` để chứng minh nhóm tự code cấu trúc logic. Mở SQL Server lên cho xem data đã lưu.
