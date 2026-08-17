import os
import sys
import json
import requests
import datetime
import pandas as pd
import win32com.client
import win32com.client.dynamic
import pythoncom
import math

sys.stdout.reconfigure(encoding='utf-8')

# ==========================================
# CẤU HÌNH HỆ THỐNG
# ==========================================
LOGIN_URL = "https://prod-swa-app-be.smartlogix.biz/api/public/auth-portal/login"
API_SALE_ORDER = "https://portal-be.sabeco.vn/api/outbounds/getListSaleOrderTracking"
API_SHELFLIFE = "https://portal-be.sabeco.vn/api/inventories/getListDateShelfLife"
API_ON_SHIPPING = "https://portal-be.sabeco.vn/api/inbounds/getListOnShipping"

EXCEL_FILE = os.path.abspath('báo cáo.xlsx')
OUTPUT_JS = os.path.abspath('data.js')

TARGET_WHSE_IDS = ["05KH", "05NT", "052", "SKH"]

WHSE_NAME_MAP = {
    # 4 kho mục tiêu
    "052": "Kho Bình Thuận",
    "05KH": "Kho NTB tại NM BSG Khánh Hòa",
    "05NT": "Kho NTB tại NM BSG Ninh Thuận",
    "SKH": "Kho TĐ BSG tại NM BSG Khánh Hòa",
    # Các kho khác trong hệ thống Sabeco
    "CC": "NM BSG Cù Chi",
    "061": "NM BSG Cần Thơ",
    "040": "Kho Đắk Lắk",
    "041": "Kho Gia Lai",
    "161": "NM BSG Ninh Thuận",
    "20D": "Tổng Kho Cù Chi",
    "151": "NM BSG Phú Yên",
    "166": "NM BSG Lâm Đồng",
    "060A": "Kho Bình Dương",
    "060E": "Kho Bình Dương E",
    "164": "NM BSG Khánh Hòa",
    "157": "NM BSG Quảng Ngãi",
    "04LD": "Kho Lâm Đồng",
    "S60A": "Kho Sài Gòn 60A",
    "01KH": "Kho 01 Khánh Hòa",
}

UOM_MAP = {
    "KET": "Két",
    "CAI": "Cái",
    "THUNG": "Thùng",
    "CHAI": "Chai",
    "KEG": "",
    "CUON": ""
}

# --- Utils ---
def log(msg):
    print(f"[INFO] {msg}", flush=True)

def error_log(msg):
    print(f"[ERROR] {msg}", file=sys.stderr, flush=True)

def format_date(iso_str):
    if not iso_str: return ""
    iso_str = str(iso_str).strip()
    try:
        # Xử lý múi giờ UTC (kết thúc bằng Z) -> Cần +7 giờ ra giờ VN
        if "T" in iso_str and iso_str.endswith("Z"):
            date_str = iso_str.split(".")[0].replace("Z", "")
            dt = datetime.datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S")
            dt += datetime.timedelta(hours=7)
            return dt.strftime("%d/%m/%Y")
    except Exception:
        pass
        
    # Xử lý mặc định cắt chuỗi
    try:
        parts = iso_str.split("T")[0].split("-")
        if len(parts) == 3:
            return f"{parts[2]}/{parts[1]}/{parts[0]}"
    except Exception:
        pass
    return iso_str

def to_number(val):
    if val is None or val == "": return ""
    try:
        num = float(val)
        return int(num) if num.is_integer() else num
    except Exception:
        return val

# --- API Fetching ---
def login(username, password):
    log("Đăng nhập lấy Token...")
    try:
        r = requests.post(LOGIN_URL, json={"username": username, "password": password}, timeout=15)
        r.raise_for_status()
        token = r.json().get("token") or r.json().get("Token")
        if not token: raise ValueError("Không có Token")
        return token
    except Exception as e:
        error_log(f"Login failed: {e}")
        return None

def fetch_data(api_url, token, mapper_func, where_clause="1>0", date_filter_col=None, start_date=None):
    headers = {
        "Content-Type": "application/json",
        "Token": token,
        "Origin": "https://portal.sabeco.vn",
        "Referer": "https://portal.sabeco.vn/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    payload = {"whereClause": where_clause, "orderBy": "", "skip": 0, "limit": 100000}
    try:
        r = requests.post(api_url, json=payload, headers=headers, timeout=30)
        # Fallback if API rejects the whereClause (e.g. unknown column)
        if r.status_code == 500 or r.status_code == 400:
            log(f"API từ chối whereClause '{where_clause}'. Đang thử lại với '' và lọc qua Python...")
            payload["whereClause"] = ""
            r = requests.post(api_url, json=payload, headers=headers, timeout=30)
            
        r.raise_for_status()
        res = r.json()
        raw_items = []
        if isinstance(res, list): raw_items = res
        elif "data" in res and isinstance(res["data"], dict) and "items" in res["data"]:
            raw_items = res["data"]["items"]
        elif "data" in res and isinstance(res["data"], list):
            raw_items = res["data"]
        elif "res" in res and isinstance(res["res"], list):
            raw_items = res["res"]
        else:
            log(f"Lỗi: API {api_url} trả về cấu trúc không xác định.")
        
        mapped = []
        for item in raw_items:
            item_lower = {k.lower(): v for k, v in item.items()}
            ma_kho = str(item_lower.get("whseid", item_lower.get("whsecode", ""))).strip()
            if ma_kho not in TARGET_WHSE_IDS: continue
            
            # Python-level date filtering if provided
            if date_filter_col and start_date:
                item_date_str = item.get(date_filter_col, "")
                if item_date_str:
                    try:
                        # Extract YYYY-MM-DD
                        item_date_iso = item_date_str.split("T")[0]
                        if item_date_iso < start_date:
                            continue
                    except: pass
                    
            mapped.append(mapper_func(item, ma_kho))
        return mapped
    except Exception as e:
        error_log(f"Fetch failed {api_url}: {e}")
        return None

def map_c1chitiet(item, ma_kho):
    branch = str(item.get("branchname", "")).strip()
    whse_name = WHSE_NAME_MAP.get(ma_kho, str(item.get("whsename", "")).strip())
    uom = UOM_MAP.get(str(item.get("uom", "")).strip().upper(), str(item.get("uom", "")).strip())
    return [
        branch,                                        # TÊN ĐƠN VỊ
        ma_kho,                                        # MÃ KHO
        whse_name,                                     # TÊN KHO
        str(item.get("consigneekey", "")).strip(),     # MÃ C1
        str(item.get("customername", "")).strip(),     # TÊN C1
        str(item.get("externsaleorderkey", "")).strip(), # SỐ HÓA ĐƠN
        str(item.get("saleorder_type", "")).strip(),   # LOẠI HÓA ĐƠN
        format_date(item.get("deliverydate", "")),     # NGÀY RA HÓA ĐƠN
        str(item.get("sku", "")).strip(),              # MÃ HÀNG
        str(item.get("descr", "")).strip(),            # TÊN HÀNG
        uom,                                           # ĐƠN VỊ TÍNH
        to_number(item.get("total_originalqty_saleorder", 0)), # SL BAN ĐẦU
        to_number(item.get("total_shippedqty_saleorder", 0)),  # SL ĐÃ XUẤT
        to_number(item.get("total_avaible_so", 0)),    # SL CÒN LẠI
        str(item.get("skugroup", "")).strip()          # NHÓM HÀNG
    ]

def map_shelflife(item, ma_kho):
    branch = str(item.get("branchname", "")).strip()
    whse_name = WHSE_NAME_MAP.get(ma_kho, str(item.get("whsename", "")).strip())
    uom = UOM_MAP.get(str(item.get("uom", "")).strip().upper(), str(item.get("uom", "")).strip())
    status_raw = str(item.get("status", "")).strip().upper()
    trang_thai = "CÓ THỂ XUẤT" if status_raw == "OK" else status_raw
    trang_thai_hsd = str(item.get("statusshelflife", "")).strip()
    return [
        branch,                           # TÊN ĐƠN VỊ
        whse_name,                        # TÊN KHO
        ma_kho,                           # MÃ KHO
        str(item.get("sku", "")).strip(), # MÃ HÀNG
        str(item.get("description", "")).strip(), # TÊN HÀNG
        uom,                              # ĐƠN VỊ TÍNH
        str(item.get("skugroup", "")).strip(), # NHÓM HÀNG
        trang_thai,                       # TRẠNG THÁI
        str(item.get("lottable01", "")).strip(), # SỐ LÔ
        str(item.get("lottable03", "")).strip(), # KMDB
        format_date(item.get("lottable04", "")), # NSX
        format_date(item.get("lottable05", "")), # HSD
        to_number(item.get("qty", 0)),    # SỐ LƯỢNG
        int(math.ceil(float(item.get("qtyavailablepl") or 0))) if item.get("qtyavailablepl") is not None else 0, # SỐ LƯỢNG PL
        to_number(item.get("percentshl", 0)), # (%) HSD
        to_number(item.get("dayoff", 0)), # SỐ NGÀY CÒN LẠI
        to_number(item.get("shelflife", 0)), # SỐ NGÀY HSD
        to_number(item.get("usable", 0)), # (%) KHẢ DỤNG
        to_number(item.get("nearlyexpired", 0)), # (%) GẦN HẾT HẠN
        to_number(item.get("expired", 0)), # (%) HẾT HẠN
        trang_thai_hsd,                   # TRẠNG THÁI HSD
        to_number(item.get("stockdate", "")), # STOCKDATE
        str(item.get("location", "")).strip()  # VỊ TRÍ
    ]

def map_data2_nhap(item, ma_kho):
    branch = str(item.get("branchname", "")).strip()
    whse_name = WHSE_NAME_MAP.get(ma_kho, str(item.get("whsename", "")).strip())
    uom = UOM_MAP.get(str(item.get("packuom3", "")).strip().upper(), str(item.get("packuom3", "")).strip())
    
    return [
        format_date(item.get("receiptdate", "")),              # NGÀY NHẬP
        branch,                                                # TÊN ĐƠN VỊ
        whse_name,                                             # KHO NHẬP
        ma_kho,                                                # MÃ KHO
        WHSE_NAME_MAP.get(str(item.get("fromwhseid", "")).strip(), str(item.get("fromwhsename", "")).strip()),             # KHO XUẤT
        str(item.get("trailernumber", "")).strip(),            # SỐ XE
        str(item.get("sku", "")).strip(),                      # MÃ HÀNG
        str(item.get("skudescr", "")).strip(),                 # TÊN HÀNG
        str(item.get("typename", "")).strip(),                 # LOẠI GIAO DỊCH
        uom,                                                   # ĐƠN VỊ TÍNH
        str(item.get("skugroup", "")).strip(),                 # NHÓM HÀNG
        to_number(item.get("qtyreceivedpcs", 0)),              # SỐ LƯỢNG
        to_number(item.get("qtyreceivedpallet", 0)),           # SỐ LƯỢNG PL
        str(item.get("lottable01", "")).strip(),               # SỐ LÔ
        format_date(item.get("lottable04", "")),               # NGÀY SẢN XUẤT
        format_date(item.get("lottable05", "")),               # NGÀY HẾT HẠN
        str(item.get("transportationmode", "")).strip(),       # XA/PALLET
        str(item.get("transportationservice", "")).strip(),    # THUONG/BYPASS/DIRECT
        to_number(item.get("totalgrosswgt", 0)),               # TRỌNG LƯỢNG (KG)
        to_number(item.get("totalnetwgt", 0)),                 # LÍT
        str(item.get("conditioncode", "")).strip(),            # TRẠNG THÁI HÀNG HÓA
        str(item.get("receiptkey", "")).strip(),               # MÃ ĐƠN NHẬN
        str(item.get("externreceiptkey", "")).strip(),         # MÃ ĐƠN HÀNG NHẬN
        str(item.get("addwho", "")).strip(),                   # NGƯỜI TẠO ĐƠN
        str(item.get("editwho", "")).strip(),                  # NGƯỜI SỬA ĐƠN
        str(item.get("lifter", "")).strip(),                   # LÁI XE NÂNG
        str(item.get("carrierkey", "")).strip(),               # NHÀ VẬN CHUYỂN
        str(item.get("tripid", "")).strip(),                   # MÃ CHUYẾN
        str(item.get("externalreceiptkey2", "")).strip(),      # CUSTOMERPO
        str(item.get("suppliercode", "")).strip(),             # MÃ NCC
        str(item.get("suppliername", "")).strip(),             # TÊN NCC
        str(item.get("notes", "")).strip()                     # GHI CHÚ
    ]

def map_data3_xuat(item, ma_kho):
    branch = str(item.get("branchname", "")).strip()
    whse_name = WHSE_NAME_MAP.get(ma_kho, str(item.get("whsename", "")).strip())
    uom_val = str(item.get("packuom3", "")).strip() or str(item.get("uom", "")).strip()
    uom = UOM_MAP.get(uom_val.upper(), uom_val)
    
    return [
        format_date(item.get("actualshipdate", "")),           # NGÀY XUẤT
        branch,                                                # TÊN ĐƠN VỊ
        str(item.get("externalorderkey2", "")).strip(),        # SỐ ĐƠN XUẤT PHỤ
        whse_name,                                             # KHO XUẤT
        ma_kho,                                                # MÃ KHO XUẤT
        str(item.get("customercode", "")).strip(),             # MÃ C1
        str(item.get("customername", "")).strip(),             # TÊN C1
        WHSE_NAME_MAP.get(str(item.get("towhseid", "")).strip(), str(item.get("towhsename", "")).strip()),               # KHO NHẬP
        str(item.get("typename", "")).strip(),                 # LOẠI GIAO DỊCH
        str(item.get("trailernumber", "")).strip(),            # SỐ XE
        str(item.get("sku", "")).strip(),                      # MÃ HÀNG
        str(item.get("skudescr", "")).strip(),                 # TÊN HÀNG
        uom,                                                   # ĐƠN VỊ TÍNH
        str(item.get("skugroup", "")).strip(),                 # NHÓM HÀNG
        to_number(item.get("shipqtycase", 0)) or to_number(item.get("qty", 0)), # SỐ LƯỢNG
        to_number(item.get("shipqtypallet", 0)),               # SỐ LƯỢNG PL
        str(item.get("lottable01", "")).strip(),               # SỐ LÔ
        format_date(item.get("lottable04", "")),               # NGÀY SẢN XUẤT
        format_date(item.get("lottable05", "")),               # NGÀY HẾT HẠN
        str(item.get("transportationmode", "")).strip(),       # XA/PALLET
        str(item.get("transportationservice", "")).strip(),    # THUONG/BYPASS/DIRECT
        str(item.get("conditioncode", "")).strip(),            # TRẠNG THÁI HÀNG HÓA
        str(item.get("susr3", "")).strip() or str(item.get("notes", "")).strip(), # CTKM
        str(item.get("orderkey", "")).strip(),                 # MÃ ĐƠN XUẤT
        to_number(item.get("stdgrossweight", 0)),              # TRỌNG LƯỢNG (KG)
        to_number(item.get("stdnetweight", 0)),                # LÍT
        str(item.get("externorderkey", "")).strip(),           # MÃ LỆNH XUẤT HÀNG
        str(item.get("addwho", "")).strip(),                   # NGƯỜI TẠO ĐƠN
        str(item.get("editwho", "")).strip(),                  # NGƯỜI SỬA ĐƠN
        str(item.get("lifter", "")).strip(),                   # LÁI XE NÂNG
        str(item.get("carrierkey", "")).strip(),               # NHÀ VẬN CHUYỂN
        str(item.get("tripid", "")).strip(),                   # MÃ CHUYẾN
        format_date(item.get("deliverydate", "")),             # NGÀY RA HÓA ĐƠN
        str(item.get("notes", "")).strip()                     # GHI CHÚ
    ]

def map_data5(item, ma_kho):
    item_lower = {k.lower(): v for k, v in item.items()}
    branch = str(item_lower.get("branchname", "")).strip()
    whse_name = WHSE_NAME_MAP.get(ma_kho, str(item_lower.get("whsename", "")).strip())
    uom_val = str(item_lower.get("packuom3", "") or item_lower.get("uom", "")).strip()
    uom = UOM_MAP.get(uom_val.upper(), uom_val)
    
    return [
        branch,                                        # TÊN ĐƠN VỊ
        ma_kho,                                        # MÃ KHO
        whse_name,                                     # TÊN KHO
        str(item_lower.get("skugroup", "")).strip(),         # NHÓM HÀNG
        str(item_lower.get("sku", "")).strip(),              # MÃ HÀNG
        str(item_lower.get("descr", "")).strip(),            # TÊN HÀNG
        str(item_lower.get("location", "")).strip() or str(item_lower.get("loc", "")).strip(), # VỊ TRÍ
        to_number(item_lower.get("qty", 0)) or to_number(item_lower.get("qtyonhand", 0)), # SỐ LƯỢNG
        uom                                            # ĐƠN VỊ TÍNH
    ]

def map_data7(item, ma_kho):
    branch = str(item.get("branchname", "")).strip()
    whse_name = WHSE_NAME_MAP.get(ma_kho, str(item.get("whsename", "")).strip())
    uom = UOM_MAP.get(str(item.get("packuom3", "")).strip().upper(), str(item.get("packuom3", "")).strip())
    
    return [
        branch,                                        # TÊN ĐƠN VỊ
        whse_name,                                     # TÊN KHO
        ma_kho,                                        # MÃ KHO
        str(item.get("sku", "")).strip(),              # MÃ HÀNG
        str(item.get("descr", "")).strip(),            # TÊN HÀNG
        uom,                                           # ĐƠN VỊ TÍNH
        str(item.get("skugroup", "")).strip(),         # NHÓM HÀNG
        to_number(item.get("qty", 0)),                 # TỔNG SỐ LƯỢNG
        to_number(item.get("openqty", 0)),             # TỔNG GỬI
        to_number(item.get("availiableqty", 0)),       # SỐ LƯỢNG BÁN ĐƯỢC
        to_number(item.get("qtyonhand", 0))            # TỒN THỰC TẾ
    ]

def map_data1_diduong(item, ma_kho):
    adddate = format_date(item.get("adddate", "")) or format_date(item.get("addwho", "")) or str(item.get("adddate", ""))
    
    raw_status = str(item.get("status", "")).strip()
    if raw_status == "16":
        status_text = "NEW"
    elif raw_status == "11":
        status_text = "CANCELED"
    elif raw_status in ["0", "99", "28", "20"]:
        status_text = "ARRIVED"
    else:
        status_text = raw_status

    return [
        adddate, # NGÀY TẠO
        str(item.get("branchname", "")).strip(), # TÊN ĐƠN VỊ
        WHSE_NAME_MAP.get(ma_kho, str(item.get("whsename", "")).strip()), # KHO NHẬP
        ma_kho, # MÃ KHO
        WHSE_NAME_MAP.get(str(item.get("fromwhseid", "")).strip(), str(item.get("fromwhsename", "")).strip()), # KHO XUẤT
        str(item.get("fromwhseid", "")).strip(), # MÃ KHO XUẤT
        str(item.get("externreceiptkey", "")).strip() or str(item.get("planid", "")).strip() or str(item.get("receiptkey", "")).strip(), # KẾ HOẠCH GIAO HÀNG
        to_number(item.get("susr2")) if item.get("susr2") is not None else (item.get("week", "") or item.get("deliveryweek", "")), # TUẦN
        str(item.get("trailernumber", "")).strip() or str(item.get("vehicleno", "")).strip() or str(item.get("truckno", "")).strip(), # SỐ XE
        str(item.get("drivername", "")).strip() or str(item.get("driver", "")).strip(), # TÀI XẾ
        str(item.get("tripid", "")).strip() or str(item.get("externalreceiptkey2", "")).strip() or str(item.get("shipmentid", "")).strip() or str(item.get("tripno", "")).strip(), # MÃ CHUYẾN
        status_text, # TRẠNG THÁI
        str(item.get("sku", "")).strip(), # MÃ HÀNG
        str(item.get("skudesc", "")).strip() or str(item.get("description", "")).strip(), # TÊN HÀNG
        UOM_MAP.get(str(item.get("uom", "")).strip().upper(), str(item.get("uom", "")).strip()), # ĐƠN VỊ TÍNH
        str(item.get("skugroup", "")).strip(), # NHÓM HÀNG
        to_number(item.get("qtyexpectedpcs", 0)) or to_number(item.get("qty", 0)) or to_number(item.get("expectedqty", 0)) or to_number(item.get("originalqty", 0)), # SỐ LƯỢNG
        to_number(item.get("expectedqtypallet", 0)) or to_number(item.get("qtypl", 0)) or to_number(item.get("palletqty", 0)) or to_number(item.get("expectedqtypl", 0)) # SỐ LƯỢNG PL
    ]

# --- Excel COM updating ---
def update_excel_sheet(wb, sheet_name, data):
    if not data: return
    try:
        ws = wb.Sheets(sheet_name)
    except Exception:
        error_log(f"Không tìm thấy sheet '{sheet_name}'")
        return
        
    num_cols = len(data[0])
    max_col_check = num_cols + 5
    
    # Tìm cột có công thức ở dòng 2 để tránh ghi đè (Quét rộng ra 20 cột so với data)
    formula_cols = []
    for c in range(1, num_cols + 20):
        try:
            if ws.Cells(2, c).HasFormula:
                formula_cols.append(c)
        except: pass
        
    # Xóa bộ lọc nếu có để tránh lỗi dòng ẩn
    if ws.FilterMode:
        try:
            ws.ShowAllData()
        except: pass
        
    for lo in ws.ListObjects:
        try:
            if lo.AutoFilter and lo.AutoFilter.FilterMode:
                lo.AutoFilter.ShowAllData()
        except: pass
        
        # TUYỆT ĐỐI KHÔNG DÙNG lo.DataBodyRange.Delete() VÌ SẼ LÀM LỖI CÔNG THỨC #REF!
            
    # Chỉ ClearContents các cột không chứa công thức
    max_row = ws.UsedRange.Rows.Count
    if max_row >= 2:
        for c in range(1, num_cols + 1):
            if c not in formula_cols:
                ws.Range(ws.Cells(2, c), ws.Cells(max_row, c)).ClearContents()
                
    new_rows = len(data)
    
    # Ép kiểu Text cho các cột có tiêu đề đặc thù để tránh lỗi mất số 0 hoặc sai Date
    for c in range(1, num_cols + 1):
        header = str(ws.Cells(1, c).Value).strip().upper()
        if header in ["MÃ KHO", "MÃ HÀNG", "SỐ LÔ", "KMDB", "NSX", "HSD", "MÃ C1", "SỐ HÓA ĐƠN", "KHO NHẬP", "KHO XUẤT", "MÃ KHO XUẤT", "NGÀY TẠO", "NGÀY NHẬP", "NGÀY XUẤT", "NGÀY RA HÓA ĐƠN"]:
            ws.Range(ws.Cells(2, c), ws.Cells(new_rows + 1, c)).NumberFormat = "@"
            
    # Ghi dữ liệu thô vào (chuyển sang tuple để COM xử lý an toàn nhất)
    tuple_data = tuple(tuple(row) for row in data)
    ws.Range(ws.Cells(2, 1), ws.Cells(new_rows + 1, num_cols)).Value = tuple_data
    
    # Kéo công thức xuống cho các dòng mới
    if new_rows > 1:
        for c in formula_cols:
            try:
                ws.Range(ws.Cells(2, c), ws.Cells(new_rows + 1, c)).FillDown()
            except: pass

    # Mở rộng ListObject
    for lo in ws.ListObjects:
        try:
            table_cols = lo.Range.Columns.Count
            start_cell = lo.Range.Cells(1, 1)
            end_col_letter = ws.Cells(1, start_cell.Column + table_cols - 1).Address.split('$')[1]
            start_col_letter = start_cell.Address.split('$')[1]
            start_row = start_cell.Row
            
            new_ref = f"{start_col_letter}{start_row}:{end_col_letter}{new_rows + 1}"
            lo.Resize(ws.Range(new_ref))
        except Exception as e:
            error_log(f"Lỗi mở rộng ListObject {lo.Name}: {e}")
            
    # Xóa sạch các dòng cũ dư thừa ở phía dưới (nếu dữ liệu mới ít dòng hơn dữ liệu cũ)
    if max_row > new_rows + 1:
        try:
            ws.Range(ws.Rows(new_rows + 2), ws.Rows(max_row)).ClearContents()
        except: pass
            
    # Tự động căn chỉnh kích thước cột cho vừa dữ liệu
    try:
        ws.Columns.AutoFit()
    except: pass
            
    log(f"Đã cập nhật {new_rows} dòng vào sheet '{sheet_name}'.")

# --- Export to data.js ---
def clean_value(val):
    if pd.isna(val) or val is None: return None
    if isinstance(val, (datetime.date, datetime.datetime, pd.Timestamp)):
        return val.strftime('%d/%m/%Y')
    if isinstance(val, (int, float)):
        if pd.isna(val): return None
        return val
    s = str(val).strip()
    if "ghp_" in s:
        import re
        s = re.sub(r'ghp_[A-Za-z0-9_]+', '***REDACTED***', s)
    return s

def export_to_js():
    log("Trích xuất Excel sang data.js...")
    xl = pd.ExcelFile(EXCEL_FILE)
    data_store = {}
    for sheet in xl.sheet_names:
        df = pd.read_excel(EXCEL_FILE, sheet_name=sheet)
        df.columns = [str(c).strip() for c in df.columns]
        records = []
        for _, row in df.iterrows():
            row_dict = {}
            for col in df.columns:
                row_dict[col] = clean_value(row[col])
            records.append(row_dict)
        data_store[sheet] = records
        log(f" -> Sheet '{sheet}': {len(records)} rows extracted.")
        
        # Extra logic for baocao5-vitri
        if sheet == 'baocao5-vitri':
            try:
                df_t8 = pd.read_excel(EXCEL_FILE, sheet_name=sheet, usecols="H:L", header=None)
                header_row = -1
                for i in range(min(50, len(df_t8))):
                    val = str(df_t8.iloc[i, 0]).strip().lower()
                    if val in ['ma kho', 'mã kho']:
                        header_row = i
                        break
                if header_row != -1:
                    df_t8.columns = [str(c).strip() for c in df_t8.iloc[header_row]]
                    ma_kho_col = df_t8.columns[0]
                    df_t8 = df_t8.iloc[header_row+1:].dropna(subset=[ma_kho_col])
                    records_t8 = []
                    for _, r in df_t8.iterrows():
                        row_dict = {}
                        for col in df_t8.columns:
                            if pd.isna(col) or 'nan' in str(col).lower(): continue
                            row_dict[col] = clean_value(r[col])
                        records_t8.append(row_dict)
                    data_store['baocao5-table8'] = records_t8
            except Exception as e:
                pass

    # Trích xuất mật khẩu xuất data thô từ ô A3 của Sheet1
    export_pass = "khontb123@"
    try:
        if 'Sheet1' in xl.sheet_names:
            df_s1 = pd.read_excel(EXCEL_FILE, sheet_name='Sheet1', header=None)
            if len(df_s1) >= 3 and not pd.isna(df_s1.iloc[2, 0]):
                val = str(df_s1.iloc[2, 0]).strip()
                if val and val.lower() != 'nan':
                    export_pass = val
    except Exception as e:
        log(f" [!] Không đọc được pass từ Sheet1!A3: {e}")

    def default_converter(o):
        if isinstance(o, (datetime.date, datetime.datetime, pd.Timestamp)): return o.strftime('%d/%m/%Y')
        if pd.isna(o): return None
        return str(o)
        
    now_str = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    js_content = f"// Auto-generated data file from báo cáo.xlsx\nwindow.LAST_UPDATED_TIME = '{now_str}';\nwindow.EXPORT_PASSWORD = {json.dumps(export_pass, ensure_ascii=False)};\nwindow.DASHBOARD_DATA = " + json.dumps(data_store, ensure_ascii=False, indent=2, default=default_converter) + ";"
    
    # Khử trùng toàn bộ chuỗi ghp_ token nếu có lọt vào json
    import re
    js_content = re.sub(r'ghp_[A-Za-z0-9_]+', '***REDACTED***', js_content)
    
    with open(OUTPUT_JS, 'w', encoding='utf-8') as f:
        f.write(js_content)
    log(f"Successfully generated {OUTPUT_JS}!")

def ensure_system_desktop_folders():
    """Tự động tạo thư mục Desktop hệ thống để chống lỗi HRESULT -2146827284 trên VPS Task Scheduler"""
    paths = [
        r"C:\Windows\System32\config\systemprofile\Desktop",
        r"C:\Windows\SysWOW64\config\systemprofile\Desktop"
    ]
    for p in paths:
        try:
            if not os.path.exists(p):
                os.makedirs(p, exist_ok=True)
        except Exception:
            pass

# --- MAIN ---
def main():
    log("=== KHỞI ĐỘNG LUỒNG TỰ ĐỘNG ===")
    ensure_system_desktop_folders()
    pythoncom.CoInitialize()
    
    excel = None
    wb = None
    try:
        excel = win32com.client.Dispatch('Excel.Application')
        excel.Visible = False
        excel.DisplayAlerts = False
        
        # Mở file Excel với đầy đủ tham số an toàn
        try:
            wb = excel.Workbooks.Open(
                Filename=EXCEL_FILE,
                UpdateLinks=0,
                ReadOnly=False,
                IgnoreReadOnlyRecommended=True
            )
        except Exception as e_open:
            log(f"[CẢNH BÁO] Không mở được Excel qua COM: {e_open}. Đang dọn dẹp tiến trình và thử lại lần 2...")
            os.system("taskkill /F /IM EXCEL.EXE >nul 2>&1")
            import time
            time.sleep(2)
            excel = win32com.client.Dispatch("Excel.Application")
            excel.Visible = False
            excel.DisplayAlerts = False
            wb = excel.Workbooks.Open(
                Filename=EXCEL_FILE,
                UpdateLinks=0,
                ReadOnly=False,
                IgnoreReadOnlyRecommended=True
            )
        
        if wb.ReadOnly:
            wb.Close(False)
            log("[LỖI] File báo cáo.xlsx đang bị khóa (Read-Only). Hệ thống tự động dọn dẹp Excel zombie và thử lại...")
            os.system("taskkill /F /IM EXCEL.EXE >nul 2>&1")
            import time
            time.sleep(2)
            excel = win32com.client.Dispatch("Excel.Application")
            excel.Visible = False
            excel.DisplayAlerts = False
            wb = excel.Workbooks.Open(
                Filename=EXCEL_FILE,
                UpdateLinks=0,
                ReadOnly=False,
                IgnoreReadOnlyRecommended=True
            )
            if wb.ReadOnly:
                log("[-] Vẫn không thể mở file. Bỏ qua lần chạy này, sẽ thử lại sau.")
                wb.Close(False)
                excel.Quit()
                return
        
        # Lấy credentials từ sheet 'Email Config' (nếu có)
        user, pwd = "ntb-hoangtien", "hehuha170714@"
        try:
            cfg = wb.Sheets("Email Config")
            u = str(cfg.Cells(11, 3).Value or "").strip()
            p = str(cfg.Cells(12, 3).Value or "").strip()
            if u and p: user, pwd = u, p
        except: pass
        
        token = login(user, pwd)
        if not token: sys.exit(1)
        
        log("Tải dữ liệu Sale Orders (C1)...")
        now = datetime.datetime.now()
        current_year = now.year
        # Lấy từ 01/01 của năm hiện tại
        start_date_str = f"{current_year}-01-01"
        start_datetime_api = f"{start_date_str}T00:00:00"
        end_datetime_api = now.strftime("%Y-%m-%dT%H:%M:%S")
        
        # Thử ép whereClause cho server
        c1_where = f"DeliveryDate >= '{start_datetime_api}' AND DeliveryDate <= '{end_datetime_api}'"
        
        data_c1 = fetch_data(
            API_SALE_ORDER, 
            token, 
            map_c1chitiet, 
            where_clause=c1_where,
            date_filter_col="deliverydate", 
            start_date=start_date_str
        )
        
        log("Tải dữ liệu Tồn kho HSD...")
        data_hsd = fetch_data(API_SHELFLIFE, token, map_shelflife)
        
        excel.ScreenUpdating = False
        if data_c1: update_excel_sheet(wb, "data C1chitiet", data_c1)
        if data_hsd: update_excel_sheet(wb, "data6-tồn kho theo HSD", data_hsd)
        
        # Refresh pivot tables
        # ----------------------------------------------------
        # FETCH DATA1 (ĐI ĐƯỜNG)
        # ----------------------------------------------------
        API_ON_SHIPPING = "https://portal-be.sabeco.vn/api/inbounds/getListOnShipping"
        log("Tải dữ liệu Đi đường (data1)...")
        # 10 ngày gần nhất
        start_date_10d = (now - datetime.timedelta(days=10)).strftime("%Y/%m/%d %H:%M:%S")
        end_date_now = now.strftime("%Y/%m/%d %H:%M:%S")
        
        data1_where = ""
        
        data_data1 = fetch_data(
            API_ON_SHIPPING,
            token,
            map_data1_diduong,
            where_clause=data1_where
        )
        
        if data_data1:
            update_excel_sheet(wb, "data1-đi đường", data_data1)
        else:
            log("Không có dữ liệu mới cho sheet 'data1-đi đường'.")

        # ----------------------------------------------------
        # FETCH DATA2 (NHẬP)
        # ----------------------------------------------------
        API_INBOUND_TRACKING = "https://portal-be.sabeco.vn/api/inbounds/getListInboundReportTracking"
        log("Tải dữ liệu Nhập (data2)...")
        # 5 ngày gần nhất trước ngày hiện tại
        start_date_5d = (now - datetime.timedelta(days=5)).strftime("%Y/%m/%d 00:00:00")
        end_date_5d = now.strftime("%Y/%m/%d 23:59:59")
        data2_where = f"(receiptdate >= '{start_date_5d}') AND (receiptdate <= '{end_date_5d}')"
        
        data_data2 = fetch_data(
            API_INBOUND_TRACKING,
            token,
            map_data2_nhap,
            where_clause=data2_where
        )
        
        if data_data2:
            update_excel_sheet(wb, "data2-nhập", data_data2)
        else:
            log("Không có dữ liệu mới cho sheet 'data2-nhập'.")

        # ----------------------------------------------------
        # FETCH DATA3 (XUẤT)
        # ----------------------------------------------------
        API_OUTBOUND_TRACKING = "https://portal-be.sabeco.vn/api/outbounds/getListOutboundReportTracking"
        log("Tải dữ liệu Xuất (data3)...")
        # Sử dụng cùng khoảng thời gian 5 ngày như data2
        data3_where = f"(actualshipdate >= '{start_date_5d}') AND (actualshipdate <= '{end_date_5d}')"
        
        data_data3 = fetch_data(
            API_OUTBOUND_TRACKING,
            token,
            map_data3_xuat,
            where_clause=data3_where
        )
        
        if data_data3:
            update_excel_sheet(wb, "data3-xuất", data_data3)
        else:
            log("Không có dữ liệu mới cho sheet 'data3-xuất'.")

        # ----------------------------------------------------
        # FETCH DATA7 (TỒN KHO THEO NGÀY)
        # ----------------------------------------------------
        API_INVENTORY_LIST = "https://portal-be.sabeco.vn/api/inventories/inventoryList"
        log("Tải dữ liệu Tồn kho theo ngày (data7)...")
        data_data7 = fetch_data(
            API_INVENTORY_LIST,
            token,
            map_data7,
            where_clause="1>0"
        )
        
        if data_data7:
            update_excel_sheet(wb, "data7-tồn kho theo ngày", data_data7)
        else:
            log("Không có dữ liệu mới cho sheet 'data7-tồn kho theo ngày'.")

        # ----------------------------------------------------
        # FETCH DATA5 (TỒN KHO THEO PL, VÍ TRÍ)
        # ----------------------------------------------------
        API_INVENTORY_PALLET = "https://portal-be.sabeco.vn/api/inventories/getListInventoryByPallet"
        log("Tải dữ liệu Tồn kho theo PL, Ví trí (data5)...")
        data_data5 = fetch_data(
            API_INVENTORY_PALLET,
            token,
            map_data5,
            where_clause="1>0"
        )
        
        if data_data5:
            update_excel_sheet(wb, "data5-tồn kho theo PL, ví trí", data_data5)
        else:
            log("Không có dữ liệu mới cho sheet 'data5-tồn kho theo PL, ví trí'.")

        
        # ----------------------------------------------------
        # HOÀN TẤT VÀ LƯU EXCEL
        # ----------------------------------------------------
        
        # Vô hiệu hóa BackgroundQuery để buộc Python chờ Power Query chạy xong
        try:
            for conn in wb.Connections:
                try: 
                    if hasattr(conn, 'OLEDBConnection'):
                        conn.OLEDBConnection.BackgroundQuery = False
                except: pass
                try: 
                    if hasattr(conn, 'ODBCConnection'):
                        conn.ODBCConnection.BackgroundQuery = False
                except: pass
        except: pass
        
        log("Làm mới Power Query Data Connections (Gộp bảng Append1)...")
        try:
            import time
            wb.RefreshAll()
            # Chờ tối đa 60 giây, tránh treo vô hạn trên VPS không có GUI
            for _ in range(60):
                try:
                    excel.CalculateUntilAsyncQueriesDone()
                    break
                except:
                    time.sleep(1)
        except: pass

        log("Làm mới Pivot Tables và căn chỉnh giao diện...")
        try:
            for sheet_idx in range(1, wb.Sheets.Count + 1):
                sheet_obj = wb.Sheets(sheet_idx)
                
                # Xóa dòng trắng dư thừa ở sheet baocao6-HSD
                if sheet_obj.Name == "baocao6-HSD":
                    try:
                        if not any(sheet_obj.Range("A2:Z2").Value[0]):
                            sheet_obj.Rows(2).Delete()
                    except: pass

                try:
                    count_pt = sheet_obj.PivotTables().Count
                    for pt_idx in range(1, count_pt + 1):
                        pt = sheet_obj.PivotTables(pt_idx)
                        try:
                            pt.PivotCache().MissingItemsLimit = 0
                            pt.PivotCache().Refresh()
                            pt.RefreshTable()
                        except: pass
                except: pass
                    
                # Căn chỉnh kích thước cột cho vừa khít dữ liệu
                try:
                    sheet_obj.Columns.AutoFit()
                except: pass
        except Exception as pte:
            error_log(f"Cảnh báo khi làm mới Pivot: {pte}")
            
        try: excel.CalculateUntilAsyncQueriesDone()
        except: pass
        
        excel.ScreenUpdating = True
        try:
            wb.Save()
            log("Lưu file Excel thành công.")
        except Exception as se:
            error_log(f"Lỗi khi lưu Excel: {se}")
        
    except Exception as e:
        error_log(f"Lỗi: {e}")
    finally:
        if wb: 
            try: wb.Close(False)
            except: pass
        if excel: 
            try: excel.Quit()
            except: pass
        pythoncom.CoUninitialize()
        # Dọn sạch Excel zombie để Task Scheduler nhận biết tiến trình đã kết thúc
        import time
        time.sleep(2)
        os.system("taskkill /F /IM EXCEL.EXE >nul 2>&1")
        
    # Phase 2: Export to data.js
    export_to_js()
    log("=== HOÀN TẤT ===")

if __name__ == "__main__":
    main()
