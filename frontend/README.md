# Frontend

Một React SPA dùng Vite, TypeScript, React Router DOM, Zustand, Axios và Tailwind CSS. Không còn Module Federation hoặc nhiều frontend trên các cổng khác nhau.

```powershell
cd frontend
npm ci
npm run dev
```

Mở **http://localhost:5173**. Chạy backend bằng `cd backend` rồi `dotnet run` từ thư mục gốc repository. Vite proxy `/api` đến Gateway cổng 5100; Gateway định tuyến đến 6 service nên frontend giữ nguyên URL hiện có.

```text
src/pages       màn hình tương ứng URL, kết thúc bằng Page.tsx
src/components  component hiển thị; ui/ chứa phần dùng lại
src/layouts     khung đăng nhập và không gian làm việc
src/routes      AppRoutes và ProtectedRoute
src/services    axiosClient và các ...Api.ts
src/store       các use...Store.ts dùng Zustand
src/hooks       truy vấn và điều phối dùng chung
src/types       kiểu dữ liệu
src/utils       hàm kiểm tra/định dạng
src/styles      Tailwind và CSS component
```

Các màn chính: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/accounts`, `/accounts/new`, `/accounts/:id`, `/accounts/:id/edit`, `/employees`, `/departments`, `/change-password`.

Thông tin phiên lưu qua Zustand trong `sessionStorage`; refresh token là HttpOnly cookie. Axios gắn Bearer token cho API được bảo vệ và phối hợp refresh khi nhiều request gặp 401. ProtectedRoute chặn màn hình ngoài quyền, backend kiểm tra quyền độc lập.

Thêm màn hình bằng page, đăng ký route trong `routes/AppRoutes.tsx`, thêm menu ở `layouts/AppLayout.tsx`. Đặt HTTP call trong `services`, không gọi fetch trực tiếp ở component. Form nhận dữ liệu/callback qua props; trạng thái dùng chung mới đưa vào store.

```powershell
npm run build
```

Bản build nằm ở `dist`. Production cần reverse proxy cho `/api` và fallback các URL frontend về `index.html`; có thể dùng `VITE_API_BASE_URL` trỏ tới API đã triển khai. `API_PROXY_TARGET` chỉ dùng để đổi backend đích của Vite development proxy.

Xem [kiến trúc và quy ước nhóm](../docs/ARCHITECTURE.md) để thêm module.
