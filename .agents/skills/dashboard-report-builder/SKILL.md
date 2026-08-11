---
name: dashboard-report-builder
description: Quy trình tự động chuyển đổi dữ liệu Excel thành Web Dashboard Light Theme với bộ lọc tích chọn đa chiều áp dụng cho tất cả báo cáo, sắp xếp gom nhóm cột và bảng báo cáo chuẩn Excel thu gọn.
---

# Dashboard Report Builder Skill

Skill này hướng dẫn quy trình tạo, tối ưu và mở rộng các Báo cáo (Dashboard) hiển thị nền Web từ tệp Excel báo cáo.

## 1. Trích xuất Dữ liệu (Excel to JavaScript Data Store)
- Đọc các sheet từ file `báo cáo.xlsx` bằng Python (`pandas` / `openpyxl`).
- Xử lý triệt để mã hóa UTF-8, các đối tượng `datetime` / `Timestamp` / `NaN` để tránh lỗi JSON serializing.
- Chuyển đổi dữ liệu thành cấu trúc JSON và ghi ra file `data.js`:
  ```javascript
  window.DASHBOARD_DATA = {
    "baocao1": [...],
    "data1-đi đường": [...],
    "Append1 Nhập- Xuất": [...],  // nguồn ngày hoạt động chính xác
    "data6-tồn kho theo HSD": [...],
    ...
  };
  ```

## 2. Quy Trình Cấu Hình Bộ Lọc Chung (Global Filter Toolbar)
- Cung cấp **3 Bộ Lọc Chung** chuẩn đồng bộ cho tất cả các Báo cáo:
  1. **Mã Kho**: Lọc các kho tiêu chuẩn `052`, `05NT`, `05KH`, `SKH`.
  2. **Ngày**: Trích xuất tự động từ sheet `Append1 Nhập- Xuất`, cột `NGÀY` — các ngày hoạt động thực tế chính xác nhất.
  3. **Nhóm Hàng**: Tích chọn `TP` (Thành phẩm), `BB` (Bao bì), `PL` (Pallet).

### Quy tắc Z-Index Tránh Lỗi Đè Menu Bộ Lọc:
- Đặt `.filter-toolbar { position: relative; z-index: 100; overflow: visible !important; }`.
- Khi người dùng nhấp mở dropdown, gán `.active-dropdown` (`z-index: 1000`) cho `.filter-group` và `.dropdown-menu { z-index: 9999; }`.

## 3. QUY TẮC BỘ LỌC ÁP DỤNG CHO TẤT CẢ BÁO CÁO (QUAN TRỌNG)
**Bắt buộc**: Mỗi khi người dùng thay đổi bất kỳ bộ lọc chung nào, hàm sự kiện phải kích hoạt re-render **tất cả** báo cáo có cột dữ liệu tương ứng.

### Bộ lọc áp dụng cho báo cáo nào:
| Bộ lọc | Áp dụng khi sheet data có cột |
|--------|-------------------------------|
| Mã Kho | `MÃ KHO` (Đã được chuẩn hóa chung cho tất cả các sheet) |
| Ngày | `NGÀY` (Hoặc các biến thể ngày như `Column1`, `NGÀY NHẬP`) |
| Nhóm Hàng | `NHÓM HÀNG` |

- Khuyến nghị: Chuẩn hóa tên cột trong Excel thành `MÃ KHO` cho mọi báo cáo. Code Javascript sử dụng `getSafeValue(row, ['MÃ KHO'])` để tự động xử lý chữ hoa/thường, có dấu/không dấu (Mã Kho, mã kho, MÃ KHO).
- Nếu sheet **không có** cột tương ứng → bộ lọc đó bỏ qua, không gây lỗi.

### Mẫu code chuẩn — checkbox onChange và selectAll:
```javascript
// Trong renderCheckboxList — checkbox.addEventListener:
updateFilterTriggerLabels();
applyFiltersAndRender();        // BC1 — data1-đi đường
applyFiltersAndRenderBC2();     // BC2 — data6-tồn kho theo HSD
// applyFiltersAndRenderBC3();  // BC3 khi thêm sau

// Trong selectAll — tương tự:
updateFilterTriggerLabels();
applyFiltersAndRender();
applyFiltersAndRenderBC2();
```

### Mẫu code chuẩn — applyFiltersAndRenderBCN:
```javascript
function applyFiltersAndRenderBC2() {
  const filteredRows = rawDataBC2.filter(row => {
    const maKho = String(row['MÃ KHO'] || '').trim();
    const pctHSD = parseFloat(row['(%) HSD']);
    // (%) HSD < 60: % còn lại dưới 60% = sắp hết hạn — CẦN CẢNH BÁO
    return selectedKho.has(maKho) && !isNaN(pctHSD) && pctHSD < 60;
  });
  // ... render KPI + table BC2
}
```

## 4. Render KPI & Bảng Chi Tiết Dạng Excel
- **KPI (Dạng 2 Dòng Nhỏ - `.kpi-excel-box`)**: Label: Value trên cùng 1 dòng.
- **Bảng (`.excel-table`)**: Mật độ dòng nhỏ (`padding: 6px 12px`), sọc caro, click-to-sort tất cả `th`.
- Grand Total footer tự động tính tổng chân bảng.

## 5. Kiến Trúc Tabs Mở Rộng Nhiều Báo Cáo
- Mỗi báo cáo trong `<div class="report-section" id="report-bcN">`.
- Hàm `switchReport(reportId)` ẩn/hiện section và cập nhật tab active.
- Khi chuyển tab, gọi lại hàm render tương ứng (`applyFiltersAndRenderBCN()`).

## 6. Khởi Chạy Độc Lập Qua `run.bat`
- Batch file: `python -m http.server 8080` và tự động mở `http://localhost:8080`.
