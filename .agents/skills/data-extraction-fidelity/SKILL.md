---
name: data-extraction-fidelity
description: Quy tắc BẮT BUỘC khi trích xuất dữ liệu từ Web Portal API vào Excel. Đảm bảo dữ liệu được sao chép TRUNG THỰC, Y NGUYÊN so với nguồn gốc. Áp dụng cho tất cả các hàm fetch_data, map_dataN trong extract_data.py.
---

# Data Extraction Fidelity — Nguyên Tắc Sao Chép Dữ Liệu Trung Thực

## NGUYÊN TẮC CỐT LÕI (BẮT BUỘC)

> **Dữ liệu thô lấy từ API phải được ghi vào Excel Y NGUYÊN, TRUNG THỰC nhất có thể so với những gì WEB PORTAL hiển thị. KHÔNG được tự ý đổi, bỏ, thêm giá trị.**

---

## 1. Quy Tắc Ánh Xạ Cột (Column Mapping)

### 1.1. Xác Định Cột Chuẩn Từ Web Portal
- **TRƯỚC KHI viết code**, phải mở trang web portal tương ứng và ghi nhận CHÍNH XÁC:
  - Thứ tự các cột từ trái sang phải
  - Tên tiêu đề cột
  - Kiểu dữ liệu (text, số, ngày)
- File Excel phải có tiêu đề cột (Row 1) KHỚP CHÍNH XÁC với web portal.
- Hàm `map_dataN()` trong Python phải trả về mảng giá trị ĐÚNG THỨ TỰ cột.

### 1.2. Liệt Kê ĐẦY ĐỦ Tất Cả Cột
- Phải map TẤT CẢ các cột mà web portal hiển thị, không được bỏ sót.
- Nếu API trả về thiếu key cho một cột nào đó, ghi giá trị rỗng `""` — KHÔNG ĐƯỢC bỏ cột.

---

## 2. Quy Tắc Giá Trị (Value Fidelity)

### 2.1. Nguyên Tắc Chung
- **KHÔNG** tự ý thay đổi, chuyển đổi, làm tròn, cắt bớt giá trị.
- **KHÔNG** tự ý bỏ ký tự (VD: bỏ số 0 đầu mã kho `052` → `52` là SAI).
- Giá trị `None` hoặc `null` từ API → ghi thành chuỗi rỗng `""`.

### 2.2. Quy Tắc Tên Kho (Warehouse Name)
- API thường trả về `whsename`, `fromwhsename`, `towhsename` chỉ là **MÃ CODE** (VD: `"SKH"`, `"CC"`, `"061"`), KHÔNG PHẢI tên đầy đủ.
- Web portal tự map code → tên đầy đủ ở phía frontend.
- **BẮT BUỘC**: Code Python phải duy trì bảng `WHSE_NAME_MAP` đầy đủ để tra cứu tên kho.
  - Cột `KHO NHẬP` / `KHO XUẤT`: Dùng `WHSE_NAME_MAP.get(whse_code, whse_code)` — ưu tiên tên đầy đủ, fallback về code nếu chưa có trong bảng.
  - Cột `MÃ KHO` / `MÃ KHO NHẬP` / `MÃ KHO XUẤT`: Giữ nguyên code gốc.
- Khi phát hiện mã kho mới chưa có trong `WHSE_NAME_MAP`, phải **BỔ SUNG NGAY** vào bảng map.

### 2.3. Quy Tắc Ngày Tháng (Date Handling)
- API trả về ngày dạng ISO 8601 UTC: `"2026-08-04T17:00:00.000Z"`
- Web portal tự cộng múi giờ +7 (VN) trước khi hiển thị: `05/08/2026`
- **BẮT BUỘC**: Hàm `format_date()` phải:
  1. Phát hiện chuỗi kết thúc bằng `Z` hoặc `.000Z` → cộng thêm 7 giờ
  2. Chuyển đổi sang định dạng `dd/mm/yyyy`
  3. Nếu không phải ISO UTC, chỉ cắt chuỗi `YYYY-MM-DD` → `dd/mm/yyyy`

### 2.4. Quy Tắc Số Lượng
- Giá trị số từ API thường ở dạng chuỗi: `"180.00000"` hoặc số `3`
- Phải dùng hàm `to_number()` để chuyển đổi hợp lý (bỏ `.00000` thừa).
- **KHÔNG** tự ý làm tròn hoặc cắt số thập phân có ý nghĩa.

### 2.6. Quy Tắc Ánh Xạ Trạng Thái (Status Mapping cho data1-đi đường)
- Mã `status == "0"` (hoặc `"99"`, `"28"`, `"20"`) ➔ Ánh xạ thành **`ARRIVED`** (Xe đã tới kho).
- Mã `status == "16"` ➔ Ánh xạ thành **`NEW`** (Xe đang đi đường / Mới tạo).
- Mã `status == "11"` ➔ Ánh xạ thành **`CANCELED`** (Đã hủy).
- **TUYỆT ĐỐI KHÔNG** gom chung mã `0` và `16` thành `NEW`.

---

## 3. Quy Tắc Lọc Kho Mục Tiêu

- **CHỈ lấy** dữ liệu của các kho nằm trong `TARGET_WHSE_IDS`: `052`, `05KH`, `05NT`, `SKH`.
- Lọc theo trường `whseid` (kho nhận/kho chính).
- Kho xuất (`fromwhseid`) có thể là bất kỳ kho nào — KHÔNG LỌC theo kho xuất.

---

## 4. Quy Tắc Bảo Toàn Cột Công Thức (Cột Vàng)

- Các cột bôi nền vàng trong Excel chứa công thức — **TUYỆT ĐỐI KHÔNG XÓA, KHÔNG GHI ĐÈ**.
- Khi xóa dữ liệu cũ, chỉ dùng `ClearContents` trên vùng dữ liệu thô, KHÔNG DÙNG `Delete()`.
- Sau khi dán dữ liệu mới, dùng `FillDown()` để kéo công thức xuống dòng mới.
- Xóa `ClearContents` các dòng thừa (từ dòng cuối data đến dòng cuối cũ).

---

## 5. Quy Trình Kiểm Tra Khi Thêm Sheet Data Mới

1. **Mở web portal** → Xem trang tương ứng → Ghi nhận cột, thứ tự, dữ liệu mẫu
2. **Gọi API 1 record** (`limit: 1`) → Liệt kê tất cả keys → So khớp với cột trên web
3. **Viết hàm `map_dataN()`** → Trả về mảng ĐÚNG thứ tự cột, ĐÚNG giá trị
4. **Test thử** → So sánh 5-10 dòng đầu tiên với web portal → Phải KHỚP 100%
5. **Nếu có cột web hiển thị nhưng API không trả key** → Kiểm tra API khác hoặc cột tính toán

---

## 6. Bảng Tham Chiếu WHSE_NAME_MAP

Bảng map mã kho → tên kho phải được cập nhật đầy đủ trong `extract_data.py`:

```python
WHSE_NAME_MAP = {
    # 4 kho mục tiêu
    "052": "Kho Bình Thuận",
    "05KH": "Kho NTB tại NM BSG Khánh Hòa",
    "05NT": "Kho NTB tại NM BSG Ninh Thuận",
    "SKH": "Kho TĐ BSG tại NM BSG Khánh Hòa",
    # Các kho khác trong hệ thống
    "CC": "NM BSG Cù Chi",
    "061": "NM BSG Cần Thơ",
    "040": "Kho Đắk Lắk",
    "041": "Kho Gia Lai",
    "161": "NM BSG Ninh Thuận",
    "20D": "Tổng Kho Cù Chi",
    "151": "NM BSG Phú Yên",
    "166": "NM BSG Lâm Đồng",
    "060A": "Kho Bình Dương",
    "164": "NM BSG Khánh Hòa",
    "157": "NM BSG Bình Thuận",
    # ... thêm kho mới khi phát hiện
}
```

> [!IMPORTANT]
> Khi gặp mã kho mới chưa có trong bảng → PHẢI mở web portal xác nhận tên chính xác → bổ sung vào `WHSE_NAME_MAP`.

---

## 7. Checklist Trước Khi Hoàn Thành

- [ ] Mọi cột trên web portal đều có trong hàm map
- [ ] Thứ tự cột khớp với Excel
- [ ] Ngày tháng đã cộng múi giờ +7
- [ ] Mã kho giữ nguyên số 0 đầu (052 không bị thành 52)
- [ ] Tên kho hiển thị đầy đủ (không phải code)
- [ ] Cột vàng (công thức) không bị đụng
- [ ] Số lượng không bị làm tròn sai
