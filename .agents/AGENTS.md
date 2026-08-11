# Quy tác Dự án Dashboard Báo cáo (Project Rules)

## 1. Độc lập & Tương thích Cross-Machine (Cross-Computer Portability)
- Tất cả ứng dụng và script (`run.bat`, `extract_data.py`, `index.html`, `app.js`, `styles.css`) phải đảm bảo hoạt động độc lập khi sao chép sang bất kỳ máy tính Windows nào khác.
- Tuyệt đối không dùng đường dẫn tuyệt đối dạng `C:\...` hay `D:\...` trong code HTML/CSS/JS hay batch scripts. Chỉ dùng đường dẫn tương đối (relative paths).
- Tránh phụ thuộc vào Node.js, npm hay bất kỳ package manager phức tạp nào. Chỉ sử dụng HTML/CSS/JS thuần và Python có sẵn trên máy.

## 2. Web App / Dashboard Localhost
- Chương trình Web Dashboard phải chạy giả lập mượt mà trên localhost hoặc mở trực tiếp file `index.html` bằng trình duyệt web.
- Dữ liệu Excel phải được chuyển đổi sẵn ra file `data.js` / `data.json` để tránh lỗi CORS khi mở trực tiếp file HTML local.

## 3. Quản lý Dữ liệu Data Sheets & Report Sheets
- Các sheet bắt đầu bằng chữ `data` (như `data1-đi đường`, `data2-nhập`, `data3-xuất`...) là nguồn dữ liệu raw không thay đổi hoặc xóa cấu trúc.
- Các sheet `baocao` (như `baocao1`...) là căn cứ logic để hiển thị các chỉ số KPI (B1, B2...) và bảng dữ liệu lên Dashboard.

## 4. Chuẩn Bộ Lọc Chung (Global Filter Toolbar)
- Cấu hình 3 Bộ lọc chung chuẩn dùng nhất quán cho tất cả các Báo cáo:
  1. **Mã Kho** (gồm các kho chỉ định: 052, 05NT, 05KH, SKH).
  2. **Ngày** (lấy từ sheet `Append1 Nhập- Xuất`, cột `NGÀY` — các ngày hoạt động thực tế).
  3. **Nhóm Hàng** (gồm TP, BB, PL).
- Thiết kế giao diện Light Theme hiện đại, tương phản cao, badge đếm số lượng chọn rõ ràng.

## 5. Quy tắc Z-Index & Xử lý Menu Bộ Lọc Dropdown (QUAN TRỌNG)
- Khung bộ lọc `.filter-toolbar` phải luôn được đặt `position: relative; z-index: 100; overflow: visible !important;` để không bị cắt xén (clip) hay bị các khối KPI bên dưới che mất.
- Khi người dùng click mở menu dropdown, thẻ `.filter-group` tương ứng phải được gán class `.active-dropdown` với `z-index: 1000;`, và `.dropdown-menu` phải có `z-index: 9999;` cùng hiệu ứng đổ bóng nổi (`box-shadow: 0 25px 60px rgba(0, 0, 0, 0.95)`).

## 6. Chuẩn Bảng Chi Tiết Mật Độ Cao Dạng Excel (`.excel-table`)
- Bảng dữ liệu chi tiết phải được thiết kế theo dạng Bảng Excel thu gọn (`.excel-table`): Mật độ dòng nhỏ (`padding: 6px 12px`), phông chữ sắc nét 13px, viền ô crisp border (`border: 1px solid rgba(255,255,255,0.06)`), và dòng chẵn/lẻ sọc caro (zebra striping `tr:nth-child(even)`).
- Không lãng phí diện tích chiều cao bằng padding quá lớn.

## 7. Chuẩn Khối Chỉ Số B1, B2 Đơn Giản Dạng 2 Dòng Nhỏ (Như File Excel `baocao1`)
- Các chỉ số B1 (Số chuyến Đã đến) và B2 (Số chuyến đang đi đường) phải được thiết kế siêu thu gọn dưới dạng **2 dòng nhỏ đơn giản (Compact 2-line Box)** giống cấu trúc Excel `baocao1`.
- Tránh làm các thẻ KPI hero to béo, phức tạp gây tốn diện tích màn hình.

## 8. Mặc Định Sắp Xếp & Gom Nhóm Theo Cột TRẠNG THÁI
- Mặc định bảng dữ liệu luôn tự động gom nhóm và sắp xếp theo cột `TRẠNG THÁI` (hiển thị `ARRIVED` lên trước, sau đó tới `NEW`).
- Tất cả tiêu đề cột bảng (`th`) phải hỗ trợ tính năng nhấp chuột để sắp xếp (Click-to-sort) kèm biểu tượng hướng mũi tên (`▲`, `▼`, `↕`).

## 9. Cấu Trúc Mở Rộng Nhiều Báo Cáo (Multi-Report Architecture)
- Thiết kế giao diện theo mô-đun dạng **Thanh Tabs Chuyển Đổi Báo Cáo** (`.report-tabs-bar`) để sẵn sàng bổ sung các báo cáo 2, 3, 4... tiếp theo mà không làm xáo trộn bố cục chung.
- Mỗi báo cáo nằm trong một `<div class="report-section" id="report-bcN">`, ẩn/hiện bằng `display:none/block`.

## 10. Quy Tắc Bộ Lọc Áp Dụng Cho Tất Cả Báo Cáo (QUAN TRỌNG)
- **Bắt buộc**: Mỗi khi người dùng thay đổi bất kỳ bộ lọc chung nào (Mã Kho, Ngày, Nhóm Hàng), hàm xử lý sự kiện phải kích hoạt re-render **tất cả** các hàm render của từng báo cáo đang hoạt động.
- **Quy tắc kỹ thuật** trong `app.js`:
  - Mỗi khi filter thay đổi (checkbox onChange / selectAll), phải gọi **tất cả** các hàm `applyFiltersAndRenderBCN()` tương ứng.
  - Ví dụ: `applyFiltersAndRender()` → BC1; `applyFiltersAndRenderBC2()` → BC2; thêm BC3 thì thêm `applyFiltersAndRenderBC3()`...
  - **Bộ lọc nào áp dụng được cho báo cáo nào** phụ thuộc vào việc sheet data của báo cáo đó có cột tương ứng hay không:
    - `MÃ KHO` → áp dụng cho mọi báo cáo có cột `MÃ KHO`.
    - `NGÀY` → áp dụng cho báo cáo có cột ngày tương ứng (Column1, NGÀY, NGÀY NHẬP...).
    - `NHÓM HÀNG` → áp dụng cho báo cáo có cột `NHÓM HÀNG`.
  - Nếu sheet của một báo cáo **không có** cột tương ứng, bộ lọc đó đơn giản bỏ qua (không áp dụng), không được gây lỗi.
- **Mẫu code chuẩn** cho hàm render checkbox:
  ```javascript
  checkbox.addEventListener('change', () => {
    updateFilterTriggerLabels();
    applyFiltersAndRender();       // BC1
    applyFiltersAndRenderBC2();    // BC2
    // applyFiltersAndRenderBC3(); // BC3 khi thêm sau
  });
  ```

## 11. Quy Tắc Lấy Dữ Liệu Từ Web Vào Excel Data Thô (ETL Rules)
Khi xây dựng script (ví dụ Python với `win32com`) kéo dữ liệu API từ Web lưu vào file Excel, **BẮT BUỘC** tuân thủ 5 quy tắc sau:
1. **Lọc Kho Mục Tiêu:** Chỉ lấy dữ liệu của 4 kho `052`, `05KH`, `05NT`, `SKH`.
2. **Bảo Toàn Cột Công Thức (Bôi Vàng):** Cột bôi màu nền vàng là cột chứa công thức (VD: Tính số pallet). Tuyệt đối không xóa, không ghi đè, không làm thay đổi các cột này. Chỉ `ClearContents` và chép đè vào các vùng cột dữ liệu thô.
3. **Mở Rộng Vùng Bảng (ListObject):** Sau khi dán dữ liệu, script phải tự động gọi lệnh kéo giãn vùng chọn của Bảng (Excel Table) để bao trọn số dòng dữ liệu mới.
4. **Ghi Dữ Liệu Từ A2:** Dòng đầu tiên (Row 1) luôn là tiêu đề (Header). Dữ liệu mới luôn bắt đầu chép vào từ ô `A2`.
5. **Ép Kiểu Text (Định Dạng `@`):** Trước khi dán dữ liệu, phải ép định dạng NumberFormat của các cột dễ bị lỗi (như Mã Kho, Mã Hàng, Số Lô, KMDB, NSX, HSD) thành kiểu chữ (Text - `@`). Nếu không, Excel sẽ tự động làm mất số 0 ở đầu hoặc sai định dạng ngày tháng.

## 12. Quy Tắc Sao Chép Dữ Liệu Trung Thực (Data Fidelity — QUAN TRỌNG)
Dữ liệu lấy từ API phải được ghi vào Excel **Y NGUYÊN, TRUNG THỰC** so với web portal hiển thị. Cụ thể:
1. **Không tự ý thay đổi giá trị:** Giữ nguyên mọi giá trị API trả về. Không tự đổi, bỏ, thêm nội dung.
2. **Tên Kho phải đầy đủ:** API trả về `whsename` chỉ là mã code (VD: `"SKH"`, `"CC"`). Phải dùng `WHSE_NAME_MAP` tra tên đầy đủ cho cột KHO NHẬP/KHO XUẤT. Cột MÃ KHO giữ nguyên code.
3. **Ngày phải cộng múi giờ +7:** API trả về UTC (`2026-08-04T17:00:00.000Z`), web hiển thị VN time (`05/08/2026`). Hàm `format_date()` phải tự cộng 7 giờ.
4. **Đầy đủ cột:** Phải map TẤT CẢ các cột web portal hiển thị, không bỏ sót. Nếu API thiếu key → ghi rỗng.
5. **Đúng thứ tự cột:** Mảng trả về từ hàm `map_dataN()` phải ĐÚNG thứ tự cột trong Excel.
6. **Kiểm tra đối chiếu:** Sau khi viết hàm map mới, phải so sánh 5-10 dòng đầu tiên với web portal → khớp 100%.
7. **Khi gặp mã kho mới:** Mở web xác nhận tên đúng → bổ sung vào `WHSE_NAME_MAP` ngay.
8. **Trạng thái Trích xuất (Status Mapping):** Trong `data1-đi đường`, mã `status == "0"` (hoặc `99`, `28`, `20`) là `ARRIVED`, mã `status == "16"` là `NEW`, `11` là `CANCELED`. Tuyệt đối không gom `0` và `16` làm một.
- Xem chi tiết tại Skill: `data-extraction-fidelity`

## 13. Quy Tắc Tương Thích VPS / Môi Trường Headless (QUAN TRỌNG)
Khi script `extract_data.py` chạy tự động qua **Task Scheduler trên VPS** (không có màn hình GUI), **BẮT BUỘC** tuân thủ các quy tắc sau để tránh script bị treo vô hạn:

1. **TUYỆT ĐỐI KHÔNG dùng `input()`**: Bất kỳ lệnh `input(...)` nào trong code Python đều khiến Task Scheduler treo cứng mãi mãi vì không có ai gõ phím. Thay thế bằng logic tự động xử lý (auto-exit hoặc auto-retry).

2. **TUYỆT ĐỐI KHÔNG dùng `pause`**: Trong file `run.bat`, lệnh `pause` sẽ khiến cửa sổ CMD không bao giờ tự đóng, dẫn đến Task Scheduler block toàn bộ lần chạy tiếp theo.

3. **Luôn đặt timeout cho `RefreshAll()` và `CalculateUntilAsyncQueriesDone()`**: Power Query trên VPS không có GUI nên dễ bị treo vô hạn. Phải wrap trong vòng lặp có giới hạn thời gian:
   ```python
   import time
   wb.RefreshAll()
   for _ in range(60):  # Tối đa 60 giây
       try:
           excel.CalculateUntilAsyncQueriesDone()
           break
       except:
           time.sleep(1)
   ```

4. **Tự Động Tạo Thư Mục System Desktop (`ensure_system_desktop_folders`)**: Trong `extract_data.py`, trước khi gọi `win32com`, bắt buộc phải tạo 2 thư mục Desktop hệ thống (`C:\Windows\System32\config\systemprofile\Desktop` và `SysWOW64...`) để tránh lỗi Excel COM `HRESULT -2146827284` (`Open method of Workbooks class failed`) khi VPS chạy ngầm.

5. **Khử Trùng Token Trong Dữ Liệu Raw (`GH013 Push Protection`)**: Hàm `clean_value()` và `export_to_js()` trong `extract_data.py` phải tự động dùng Regex che mờ mọi chuỗi chứa `ghp_` thành `***REDACTED***` trước khi xuất `data.js`. Điều này đảm bảo `git push` trên VPS không bao giờ bị GitHub Push Protection chặn.

6. **Task Scheduler phải cấu hình "Run only when user is logged on"**: Nếu cài đặt "Run whether user is logged on or not" hoặc tích "Hidden", Excel sẽ chạy trong môi trường vô hình và bị lỗi khi gọi win32com.

7. **Kiểm tra trạng thái Task Scheduler**: Nếu cột `Status` hiện `Running` mà `Last Run Time` không thay đổi → đây là dấu hiệu script đang bị treo. Bấm **End** để giết tiến trình bị treo trước khi chạy lại.

8. **`extract_data.py` phải được track bởi Git** (không được để trong `.gitignore`) để VPS có thể `git pull` nhận code mới tự động qua `run.bat`.

## 14. Tiêu Diệt Tiến Trình Zombie (Đặc Biệt Với Excel)
Khi dùng `win32com.client` để điều khiển Excel ngầm, Excel thường có xu hướng không tự đóng hoàn toàn dù đã gọi lệnh Quit. Điều này làm Task Scheduler lầm tưởng script vẫn đang chạy.
- Luôn bọc logic trong khối `try...finally` để đảm bảo lệnh Quit được gọi kể cả khi có lỗi.
- **Bắt buộc** phải có bước dọn rác thủ công ở cuối script Python bằng cách ép tắt tiến trình hệ thống:
```python
import time, os
import pythoncom
if wb: wb.Close(False)
if excel: excel.Quit()
pythoncom.CoUninitialize()
time.sleep(2)
os.system("taskkill /F /IM EXCEL.EXE >nul 2>&1")
```

## 15. Xác Thực Git & Đồng Bộ Đa Máy (Git Sync)
- **Xác Thực Git Không Tương Tác:** Sử dụng URL HTTPS sạch (`git remote set-url origin https://github.com/hoten08031984-lab/khoNTB.git`). Thêm `set GIT_TERMINAL_PROMPT=0` và `set GCM_INTERACTIVE=never` vào đầu file `.bat` để khóa Terminal/GUI Prompt trên VPS.
- **Tự Động Reset Hard Trước Khi Xử Lý (Bước 0 trong run.bat):** `run.bat` phải luôn gọi `git fetch origin main` & `git reset --hard origin/main` ở đầu file để VPS tự động xóa sạch mọi xung đột local và đồng bộ 100% code mới nhất từ Máy chính.
- **Git Pull Rebase Trước Khi Push (Bước 3 trong run.bat):** Để tránh xung đột (lỗi Non-Fast-Forward Rejection), `run.bat` phải gọi `git pull origin main --rebase` ngay trước lệnh `git push origin main`.
- **Logging:** Luôn ghi mọi diễn biến ra file văn bản (`log.txt`) với Timestamp để theo dõi.

## 16. Lỗi Căn Bản Task Scheduler (Thư mục Start in)
- Khi tạo Action chạy file `.bat` trong Task Scheduler, **BẮT BUỘC** phải điền đường dẫn thư mục chứa dự án vào ô **`Start in (optional)`** (Ví dụ: `C:\Users\Administrator\Desktop\AI Báo cáo`). Nếu để trống, script sẽ chạy ở `C:\Windows\System32` và văng lỗi File Not Found.

## 17. Quy Tắc Căn Chỉnh Co Giãn Vừa 1 Trang Màn Hình & Bố Cục Song Song (Viewport Layout & Side-by-Side Grid)
- Tất cả các thẻ báo cáo (`.report-section`), thẻ chứa bảng (`.table-container-card`), và bảng dữ liệu (`.excel-table`) phải luôn được cấu hình co giãn full 100% chiều rộng khung chứa (`width: 100%`, `min-width: 100%`, `min-width: 0`).
- **Khi hiển thị 2 bảng song song để đối chiếu số liệu (như BC3):** BẮT BUỘC dùng chuẩn CSS Grid 50-50 khép kín: `display: grid; grid-template-columns: 1fr 1fr; gap: 16px; width: 100%; min-width: 0; align-items: start;`. Thẻ chứa bên trong mỗi ô Grid (`.table-container-card`) phải có `min-width: 0` và `.table-wrapper` phải có `overflow-x: auto; width: 100%;`. Tuyệt đối KHÔNG dùng `flex-wrap: wrap` kết hợp `min-width` lớn gây đè/chồng lấp bảng lên nhau.
- **Tiêu đề cột dài:** Phải chủ động rút gọn tên chữ hiển thị trên `th` (ví dụ `PL ƯỚC TÍNH (TP&BB)`, `SWM: PL TP`, `SWM: PL RỖNG`) để bảng vừa vặn khít trong khung 50% mà không bị sinh thanh cuộn ngang không cần thiết.
- Không dùng `width: max-content` cho `.excel-table` khiến bảng bị lệch thu nhỏ hoặc bị lòi văng ra khỏi khung thiết kế chung.

## 18. Quy Tắc Thay Đổi Giao Diện Dashboard (UI / Layout Change Approval — QUAN TRỌNG)
- **BẮT BUỘC HỎI Ý KIẾN TRƯỚC KHI ÁP DỤNG:** Tất cả các hình thức thay đổi liên quan đến Web Dashboard (bao gồm: giao diện, vị trí/thêm/bớt nút bấm, cột hiển thị, màu sắc, bố cục banner...) đều BẮT BUỘC phải hỏi ý kiến xác nhận của người dùng trước khi tiến hành code và cập nhật.
- Không tự ý thêm nút dư thừa hoặc sửa đổi bố cục sẵn có nếu chưa được người dùng thống nhất.



