# Frontend base

Một React SPA dùng Vite, TypeScript, React Router DOM, Axios, Zustand và Tailwind CSS.

```powershell
npm ci
npm run dev
```

Mở http://localhost:5173; chạy backend bằng dotnet run ở thư mục backend trong terminal khác. Vite proxy /api đến http://localhost:5100. Bản base chỉ hiển thị trang khung, chưa có màn login hoặc nghiệp vụ.

- pages: component theo route, tên ...Page.tsx.
- components/ui: UI tái sử dụng; nhận props và callback.
- layouts: khung trang; routes: cấu hình route và ProtectedRoute.
- services: Axios client và các ...Api.ts khi bổ sung chức năng.
- store: Zustand useAuthStore/useAppStore; auth store và guard là hạ tầng dùng chung cho các module được bảo vệ.
- hooks, types, utils, styles: phần dùng chung.

Đặt HTTP call trong services. Chỉ đưa trạng thái cần dùng chung vào store. Khi thêm chức năng, đăng ký route và menu tương ứng; backend vẫn phải kiểm tra quyền độc lập. App base không gọi refresh/me vì API xác thực chưa được triển khai.

Build bằng npm run build. Production cần SPA fallback về index.html và reverse proxy cho /api. VITE_API_BASE_URL/API_PROXY_TARGET là cấu hình địa chỉ API, không đặt secret trong frontend.
