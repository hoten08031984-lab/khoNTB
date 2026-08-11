// Dashboard Core Logic Application (Vanilla JS)

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

// Global state
let rawData = [];

/**
 * Chuẩn hóa tên cột để tránh lỗi chữ hoa/thường, có dấu/không dấu, khoảng trắng.
 */
function normalizeKey(str) {
  if (!str) return '';
  return String(str)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Bỏ dấu
    .replace(/\s+/g, " ")                             // Xóa khoảng trắng thừa giữa các chữ
    .trim()                                           // Xóa khoảng trắng 2 đầu
    .toUpperCase();                                   // Viết hoa toàn bộ
}

/**
 * Lấy giá trị từ row một cách an toàn dựa trên mảng các biến thể (variants) tên cột đã được chuẩn hóa.
 */
function getSafeValue(row, targetVariants) {
  // 1. Priority check for exact match
  for (let i = 0; i < targetVariants.length; i++) {
    const target = targetVariants[i];
    if (row[target] != null && String(row[target]).trim() !== '') {
      return row[target];
    }
  }

  // 2. Fallback check with normalized keys (respecting priority order)
  const normalizedTargets = targetVariants.map(v => normalizeKey(v));
  
  for (let i = 0; i < normalizedTargets.length; i++) {
    const normTarget = normalizedTargets[i];
    for (const key in row) {
      if (row.hasOwnProperty(key)) {
        if (normalizeKey(key) === normTarget) {
          if (row[key] != null && String(row[key]).trim() !== '') {
            return row[key];
          }
        }
      }
    }
  }
  return undefined;
}

let allDatesBC4 = [];
let searchQuery = '';
let currentSortColumn = 'TRẠNG THÁI';
let currentSortOrder = 'asc';

// BC2 state
let rawDataBC2 = [];
let searchQueryBC2 = '';
let currentSortColumnBC2 = 'MÃ KHO';   // Mặc định sắp theo Kho
let currentSortOrderBC2 = 'asc';      // A→Z

// BC2 Function state
let searchQueryBC2Function = '';
let currentSortColumnBC2Function = 'MÃ KHO';
let currentSortOrderBC2Function = 'asc';

// BC5 state
let rawDataBC5 = [];
let searchQueryBC5 = '';
let currentSortColumnBC5 = 'TỒN THỰC TẾ';
let currentSortOrderBC5 = 'desc';

// BC3 state
let rawDataBC3 = [];
let searchQueryBC3 = '';
let currentSortColumnBC3 = 'MÃ KHO';
let currentSortOrderBC3 = 'asc';

let currentReport = 'bc1'; // tab hiện tại

// Selected filter state sets
let selectedKho = new Set(['052', '05NT', '05KH', 'SKH']);
let selectedNgayBC4 = new Set();
let selectedNhomHang = new Set(['TP', 'BB', 'PL']);
let bc4Charts = {};
let selectedTrangThai = new Set(['16', '0']);

// BC4 state
let selectedNppBC4Value = '';
let allNppBC4 = [];
let searchQueryBC4 = '';
let currentSortColumnBC4 = 'MÃ HÀNG';
let currentSortOrderBC4 = 'asc';
let currentBC4FilteredRows = [];

const TARGET_KHO_LIST = ['052', '05NT', '05KH', 'SKH'];
const TARGET_NHOMHANG_LIST = ['TP', 'BB', 'PL'];
const TARGET_TRANGTHAI_LIST = ['ARRIVED', 'NEW'];

function initDashboard() {
  if (!window.DASHBOARD_DATA || !window.DASHBOARD_DATA['data1-đi đường']) {
    console.error("Dữ liệu DASHBOARD_DATA chưa được nạp!");
    return;
  }
  
  if (window.LAST_UPDATED_TIME) {
      const el = document.getElementById('last-updated-time');
      if (el) {
          const parts = window.LAST_UPDATED_TIME.split(' ');
          let dateStr = parts[0] || '';
          let timeStr = parts.slice(1).join(' ');
          let html = `<div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-end;">
            <div style="font-weight:600; color:var(--primary); background:rgba(37,99,235,0.1); padding:2px 8px; border-radius:4px; font-size:0.85rem; border: 1px solid rgba(37,99,235,0.2);">
              <span style="font-weight:normal; opacity:0.8;">Cập nhật lần cuối:</span> ${dateStr}
            </div>`;
          if (timeStr) {
             html += `<div style="font-weight:600; color:var(--primary); background:rgba(37,99,235,0.1); padding:2px 8px; border-radius:4px; font-size:0.85rem; border: 1px solid rgba(37,99,235,0.2);">${timeStr}</div>`;
          }
          html += `</div>`;
          el.innerHTML = html;
      }
  }

  rawData = window.DASHBOARD_DATA['data1-đi đường'] || [];
  rawDataBC2 = window.DASHBOARD_DATA['data6-tồn kho theo HSD'] || [];
  rawDataBC3 = window.DASHBOARD_DATA['baocao5-table8'] || [];
  rawDataBC5 = window.DASHBOARD_DATA['data7-tồn kho theo ngày'] || [];

  // Extract all unique dates from Append1 Nhập- Xuất
  allDatesBC4 = extractAllDates();
  // Mặc định chỉ chọn ngày gần nhất
  if (allDatesBC4.length > 0) {
    var latestBC4 = allDatesBC4[0];
    selectedNgayBC4 = new Set([latestBC4]);
  } else {
    selectedNgayBC4 = new Set(allDatesBC4);
  }

  // Populate Filter UI
  populateFilterLists();

  // Attach Event Listeners
  document.getElementById('btn-reset-filters').addEventListener('click', resetFilters);

  const searchInput = document.getElementById('table-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      applyFiltersAndRender();
    });
  }

  const searchInputBC2 = document.getElementById('table-search-bc2');
  if (searchInputBC2) {
    searchInputBC2.addEventListener('input', (e) => {
      searchQueryBC2 = e.target.value.trim().toLowerCase();
      applyFiltersAndRenderBC2();
    });
  }

  const searchInputBC2Func = document.getElementById('table-search-bc2-function');
  if (searchInputBC2Func) {
    searchInputBC2Func.addEventListener('input', (e) => {
      searchQueryBC2Function = e.target.value.trim().toLowerCase();
      renderBC2FunctionTable();
    });
  }

  const searchInputBC3 = document.getElementById('table-search-bc3');
  if (searchInputBC3) {
    searchInputBC3.addEventListener('input', (e) => {
      searchQueryBC3 = e.target.value.trim().toLowerCase();
      applyFiltersAndRenderBC3();
    });
  }

  const searchInputBC4 = document.getElementById('table-search-bc4');
  if (searchInputBC4) {
    searchInputBC4.addEventListener('input', (e) => {
      searchQueryBC4 = e.target.value.trim().toLowerCase();
      renderBC4Table();
    });
  }

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-group')) {
      closeAllDropdowns();
    }
  });

  // Initial Filter & Render
  applyFiltersAndRender();
  applyFiltersAndRenderBC2();
  applyFiltersAndRenderBC3();
  renderBC4();
    if (typeof applyFiltersAndRenderBC5 === 'function') applyFiltersAndRenderBC5();
    
  switchReport('bc1'); // Show default report
}

function extractAllDates() {
  const datesSet = new Set();

  // Lấy ngày từ sheet Append1 Nhập- Xuất – nguồn chính xác nhất các ngày hoạt động
  const appendSheet = window.DASHBOARD_DATA['Append1 Nhập- Xuất'] || [];
  appendSheet.forEach(row => {
    const d = getSafeValue(row, ['NGÀY']);
    if (d && typeof d === 'string' && d.trim() !== '') {
      datesSet.add(d.trim());
    }
  });

  // Fallback: nếu sheet Append chưa có dữ liệu, lấy từ data1 đi đường
  if (datesSet.size === 0) {
    const data1 = window.DASHBOARD_DATA['data1-đi đường'] || [];
    data1.forEach(row => {
      const d = getSafeValue(row, ['Column1']);
      if (d && typeof d === 'string' && d.trim() !== '') datesSet.add(d.trim());
    });
  }

  return Array.from(datesSet).sort((a, b) => {
    const partsA = a.split('/');
    const partsB = b.split('/');
    if(partsA.length === 3 && partsB.length === 3) {
      const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]);
      const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
      return dateB - dateA;
    }
    return b.localeCompare(a);
  });
}

function populateFilterLists() {
  renderCheckboxList('list-kho', TARGET_KHO_LIST, selectedKho, 'kho');
  renderCheckboxList('list-nhomhang', TARGET_NHOMHANG_LIST, selectedNhomHang, 'nhomhang');
  renderCheckboxList('list-ngay-bc4', allDatesBC4, selectedNgayBC4, 'ngay-bc4');
  extractAllNppsBC4();

  updateFilterTriggerLabels();
}

function renderCheckboxList(elementId, items, selectedSet, filterType) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = '';

  items.forEach(item => {
    const label = document.createElement('label');
    label.className = 'checkbox-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item;
    checkbox.checked = selectedSet.has(item);

    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedSet.add(item);
      } else {
        selectedSet.delete(item);
      }
      updateFilterTriggerLabels();
      if (filterType === 'npp-bc4') {
        renderBC4Table();
      } else if (filterType === 'ngay-bc4') {
        renderBC4();
    if (typeof applyFiltersAndRenderBC5 === 'function') applyFiltersAndRenderBC5();
    if (typeof applyFiltersAndRenderBC6 === 'function') applyFiltersAndRenderBC6();
    if (typeof renderBC3NppTable === 'function') renderBC3NppTable();
      } else {
        applyFiltersAndRender();
        applyFiltersAndRenderBC2();
        applyFiltersAndRenderBC3();
        renderBC4();
    if (typeof applyFiltersAndRenderBC5 === 'function') applyFiltersAndRenderBC5();
    if (typeof applyFiltersAndRenderBC6 === 'function') applyFiltersAndRenderBC6();
    if (typeof renderBC3NppTable === 'function') renderBC3NppTable();
      }
    });

    const textSpan = document.createElement('span');
    textSpan.textContent = item;

    label.appendChild(checkbox);
    label.appendChild(textSpan);
    container.appendChild(label);
  });
}

function toggleDropdown(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) {
    menu.classList.add('open');
    const group = menu.closest('.filter-group');
    if (group) group.classList.add('active-dropdown');
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.filter-group').forEach(g => g.classList.remove('active-dropdown'));
}

function selectAll(filterType, isSelectAll) {
  let targetSet, targetList, listId;

  if (filterType === 'kho') {
    targetSet = selectedKho; targetList = TARGET_KHO_LIST; listId = 'list-kho';
  } else if (filterType === 'nhomhang') {
    targetSet = selectedNhomHang; targetList = TARGET_NHOMHANG_LIST; listId = 'list-nhomhang';
  } else if (filterType === 'ngay-bc4') {
    targetSet = selectedNgayBC4; targetList = allDatesBC4; listId = 'list-ngay-bc4';
  } else if (filterType === 'npp-bc4') {
    targetSet = selectedNppBC4; targetList = allNppBC4; listId = 'list-npp-bc4';
  } else if (filterType === 'trangthai') {
    targetSet = selectedTrangThai; targetList = TARGET_TRANGTHAI_LIST; listId = 'list-trangthai';
  }

  if (!targetSet) return;

  if (isSelectAll) {
    targetList.forEach(item => targetSet.add(item));
  } else {
    targetSet.clear();
  }

  const container = document.getElementById(listId);
  if (container) {
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = isSelectAll;
    });
  }

  updateFilterTriggerLabels();
  applyFiltersAndRender();
  applyFiltersAndRenderBC2();
  applyFiltersAndRenderBC3();
  renderBC4();
    if (typeof applyFiltersAndRenderBC5 === 'function') applyFiltersAndRenderBC5();
    if (typeof applyFiltersAndRenderBC6 === 'function') applyFiltersAndRenderBC6();
    if (typeof renderBC3NppTable === 'function') renderBC3NppTable();
}



function updateFilterTriggerLabels() {
  const countKho = document.getElementById('count-kho');
  if (countKho) countKho.textContent = selectedKho.size;
  
  const labelKho = document.getElementById('label-kho');
  if (labelKho) {
    labelKho.textContent = `Đã chọn: ${selectedKho.size}/${TARGET_KHO_LIST.length} kho`;
  }

  const countNhom = document.getElementById('count-nhomhang');
  if (countNhom) countNhom.textContent = selectedNhomHang.size;

  const ngayEl = document.getElementById('count-ngay-bc4');
  const ngayLabel = document.getElementById('label-ngay-bc4');
  if (ngayEl) ngayEl.textContent = selectedNgayBC4.size;
  if (ngayLabel) {
    if (selectedNgayBC4.size === 1) {
      const singleDate = Array.from(selectedNgayBC4)[0];
      ngayLabel.textContent = `Đã chọn: ${singleDate}`;
    } else if (selectedNgayBC4.size === allDatesBC4.length || selectedNgayBC4.size === 0) {
      ngayLabel.textContent = 'Đã chọn: Tất cả ngày';
    } else {
      ngayLabel.textContent = `Đã chọn: ${selectedNgayBC4.size} ngày`;
    }
  }

  const summary = document.getElementById('active-filter-summary');
  if (summary) {
    summary.textContent = `Bộ lọc: ${selectedKho.size} Kho, ${selectedNhomHang.size} Nhóm`;
  }
}

function resetFilters() {
  selectedKho = new Set(TARGET_KHO_LIST);
  selectedNhomHang = new Set(TARGET_NHOMHANG_LIST);
  // Mặc định chỉ chọn ngày gần nhất
  if (allDatesBC4.length > 0) {
    var latestDate = allDatesBC4[0];
    selectedNgayBC4 = new Set([latestDate]);
  } else {
    selectedNgayBC4 = new Set(allDatesBC4);
  }
  populateFilterLists();
  updateFilterTriggerLabels();
  applyFiltersAndRender();
  applyFiltersAndRenderBC2();
  applyFiltersAndRenderBC3();
  renderBC4();
    if (typeof applyFiltersAndRenderBC5 === 'function') applyFiltersAndRenderBC5();
}

/**
 * Lấy Mã Kho từ row một cách an toàn bất kể tên cột là gì
 */
function getKhoValue(row) {
  const val = getSafeValue(row, ['MÃ KHO']);
  if (val) {
    let strVal = String(val).trim();
    if (strVal.endsWith(' Total') && strVal !== 'Grand Total') {
      strVal = strVal.replace(' Total', '').trim();
    }
    return strVal;
  }
  return '';
}


function groupBC1Rows(rows) {
  if (!rows || rows.length === 0) return [];
  const map = new Map();

  rows.forEach(row => {
    const rawStatusStr = getSafeValue(row, ['TRẠNG THÁI']) ? String(getSafeValue(row, ['TRẠNG THÁI'])).trim() : '';
    const statusStr = (rawStatusStr === '16' || rawStatusStr.toUpperCase() === 'ARRIVED') ? 'ARRIVED' : ((rawStatusStr === '0' || rawStatusStr.toUpperCase() === 'NEW') ? 'NEW' : rawStatusStr);
    const khoXuat = getSafeValue(row, ['KHO XUẤT']) ? String(getSafeValue(row, ['KHO XUẤT'])).trim() : '';
    const soXe = getSafeValue(row, ['SỐ XE']) ? String(getSafeValue(row, ['SỐ XE'])).trim() : '';
    const maHang = getSafeValue(row, ['MÃ HÀNG']) ? String(getSafeValue(row, ['MÃ HÀNG'])).trim() : '';
    const donViTinh = getSafeValue(row, ['ĐƠN VỊ TÍNH', 'ĐVT']) ? String(getSafeValue(row, ['ĐƠN VỊ TÍNH', 'ĐVT'])).trim() : '';

    const key = `${statusStr}||${khoXuat}||${soXe}||${maHang}||${donViTinh}`;

    const qty = parseFloat(getSafeValue(row, ['SỐ LƯỢNG'])) || 0;
    const pl = parseFloat(getSafeValue(row, ['SỐ LƯỢNG PL', 'SL PL'])) || 0;

    if (!map.has(key)) {
      const cloned = { ...row };
      cloned['_qtySum'] = qty;
      cloned['_plSum'] = pl;
      map.set(key, cloned);
    } else {
      const existing = map.get(key);
      existing['_qtySum'] += qty;
      existing['_plSum'] += pl;
    }
  });

  return Array.from(map.values()).map(item => {
    const cloned = { ...item };
    cloned['_plSum'] = Math.round(cloned['_plSum'] * 1000) / 1000;
    cloned['SỐ LƯỢNG'] = cloned['_qtySum'];
    cloned['SỐ LƯỢNG PL'] = cloned['_plSum'];
    cloned['SL PL'] = cloned['_plSum'];
    return cloned;
  });
}

function applyFiltersAndRender() {
  const filteredRows = rawData.filter(row => {
    const maKho = getKhoValue(row);
    let trangThai = getSafeValue(row, ['TRẠNG THÁI']) ? String(getSafeValue(row, ['TRẠNG THÁI'])).trim() : '';
    
    const matchKho = selectedKho.has(maKho);
    const matchTrangThai = selectedTrangThai.has(trangThai) || 
                          (trangThai.toUpperCase() === 'ARRIVED' && selectedTrangThai.has('16')) || 
                          (trangThai.toUpperCase() === 'NEW' && selectedTrangThai.has('0'));
    return matchKho && matchTrangThai;
  });

  let tpQty = 0, tpPL = 0;
  let bbQty = 0, bbPL = 0;
  let plQty = 0, plPL = 0;
  let totalQty = 0, totalPL = 0;
  const arrivedVehicles = new Set();
  const intransitVehicles = new Set();
  filteredRows.forEach(row => {
    const rawStatus = getSafeValue(row, ['TRẠNG THÁI']) ? String(getSafeValue(row, ['TRẠNG THÁI'])).trim().toUpperCase() : '';
    const status = (rawStatus === '16' || rawStatus === 'ARRIVED') ? 'ARRIVED' : ((rawStatus === '0' || rawStatus === 'NEW') ? 'NEW' : rawStatus);
    const vehicle = getSafeValue(row, ['SỐ XE']) ? String(getSafeValue(row, ['SỐ XE'])).trim() : (getSafeValue(row, ['MÃ CHUYẾN']) || 'Chuyến lẻ');

    if (status === 'ARRIVED') {
      arrivedVehicles.add(vehicle);
    } else if (status === 'NEW' || status === 'IN-TRANSIT') {
      intransitVehicles.add(vehicle);
    }

    const qty = parseFloat(getSafeValue(row, ['SỐ LƯỢNG'])) || 0;
    const pl = parseFloat(getSafeValue(row, ['SỐ LƯỢNG PL', 'SL PL'])) || 0;

    const group = getSafeValue(row, ['NHÓM HÀNG']) ? String(getSafeValue(row, ['NHÓM HÀNG'])).trim().toUpperCase() : '';

    if (group === 'TP') {
      tpQty += qty; tpPL += pl;
    } else if (group === 'BB') {
      bbQty += qty; bbPL += pl;
    } else if (group === 'PL') {
      plQty += qty; plPL += pl;
    }

    totalQty += qty;
    totalPL += pl;
  });

  const countB1 = arrivedVehicles.size;
  const countB2 = intransitVehicles.size;
  const totalVehicles = countB1 + countB2;

  const pctB1 = totalVehicles > 0 ? Math.round((countB1 / totalVehicles) * 100) : 0;
  const pctB2 = totalVehicles > 0 ? Math.round((countB2 / totalVehicles) * 100) : 0;

  // Render B1 & B2
  if (document.getElementById('val-b1')) document.getElementById('val-b1').textContent = countB1;
  if (document.getElementById('val-b2')) document.getElementById('val-b2').textContent = countB2;

  // Render Separated Product Breakdown (if elements exist)
  if (document.getElementById('val-tp-qty')) document.getElementById('val-tp-qty').textContent = formatNumber(tpQty);
  if (document.getElementById('val-tp-pl')) document.getElementById('val-tp-pl').textContent = formatNumber(tpPL);
  if (document.getElementById('val-bb-qty')) document.getElementById('val-bb-qty').textContent = formatNumber(bbQty);
  if (document.getElementById('val-bb-pl')) document.getElementById('val-bb-pl').textContent = formatNumber(bbPL);
  if (document.getElementById('val-pl-qty')) document.getElementById('val-pl-qty').textContent = formatNumber(plQty);
  if (document.getElementById('val-pl-pl')) document.getElementById('val-pl-pl').textContent = formatNumber(plPL);
  if (document.getElementById('val-total-qty')) document.getElementById('val-total-qty').textContent = formatNumber(totalQty);
  if (document.getElementById('val-total-pl')) document.getElementById('val-total-pl').textContent = formatNumber(totalPL);

  // 3. Gom nhóm Pivot các dòng trùng thuộc tính hiển thị (Trạng Thái, Kho Xuất, Số Xe, Mã Hàng, ĐVT)
  const groupedRows = groupBC1Rows(filteredRows);

  // 4. Lọc dòng theo từ khóa tìm kiếm
  let searchRows = groupedRows;
  if (searchQuery) {
    searchRows = groupedRows.filter(row => {
      const text = [
        getSafeValue(row, ['KHO XUẤT']), getSafeValue(row, ['SỐ XE']), getSafeValue(row, ['MÃ HÀNG']), getSafeValue(row, ['TÊN HÀNG']), getSafeValue(row, ['ĐƠN VỊ TÍNH', 'ĐVT']), getSafeValue(row, ['TRẠNG THÁI'])
      ].join(' ').toLowerCase();
      return text.includes(searchQuery);
    });
  }

  // 5. Sắp xếp các dòng theo cột và thứ tự được chọn
  searchRows = sortRows(searchRows, currentSortColumn, currentSortOrder);

  // Render Table & Grand Total Footer
  renderTable(searchRows, totalQty, totalPL);
  
  // Render Biểu đồ hình cột BC1 (Mã hàng & ĐVT)
  renderBC1Charts(searchRows);
}

// ==========================================
// BIỂU ĐỒ BÁO CÁO 1 (Trục X = MÃ KHO, Cột phân loại theo MÃ HÀNG / ĐVT)
// ==========================================
var bc1Charts = {};

var ITEM_COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4f46e5'];

function bc1GetOrCreate(chartId, config) {
  if (typeof Chart === 'undefined') return;
  var ctx = document.getElementById(chartId);
  if (!ctx) return;
  if (bc1Charts[chartId]) {
    bc1Charts[chartId].destroy();
    delete bc1Charts[chartId];
  }
  try {
    bc1Charts[chartId] = new Chart(ctx, config);
  } catch(e) {
    console.error('Lỗi tạo chart BC1:', chartId, e);
  }
}

function renderBC1Charts(rows) {
  if (!rows || rows.length === 0) {
    bc1DrawChartMaHang([], {}, []);
    bc1DrawChartDVT([], {}, []);
    return;
  }

  var khoMaHangMap = {};
  var khoDvtMap = {};
  var khoSet = new Set();
  var maHangSet = new Set();
  var dvtSet = new Set();

  rows.forEach(function(row) {
    var kho = getKhoValue(row) || 'Khác';
    var maHang = getSafeValue(row, ['MÃ HÀNG']) ? String(getSafeValue(row, ['MÃ HÀNG'])).trim() : 'N/A';
    var dvt = getSafeValue(row, ['ĐƠN VỊ TÍNH', 'ĐVT']) ? String(getSafeValue(row, ['ĐƠN VỊ TÍNH', 'ĐVT'])).trim() : 'N/A';
    var qty = parseFloat(getSafeValue(row, ['SỐ LƯỢNG'])) || 0;

    if (kho) khoSet.add(kho);

    if (maHang && maHang !== 'N/A') {
      maHangSet.add(maHang);
      if (!khoMaHangMap[kho]) khoMaHangMap[kho] = {};
      khoMaHangMap[kho][maHang] = (khoMaHangMap[kho][maHang] || 0) + qty;
    }
    if (dvt && dvt !== 'N/A') {
      dvtSet.add(dvt);
      if (!khoDvtMap[kho]) khoDvtMap[kho] = {};
      khoDvtMap[kho][dvt] = (khoDvtMap[kho][dvt] || 0) + qty;
    }
  });

  var uniqueKhos = Array.from(khoSet).sort();
  var uniqueMaHangs = Array.from(maHangSet).sort();
  var uniqueDvts = Array.from(dvtSet).sort();

  bc1DrawChartMaHang(uniqueKhos, khoMaHangMap, uniqueMaHangs);
  bc1DrawChartDVT(uniqueKhos, khoDvtMap, uniqueDvts);
}

function bc1DrawChartMaHang(khos, dataMap, maHangs) {
  var datalabelsPlugin = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];

  var datasets = (maHangs || []).map(function(mh, idx) {
    var data = (khos || []).map(function(kho) {
      return (dataMap[kho] && dataMap[kho][mh]) ? dataMap[kho][mh] : 0;
    });
    return {
      label: mh,
      data: data,
      backgroundColor: ITEM_COLORS[idx % ITEM_COLORS.length],
      borderRadius: 4,
      borderSkipped: false
    };
  });

  var config = {
    type: 'bar',
    data: {
      labels: khos,
      datasets: datasets
    },
    plugins: datalabelsPlugin,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 11, weight: 'bold' }, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.dataset.label + ': ' + formatNumber(ctx.raw);
            }
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#1e293b',
          font: { size: 9, weight: 'bold' },
          formatter: function(v) {
            return v > 0 ? formatNumber(v) : '';
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#1e293b', font: { size: 11, weight: '700' } }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: '#475569', font: { size: 10, weight: '600' } },
          beginAtZero: true
        }
      }
    }
  };

  bc1GetOrCreate('chart-bc1-mahang', config);
}

function bc1DrawChartDVT(khos, dataMap, dvts) {
  var datalabelsPlugin = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];

  var datasets = (dvts || []).map(function(dvt, idx) {
    var data = (khos || []).map(function(kho) {
      return (dataMap[kho] && dataMap[kho][dvt]) ? dataMap[kho][dvt] : 0;
    });
    return {
      label: dvt,
      data: data,
      backgroundColor: ITEM_COLORS[idx % ITEM_COLORS.length],
      borderRadius: 4,
      borderSkipped: false
    };
  });

  var config = {
    type: 'bar',
    data: {
      labels: khos,
      datasets: datasets
    },
    plugins: datalabelsPlugin,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 11, weight: 'bold' }, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.dataset.label + ': ' + formatNumber(ctx.raw);
            }
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#1e293b',
          font: { size: 9, weight: 'bold' },
          formatter: function(v) {
            return v > 0 ? formatNumber(v) : '';
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#1e293b', font: { size: 11, weight: '700' } }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: '#475569', font: { size: 10, weight: '600' } },
          beginAtZero: true
        }
      }
    }
  };

  bc1GetOrCreate('chart-bc1-dvt', config);
}

function handleSort(colName) {
  if (currentSortColumn === colName) {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumn = colName;
    currentSortOrder = 'asc';
  }
  updateSortIcons();
  applyFiltersAndRender();
}

function updateSortIcons() {
  const cols = ['TRẠNG THÁI', 'KHO XUẤT', 'SỐ XE', 'MÃ HÀNG', 'ĐƠN VỊ TÍNH', 'SỐ LƯỢNG', 'SỐ LƯỢNG PL'];
  cols.forEach(col => {
    const iconEl = document.getElementById(`sort-${col}`);
    if (iconEl) {
      if (col === currentSortColumn) {
        iconEl.textContent = currentSortOrder === 'asc' ? '▲' : '▼';
        iconEl.style.color = 'var(--accent-cyan)';
      } else {
        iconEl.textContent = '↕';
        iconEl.style.color = 'var(--text-muted)';
      }
    }
  });
}

function sortRows(rows, column, order) {
  return [...rows].sort((a, b) => {
    let valA = a[column] !== undefined && a[column] !== null ? a[column] : '';
    let valB = b[column] !== undefined && b[column] !== null ? b[column] : '';

    if (column === 'MÃ KHO') {
      const ORDER = ["052", "05NT", "05KH", "SKH"];
      let ia = ORDER.indexOf(valA);
      let ib = ORDER.indexOf(valB);
      if(ia === -1) ia = 999;
      if(ib === -1) ib = 999;
      if (ia !== ib) {
        return order === 'asc' ? ia - ib : ib - ia;
      }
    }

    if (column === 'SỐ LƯỢNG' || column === 'SỐ LƯỢNG PL') {
      const numA = parseFloat(valA) || 0;
      const numB = parseFloat(valB) || 0;
      return order === 'asc' ? numA - numB : numB - numA;
    }

    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();

    if (strA < strB) return order === 'asc' ? -1 : 1;
    if (strA > strB) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderTable(rows, totalQty, totalPL) {
  const tbody = document.getElementById('tbody-bc1');
  const tfoot = document.getElementById('tfoot-bc1');
  const countBadge = document.getElementById('records-count');

  if (countBadge) countBadge.textContent = `${rows.length} Dòng Hiển Thị`;
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">🔍</div>
            <p>Không có dữ liệu phù hợp với bộ lọc hiện tại.</p>
          </div>
        </td>
      </tr>
    `;
    tfoot.innerHTML = '';
    return;
  }

  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');

    const rawStatusStr = getSafeValue(row, ['TRẠNG THÁI']) ? String(getSafeValue(row, ['TRẠNG THÁI'])).trim() : '';
    const statusStr = (rawStatusStr === '16' || rawStatusStr.toUpperCase() === 'ARRIVED') ? 'ARRIVED' : ((rawStatusStr === '0' || rawStatusStr.toUpperCase() === 'NEW') ? 'NEW' : rawStatusStr);
    const isArrived = statusStr.toUpperCase() === 'ARRIVED';
    const statusBadgeClass = isArrived ? 'status-badge arrived' : 'status-badge new';
    const statusText = isArrived ? 'ARRIVED (Đã Đến)' : 'NEW (Đang Đi)';

    const khoXuat = getSafeValue(row, ['KHO XUẤT']) || 'N/A';
    const soXe = getSafeValue(row, ['SỐ XE']) || 'N/A';
    const maHang = getSafeValue(row, ['MÃ HÀNG']) || 'N/A';
    const donViTinh = getSafeValue(row, ['ĐƠN VỊ TÍNH']) || 'N/A';
    const qty = parseFloat(getSafeValue(row, ['SỐ LƯỢNG'])) || 0;
    const pl = parseFloat(getSafeValue(row, ['SỐ LƯỢNG PL'])) || 0;

    tr.innerHTML = `
      <td class="text-center">${idx + 1}</td>
      <td><span class="${statusBadgeClass}">${statusText}</span></td>
      <td>${escapeHtml(khoXuat)}</td>
      <td><strong>${escapeHtml(soXe)}</strong></td>
      <td><code style="color: var(--accent-cyan); font-weight:700;">${escapeHtml(maHang)}</code></td>
      <td>${escapeHtml(donViTinh)}</td>
      <td class="text-right"><strong>${formatNumber(qty)}</strong></td>
      <td class="text-right"><strong>${formatNumber(pl)}</strong></td>
    `;

    tbody.appendChild(tr);
  });

  // Grand Total Row
  tfoot.innerHTML = `
    <tr>
      <td colspan="6" class="text-right"><strong>TỔNG CỘNG TOÀN BỘ (GRAND TOTAL)</strong></td>
      <td class="text-right"><strong>${formatNumber(totalQty)}</strong></td>
      <td class="text-right"><strong>${formatNumber(totalPL)}</strong></td>
    </tr>
  `;
}

function formatNumber(num) {
  if (isNaN(num)) return 0;
  return new Intl.NumberFormat('en-US').format(num);
}

// ==========================================
// BÁO CÁO 3: VỊ TRÍ
// ==========================================

function applyFiltersAndRenderBC3() {
  if (!window.DASHBOARD_DATA) return;
  
  // BẢNG CHI TIẾT ƯỚC TÍNH (GIỮ NGUYÊN KHÔNG ĐỤNG TỚI)
  // Lọc dữ liệu chi tiết
  let filteredData = rawDataBC3.filter(row => {
    const maKho = getKhoValue(row);
    
    let passKho = true;
    if (selectedKho.size > 0) {
      passKho = selectedKho.has(maKho);
    }
    // Không có cột Ngày, Nhóm hàng nên bỏ qua các bộ lọc đó
    return passKho;
  });

  if (searchQueryBC3 && filteredData.length > 0) {
    const keys = Object.keys(filteredData[0]);
    filteredData = filteredData.filter(row => {
      const mk = String(row[keys[0]] || '').toLowerCase();
      const th = String(row[keys[1]] || '').toLowerCase();
      return mk.includes(searchQueryBC3) || th.includes(searchQueryBC3);
    });
  }

  // Sắp xếp table8
  if (filteredData.length > 0) {
      const keys = Object.keys(filteredData[0]);
      if (!keys.includes(currentSortColumnBC3)) {
          currentSortColumnBC3 = keys[0]; // fallback to first column
      }
  }
  
  filteredData.sort((a, b) => {
    let valA = a[currentSortColumnBC3];
    let valB = b[currentSortColumnBC3];
    
    if (currentSortColumnBC3 === 'SỐ LƯỢNG') {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
      return currentSortOrderBC3 === 'asc' ? valA - valB : valB - valA;
    }

    if (currentSortColumnBC3 === 'MÃ KHO') {
      const ORDER = ["052", "05NT", "05KH", "SKH"];
      let ia = ORDER.indexOf(valA);
      let ib = ORDER.indexOf(valB);
      if(ia === -1) ia = 999;
      if(ib === -1) ib = 999;
      if (ia !== ib) {
        return currentSortOrderBC3 === 'asc' ? ia - ib : ib - ia;
      }
    }
    
    valA = String(valA || '').toLowerCase();
    valB = String(valB || '').toLowerCase();
    
    if (valA < valB) return currentSortOrderBC3 === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortOrderBC3 === 'asc' ? 1 : -1;
    return 0;
  });

  // BẢNG PALLET TRÊN HỆ THỐNG SWM (LÀM LẠI CHỈ LỌC PL TỪ DATA5 VÀ CHUYỂN MÃ KHO THÀNH CỘT)
  const palletRawData = window.DASHBOARD_DATA['data5-tồn kho theo PL, ví trí'] || [];
  
  let pivotMap = {}; // { 'TP': { 'NP': { '052': 100 } } }
  let khoSet = new Set();
  let grandTotalRow = {}; // { '052': 100, ... }
  let grandTotalAll = 0;

  palletRawData.forEach(row => {
      const kho = getKhoValue(row);
      const nhomHang = getSafeValue(row, ['NHÓM HÀNG']) ? String(getSafeValue(row, ['NHÓM HÀNG'])).trim() : '';
      const viTri = getSafeValue(row, ['VỊ TRÍ']) || 'Không xác định';
      const maHang = getSafeValue(row, ['MÃ HÀNG']) || '';
      const qty = parseFloat(getSafeValue(row, ['SỐ LƯỢNG'])) || 0;
      
      let passKho = true;
      if (selectedKho.size > 0) {
        passKho = selectedKho.has(kho);
      }
      
      let passNhom = (nhomHang === 'PL');
      if (selectedNhomHang.size > 0 && !selectedNhomHang.has('PL')) {
        passNhom = false;
      }
      
      if (passKho && passNhom) {
          khoSet.add(kho);
          
          if (!pivotMap[viTri]) {
              pivotMap[viTri] = {};
          }
          if (!pivotMap[viTri][maHang]) {
              pivotMap[viTri][maHang] = {};
          }
          if (!pivotMap[viTri][maHang][kho]) {
              pivotMap[viTri][maHang][kho] = 0;
          }
          pivotMap[viTri][maHang][kho] += qty;
          
          if (!grandTotalRow[kho]) grandTotalRow[kho] = 0;
          grandTotalRow[kho] += qty;
          grandTotalAll += qty;
      }
  });

  const ORDER = ["052", "05NT", "05KH", "SKH"];
  let khoCols = Array.from(khoSet).sort((a, b) => {
      let ia = ORDER.indexOf(a);
      let ib = ORDER.indexOf(b);
      if(ia === -1) ia = 999;
      if(ib === -1) ib = 999;
      return ia - ib;
  });

  // Cập nhật lên UI
  renderTableBC3Detail(filteredData);
  renderTableBC3Pivot(pivotMap, khoCols, grandTotalRow, grandTotalAll);
}

function handleSortBC3(column) {
  if (currentSortColumnBC3 === column) {
    currentSortOrderBC3 = currentSortOrderBC3 === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumnBC3 = column;
    currentSortOrderBC3 = 'asc';
  }
  updateSortIconsBC3();
  applyFiltersAndRenderBC3();
}

function updateSortIconsBC3() {
  // Sort này chỉ dùng cho Bảng Chi Tiết Ước Tính
  document.querySelectorAll('th span[id^="sort3-"]').forEach(span => {
    span.textContent = '⇕';
  });
  const activeSpan = document.getElementById(`sort3-${currentSortColumnBC3}`);
  if (activeSpan) {
    activeSpan.textContent = currentSortOrderBC3 === 'asc' ? '▲' : '▼';
  }
}

function renderTableBC3Pivot(pivotMap, khoCols, grandTotalRow, grandTotalAll) {
  const thead = document.getElementById('thead-bc3-pivot');
  const tbody = document.getElementById('tbody-bc3-pivot');
  if (!thead || !tbody) return;
  
  // Render Thead
  let thHtml = `<tr>
    <th style="width: 20%;">VỊ TRÍ</th>
    <th style="width: 20%;">MÃ HÀNG</th>`;
  khoCols.forEach(k => {
      thHtml += `<th class="text-right">${k}</th>`;
  });
  thHtml += `</tr>`;
  thead.innerHTML = thHtml;

  tbody.innerHTML = '';
  
  const VI_TRI_ORDER = ["TP", "RONG", "RỖNG", "FUNCTION"];
  const viTriKeys = Object.keys(pivotMap).sort((a, b) => {
    const normA = String(a).toUpperCase().trim();
    const normB = String(b).toUpperCase().trim();
    let indexA = VI_TRI_ORDER.findIndex(o => normA.includes(o));
    let indexB = VI_TRI_ORDER.findIndex(o => normB.includes(o));
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    if (indexA !== indexB) return indexA - indexB;
    return normA.localeCompare(normB);
  });
  if (viTriKeys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${khoCols.length + 2}" class="text-center">Không có dữ liệu</td></tr>`;
    return;
  }
  
  let html = '';
  viTriKeys.forEach(viTri => {
      const maHangKeys = Object.keys(pivotMap[viTri]).sort();
      let first = true;
      let viTriTotal = { _all: 0 };
      
      maHangKeys.forEach(maHang => {
          html += `<tr>`;
          if (first) {
              html += `<td rowspan="${maHangKeys.length + 1}" style="vertical-align: middle; font-weight: bold; background: rgba(0,0,0,0.02);">${viTri}</td>`;
          }
          html += `<td>${maHang}</td>`;
          
          let rowTotal = 0;
          khoCols.forEach(k => {
              const qty = pivotMap[viTri][maHang][k] || 0;
              rowTotal += qty;
              
              if (!viTriTotal[k]) viTriTotal[k] = 0;
              viTriTotal[k] += qty;
              
              html += `<td class="text-right">${qty > 0 ? formatNumber(qty) : ''}</td>`;
          });
          
          viTriTotal._all += rowTotal;
          html += `</tr>`;
          first = false;
      });
      
      // Subtotal cho Vị Trí (Giống RONG Total, TP Total)
      html += `<tr style="background: rgba(0,0,0,0.03); font-weight: bold;">
          <td>${viTri} Total</td>`;
      khoCols.forEach(k => {
          html += `<td class="text-right">${viTriTotal[k] > 0 ? formatNumber(viTriTotal[k]) : ''}</td>`;
      });
      html += `</tr>`;
  });
  
  // Grand Total Row
  html += `<tr style="background: rgba(0,0,0,0.05); font-weight: bold;">
      <td colspan="2">Grand Total</td>`;
  khoCols.forEach(k => {
      html += `<td class="text-right">${grandTotalRow[k] > 0 ? formatNumber(grandTotalRow[k]) : ''}</td>`;
  });
  html += `</tr>`;

  tbody.innerHTML = html;
}

function renderTableBC3Detail(data) {
  const tbody = document.getElementById('tbody-bc3-detail');
  const thead = document.getElementById('thead-bc3-detail');
  if (!tbody || !thead) return;
  
  if (data.length > 0) {
      const keys = Object.keys(data[0]);
      let theadHtml = '<tr>';
      keys.forEach((key, index) => {
          if (index < 5 && index !== 1) { // Bỏ qua index 1 (TÊN KHO)
              const alignClass = index >= 2 ? 'text-right' : '';
              let displayKey = key;
              if (key.includes('PL ƯỚC TÍNH')) {
                  displayKey = 'PL ƯỚC TÍNH (TP&BB)';
              } else if (key.includes('PL VỊ TRÍ TP')) {
                  displayKey = 'SWM: PL TP';
              } else if (key.includes('PL VỊ TRÍ RỖNG')) {
                  displayKey = 'SWM: PL RỖNG';
              }
              theadHtml += `<th style="cursor:pointer;" class="${alignClass}" onclick="handleSortBC3('${key}')">${displayKey} <span id="sort3-${key}" class="sort-icon">⇕</span></th>`;
          }
      });
      theadHtml += '</tr>';
      thead.innerHTML = theadHtml;
  }

  tbody.innerHTML = '';
  
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center">Không có dữ liệu phù hợp</td></tr>`;
    document.getElementById('tfoot-bc3-detail').innerHTML = '';
    return;
  }
  
  const keys = Object.keys(data[0]);
  let totalPLUocTinh = 0;
  let totalPLHT = 0;
  let totalPLRong = 0;

  data.forEach(row => {
    totalPLUocTinh += Number(row[keys[2]] || 0);
    totalPLHT += Number(row[keys[3]] || 0);
    totalPLRong += Number(row[keys[4]] || 0);
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center">${row[keys[0]] || ''}</td>
      <td class="text-right" style="padding-right: 15px;">${formatNumber(row[keys[2]])}</td>
      <td class="text-right" style="padding-right: 15px;">${formatNumber(row[keys[3]])}</td>
      <td class="text-right" style="padding-right: 15px;">${formatNumber(row[keys[4]])}</td>
    `;
    tbody.appendChild(tr);
  });
  
  // Footer tổng
  const tfoot = document.getElementById('tfoot-bc3-detail');
  if (tfoot) {
    tfoot.innerHTML = `
      <tr style="font-weight:bold; background-color: rgba(255, 255, 255, 0.1);">
        <td class="text-right" style="padding-right: 15px;">Tổng cộng:</td>
        <td class="text-right" style="padding-right: 15px;">${formatNumber(totalPLUocTinh)}</td>
        <td class="text-right" style="padding-right: 15px;">${formatNumber(totalPLHT)}</td>
        <td class="text-right" style="padding-right: 15px;">${formatNumber(totalPLRong)}</td>
      </tr>
    `;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ═══════════════════════════════════════════════
// TAB NAV – Chuyển đổi báo cáo (hiển thị / ẩn)
// ═══════════════════════════════════════════════
function switchReport(reportId) {
  // Hide all reports
  document.querySelectorAll('.report-section').forEach(sec => {
    sec.style.display = 'none';
  });
  
  // Show selected report
  const selectedSec = document.getElementById('report-' + reportId);
  if (selectedSec) {
    selectedSec.style.display = 'flex'; // Use flex because of the css layout
  }
  
  // Update nav pills
  document.querySelectorAll('.report-nav-pill').forEach(pill => {
    pill.classList.remove('active');
  });
  const activePill = document.getElementById('pill-' + reportId);
  if (activePill) {
    activePill.classList.add('active');
  }

  currentReport = reportId;
}

// ═══════════════════════════════════════════════
// BÁO CÁO 2: HÀNG GẦN HẾT HẠN ((%) HSD < 60%)
// ═══════════════════════════════════════════════
function applyFiltersAndRenderBC2() {
  // Lọc theo Mã Kho (từ bộ lọc chung) và (%) HSD < 60
  const filteredRows = rawDataBC2.filter(row => {
    const maKho = getKhoValue(row);
    const pctHSD = parseFloat(getSafeValue(row, ['(%) HSD']));
    const matchKho = selectedKho.has(maKho);
    const matchHSD = !isNaN(pctHSD) && pctHSD < 60;
    return matchKho && matchHSD;
  });

  // Tìm kiếm thếm nếu có
  let searchRows = filteredRows;
  if (searchQueryBC2) {
    searchRows = filteredRows.filter(row => {
      const text = [
        getSafeValue(row, ['MÃ KHO']), getSafeValue(row, ['MÃ HÀNG']), getSafeValue(row, ['TÊN HÀNG']), getSafeValue(row, ['ĐƠN VỊ TÌNH'])
      ].join(' ').toLowerCase();
      return text.includes(searchQueryBC2);
    });
  }

  // Sắp xếp: theo cột người dùng chọn, rồi phụ theo MÃ HÀNG A→Z
  searchRows = sortRowsBC2(searchRows);

  // Tính KPI
  const totalQty = filteredRows.reduce((sum, r) => sum + (parseFloat(r['SỐ LƯỢNG']) || 0), 0);
  const uniqueMaHang = new Set(filteredRows.map(r => r['MÃ HÀNG'])).size;

  // Cập nhật KPI
  const valCount = document.getElementById('val-bc2-count');
  const valQty = document.getElementById('val-bc2-qty');
  if (valCount) valCount.textContent = uniqueMaHang;
  if (valQty) valQty.textContent = formatNumber(totalQty);

  // Render bảng HSD
  renderTableBC2(searchRows, totalQty);

  // Render bảng Vị Trí FUNCTION từ Data5
  renderBC2FunctionTable();
}

function handleSortBC2(colName) {
  if (currentSortColumnBC2 === colName) {
    currentSortOrderBC2 = currentSortOrderBC2 === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumnBC2 = colName;
    currentSortOrderBC2 = 'asc';
  }
  updateSortIconsBC2();
  applyFiltersAndRenderBC2();
}

function updateSortIconsBC2() {
  const cols = ['MÃ KHO', 'MÃ HÀNG', 'TÊN HÀNG', 'NSX', 'HSD', 'SỐ NGÀY CÒN LẠI', '(%) HSD', 'SỐ LƯỢNG'];
  cols.forEach(col => {
    const iconEl = document.getElementById('sort2-' + col);
    if (iconEl) {
      if (col === currentSortColumnBC2) {
        iconEl.textContent = currentSortOrderBC2 === 'asc' ? '▲' : '▼';
        iconEl.style.color = 'var(--accent-blue)';
      } else {
        iconEl.textContent = '⇕';
        iconEl.style.color = 'var(--text-muted)';
      }
    }
  });
}

function sortRowsGeneric(rows, column, order) {
  return [...rows].sort((a, b) => {
    let valA = a[column] !== undefined && a[column] !== null ? a[column] : '';
    let valB = b[column] !== undefined && b[column] !== null ? b[column] : '';
    
    if (column === 'MÃ KHO') {
      const ORDER = ["052", "05NT", "05KH", "SKH"];
      let ia = ORDER.indexOf(valA);
      let ib = ORDER.indexOf(valB);
      if(ia === -1) ia = 999;
      if(ib === -1) ib = 999;
      if (ia !== ib) {
        return order === 'asc' ? ia - ib : ib - ia;
      }
    }
    
    const numA = parseFloat(valA);
    const numB = parseFloat(valB);
    if (!isNaN(numA) && !isNaN(numB)) {
      return order === 'asc' ? numA - numB : numB - numA;
    }
    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    if (strA < strB) return order === 'asc' ? -1 : 1;
    if (strA > strB) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

// Sắp xếp BC2: primary = Mã Kho A→Z, secondary = (%) HSD tăng dần (nguy cấp nhất lên đầu)
function sortRowsBC2(rows) {
  return [...rows].sort((a, b) => {
    // --- Primary sort: cột user chọn (mặc định MÃ KHO A→Z) ---
    const col = currentSortColumnBC2;
    const order = currentSortOrderBC2;
    let valA = a[col] !== undefined && a[col] !== null ? a[col] : '';
    let valB = b[col] !== undefined && b[col] !== null ? b[col] : '';
    
    let cmp = 0;
    if (col === 'MÃ KHO') {
      const ORDER = ["052", "05NT", "05KH", "SKH"];
      let ia = ORDER.indexOf(valA);
      let ib = ORDER.indexOf(valB);
      if(ia === -1) ia = 999;
      if(ib === -1) ib = 999;
      if (ia !== ib) {
        cmp = order === 'asc' ? ia - ib : ib - ia;
      }
    } else {
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        cmp = order === 'asc' ? numA - numB : numB - numA;
      } else {
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        cmp = strA < strB ? (order === 'asc' ? -1 : 1)
            : strA > strB ? (order === 'asc' ?  1 : -1)
            : 0;
      }
    }
    
    if (cmp !== 0) return cmp;

    // --- Secondary sort: (%) HSD tăng dần — nguy cấp nhất (% nhỏ) lên đầu ---
    const pctA = parseFloat(a['(%) HSD']) || 0;
    const pctB = parseFloat(b['(%) HSD']) || 0;
    return pctA - pctB;
  });
}

function renderTableBC2(rows, totalQty) {
  const tbody = document.getElementById('tbody-bc2');
  const tfoot = document.getElementById('tfoot-bc2');
  const countBadge = document.getElementById('records-count-bc2');

  if (countBadge) countBadge.textContent = `${rows.length} Dòng Hiển Thị`;
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div style="text-align:center; padding:40px; color:var(--text-muted);">
            <div style="font-size:2rem; margin-bottom:8px;">✅</div>
            <p>Tất cả hàng trong kho đều có HSD an toàn ≥ 60%.</p>
          </div>
        </td>
      </tr>`;
    tfoot.innerHTML = '';
    return;
  }

  rows.forEach((row, idx) => {
    const pct = parseFloat(getSafeValue(row, ['(%) HSD'])) || 0;
    // Màu cảnh báo theo mức %HSD còn lại
    let urgencyClass = '';
    if (pct < 20)      urgencyClass = 'hsd-critical'; // Ngưỡng đỏ: rất nguy cấp
    else if (pct < 40) urgencyClass = 'hsd-danger';   // Cam: nguy hiểm
    else               urgencyClass = 'hsd-warn-row';  // Vàng: cảnh báo

    const maKho = getSafeValue(row, ['MÃ KHO']) || '';
    const maHang = getSafeValue(row, ['MÃ HÀNG']) || '';
    const tenHang = getSafeValue(row, ['TÊN HÀNG']) || '';
    const dvt = getSafeValue(row, ['ĐƠN VỊ TÌNH']) || '';
    const nsx = getSafeValue(row, ['NSX']) || '';
    const hsd = getSafeValue(row, ['HSD']) || '';
    const conLai = getSafeValue(row, ['SỐ NGÀY CÒN LẠI']) !== undefined ? getSafeValue(row, ['SỐ NGÀY CÒN LẠI']) : '';
    const qty = parseFloat(getSafeValue(row, ['SỐ LƯỢNG'])) || 0;
    const pctDisplay = pct.toFixed(1) + '%';

    const tr = document.createElement('tr');
    tr.className = urgencyClass;
    tr.innerHTML = `
      <td class="text-center">${idx + 1}</td>
      <td><strong>${escapeHtml(maKho)}</strong></td>
      <td><code style="color:var(--accent-blue);font-weight:700;">${escapeHtml(maHang)}</code></td>
      <td>${escapeHtml(tenHang)}</td>
      <td class="text-right"><strong>${formatNumber(qty)}</strong></td>
      <td class="text-center">${escapeHtml(nsx)}</td>
      <td class="text-center">${escapeHtml(hsd)}</td>
      <td class="text-center"><strong>${conLai}</strong> ngày</td>
      <td class="text-center">
        <span class="hsd-pct-badge ${urgencyClass}-badge">${pctDisplay}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tfoot.innerHTML = `
    <tr>
      <td colspan="4" class="text-right"><strong>TỔNG SỐ LƯỢNG CẦN KIỂM TRA THỰC TẾ</strong></td>
      <td class="text-right"><strong>${formatNumber(totalQty)}</strong></td>
      <td colspan="4"></td>
    </tr>
  `;
}

// ==========================================
// BẢNG TỒN KHO VỊ TRÍ FUNCTION (DATA5)
// ==========================================
function renderBC2FunctionTable() {
  const tbody = document.getElementById('tbody-bc2-function');
  const tfoot = document.getElementById('tfoot-bc2-function');
  const countBadge = document.getElementById('records-count-bc2-function');

  if (!tbody) return;

  const data5 = window.DASHBOARD_DATA ? (window.DASHBOARD_DATA['data5-tồn kho theo PL, ví trí'] || []) : [];

  // Lọc VỊ TRÍ = FUNCTION và theo selectedKho
  let filtered = data5.filter(r => {
    const maKho = getKhoValue(r);
    const passKho = selectedKho.size > 0 ? selectedKho.has(maKho) : true;

    const vt = String(getSafeValue(r, ['VỊ TRÍ']) || '').trim().toUpperCase();
    const passFunc = vt === 'FUNCTION' || vt.includes('FUNC');

    return passKho && passFunc;
  });

  // Tìm kiếm nếu người dùng nhập ô search
  if (searchQueryBC2Function && filtered.length > 0) {
    filtered = filtered.filter(row => {
      const text = [
        getSafeValue(row, ['MÃ KHO']),
        getSafeValue(row, ['MÃ HÀNG']),
        getSafeValue(row, ['TÊN HÀNG']),
        getSafeValue(row, ['VỊ TRÍ']),
        getSafeValue(row, ['ĐƠN VỊ TÍNH'])
      ].join(' ').toLowerCase();
      return text.includes(searchQueryBC2Function);
    });
  }

  // Sắp xếp
  filtered = sortRowsGeneric(filtered, currentSortColumnBC2Function, currentSortOrderBC2Function);

  if (countBadge) countBadge.textContent = `${filtered.length} Dòng Hiển Thị`;
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 24px; color: var(--text-muted);">
          Không có dữ liệu tồn kho hư hỏng phù hợp
        </td>
      </tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  let totalQty = 0;
  let html = '';

  filtered.forEach((r, idx) => {
    const maKho = getKhoValue(r);
    const maHang = getSafeValue(r, ['MÃ HÀNG']) || 'N/A';
    const tenHang = getSafeValue(r, ['TÊN HÀNG']) || '';
    const viTri = getSafeValue(r, ['VỊ TRÍ']) || 'FUNCTION';
    const dvt = getSafeValue(r, ['ĐƠN VỊ TÍNH']) || '';
    const qty = parseFloat(getSafeValue(r, ['SỐ LƯỢNG'])) || 0;

    totalQty += qty;

    html += `
      <tr>
        <td class="text-center" style="font-weight:600; color:var(--text-muted);">${idx + 1}</td>
        <td class="text-center font-bold">${escapeHtml(maKho)}</td>
        <td style="font-weight: 700; color: var(--primary);">${escapeHtml(maHang)}</td>
        <td style="font-size:0.85rem;">${escapeHtml(tenHang)}</td>
        <td class="text-center font-bold"><span class="badge-tag hsd-warn">${escapeHtml(viTri)}</span></td>
        <td class="text-center">${escapeHtml(dvt)}</td>
        <td class="text-right font-bold" style="color: var(--accent-blue);">${qty > 0 ? formatNumber(qty) : '0'}</td>
      </tr>`;
  });

  tbody.innerHTML = html;

  if (tfoot) {
    tfoot.innerHTML = `
      <tr style="background: rgba(0, 0, 0, 0.04); font-weight: bold;">
        <td colspan="6" class="text-right" style="padding-right: 16px; color: var(--primary);">TỔNG SỐ LƯỢNG TỒN KHO HƯ HỎNG:</td>
        <td class="text-right" style="color: var(--primary); font-size: 0.95rem;">${formatNumber(totalQty)}</td>
      </tr>`;
  }
}

function handleSortBC2Function(colName) {
  if (currentSortColumnBC2Function === colName) {
    currentSortOrderBC2Function = currentSortOrderBC2Function === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumnBC2Function = colName;
    currentSortOrderBC2Function = 'asc';
  }
  updateSortIconsBC2Function();
  renderBC2FunctionTable();
}

function updateSortIconsBC2Function() {
  const cols = ['MÃ KHO', 'MÃ HÀNG', 'TÊN HÀNG', 'VỊ TRÍ', 'SỐ LƯỢNG'];
  cols.forEach(col => {
    const iconEl = document.getElementById('sort2func-' + col);
    if (iconEl) {
      if (col === currentSortColumnBC2Function) {
        iconEl.textContent = currentSortOrderBC2Function === 'asc' ? '▲' : '▼';
        iconEl.style.color = 'var(--accent-blue)';
      } else {
        iconEl.textContent = '⇕';
        iconEl.style.color = 'var(--text-muted)';
      }
    }
  });
}






// ═══════════════════════════════════════════════
// BÁO CÁO 4: PHÂN TÍCH NHẬP / XUẤT
// ═══════════════════════════════════════════════


function selectAllBC4Ngay(selectAll = true) {
  if (selectAll) {
    selectedNgayBC4 = new Set(allDatesBC4);
  } else {
    selectedNgayBC4.clear();
  }
  updateFilterTriggerLabels();
  renderBC4();
    if (typeof applyFiltersAndRenderBC5 === 'function') applyFiltersAndRenderBC5();
}

function renderBC4() {
  const bc4Data = (window.DASHBOARD_DATA && window.DASHBOARD_DATA['Append1 Nhập- Xuất']) || [];
  
  if (!bc4Data.length) {
    console.warn('BC4: Không có dữ liệu Append1 Nhập- Xuất');
    return;
  }

  // Cập nhật lại danh sách NPP trong ô Chọn NPP theo các Mã Kho đang được chọn (selectedKho)
  extractAllNppsBC4();


  const filteredRows = bc4Data.filter(function(row) {
    var maKho    = getSafeValue(row, ['MÃ KHO', 'KHO', 'Ma Kho']);
    var maKhoStr = maKho ? String(maKho).trim() : '';

    var ngay    = getSafeValue(row, ['NGÀY']);
    var ngayStr = ngay ? String(ngay).trim() : '';

    var nhomHang    = getSafeValue(row, ['NHÓM HÀNG']);
    var nhomHangStr = nhomHang ? String(nhomHang).trim() : '';

    var c1       = getSafeValue(row, ['TÊN C1', 'TÊN ĐƠN VỊ', 'C1']);
    var c1Str    = c1 ? String(c1).trim() : '';

    // Lọc kho: chỉ lấy kho nằm trong TARGET_KHO_LIST đang được chọn
    var matchKho  = selectedKho.has(maKhoStr);
    // Lọc ngày: riêng cho BC4
    var matchNgay = (selectedNgayBC4.size === 0) || selectedNgayBC4.has(ngayStr);
    // Lọc nhóm hàng: nếu rỗng thì cho qua, nếu có giá trị thì phải khớp
    var matchNhom = (nhomHangStr === '') || selectedNhomHang.has(nhomHangStr);

    return matchKho && matchNgay && matchNhom;
  });

  console.log('BC4 filtered rows:', filteredRows.length, '/', bc4Data.length);

  var nhapXuatNhomHangData = { Nhap: { TP: 0, BB: 0, PL: 0 }, Xuat: { TP: 0, BB: 0, PL: 0 } };
  var nhapXuatDvtData      = { Nhap: { THUNG: 0, KET: 0, CAI: 0 }, Xuat: { THUNG: 0, KET: 0, CAI: 0 } };
  var customerData   = {};
  var topMaHangNhapData = {};
  var topMaHangXuatData = {};

  filteredRows.forEach(function(row) {
    var date      = getSafeValue(row, ['NGÀY']);
    var dateStr   = date ? String(date).trim() : 'Unknown';

    var kho       = getSafeValue(row, ['MÃ KHO', 'KHO']);
    var khoStr    = kho ? String(kho).trim() : 'Unknown';

    var c1        = getSafeValue(row, ['TÊN C1', 'TÊN ĐƠN VỊ']);
    var c1Str     = c1 ? String(c1).trim() : 'Khác';

    var nhom      = getSafeValue(row, ['NHÓM HÀNG']);
    var nhomStr   = nhom ? String(nhom).trim() : 'Khác';

    var loai      = getSafeValue(row, ['Loại hình', 'LOẠI HÌNH']);
    var loaiStr   = loai ? String(loai).toLowerCase().trim() : '';

    var qty = parseFloat(getSafeValue(row, ['SỐ LƯỢNG'])) || 0;
    var pl  = parseFloat(getSafeValue(row, ['SỐ LƯỢNG PL'])) || 0;

    // Chart 1A & 1B: Nhập / Xuất theo Nhóm hàng & ĐVT
    var isNhap = (loaiStr.indexOf('nhập') !== -1 || loaiStr.indexOf('nhap') !== -1);
    var nxType = isNhap ? 'Nhap' : 'Xuat';

    // Nhóm Hàng
    var nhomKey = nhomStr.toUpperCase();
    if (nhapXuatNhomHangData[nxType][nhomKey] !== undefined) {
      nhapXuatNhomHangData[nxType][nhomKey] += qty;
    }

    // Đơn Vị Tính
    var dvtStr = getSafeValue(row, ['ĐƠN VỊ TÍNH', 'ĐVT']);
    var dvt = dvtStr ? String(dvtStr).toUpperCase().trim() : '';
    if (dvt === 'THÙNG' || dvt === 'THUNG') dvt = 'THUNG';
    else if (dvt === 'KÉT' || dvt === 'KET') dvt = 'KET';
    else if (dvt === 'CÁI' || dvt === 'CAI') dvt = 'CAI';

    if (nhapXuatDvtData[nxType][dvt] !== undefined) {
      nhapXuatDvtData[nxType][dvt] += qty;
    }

    // Chart 3: Top Khách hàng
    if (nxType === 'Xuat' && nhomKey === 'TP') {
      if (!customerData[c1Str]) customerData[c1Str] = 0;
      customerData[c1Str] += qty;
    }

    // Chart 4: Mã Hàng Nhập / Xuất (Nhóm Hàng TP)
    var maHang = getSafeValue(row, ['MÃ HÀNG', 'TÊN HÀNG']);
    var maHangStr = maHang ? String(maHang).trim() : 'Unknown';
    if (nhomKey === 'TP') {
        if (nxType === 'Nhap') {
            if (!topMaHangNhapData[maHangStr]) topMaHangNhapData[maHangStr] = 0;
            topMaHangNhapData[maHangStr] += qty;
        } else {
            if (!topMaHangXuatData[maHangStr]) topMaHangXuatData[maHangStr] = 0;
            topMaHangXuatData[maHangStr] += qty;
        }
    }
  });

  bc4DrawChart1A(nhapXuatNhomHangData);
  bc4DrawChart1B(nhapXuatDvtData);
  bc4DrawChart3(customerData);
  bc4DrawChart4A(topMaHangNhapData);
  bc4DrawChart4B(topMaHangXuatData);
  renderBC4Table(filteredRows);
  renderBC4SubTable(filteredRows);
}

function extractAllNppsBC4() {
  const nppSet = new Set();
  const appendSheet = (window.DASHBOARD_DATA && window.DASHBOARD_DATA['Append1 Nhập- Xuất']) || [];
  appendSheet.forEach(row => {
    const maKho = getSafeValue(row, ['MÃ KHO', 'KHO', 'Ma Kho']);
    const maKhoStr = maKho ? String(maKho).trim() : '';

    // Chỉ lấy Tên NPP của các kho đang được tích chọn (selectedKho)
    if (selectedKho.has(maKhoStr)) {
      const c1 = getSafeValue(row, ['TÊN C1', 'TÊN ĐƠN VỊ', 'C1']);
      if (c1 && typeof c1 === 'string' && c1.trim() !== '') {
        nppSet.add(c1.trim());
      }
    }
  });
  allNppBC4 = Array.from(nppSet).sort((a, b) => a.localeCompare(b, 'vi'));
  
  const selectEl = document.getElementById('select-npp-bc4');
  if (selectEl) {
    const prevVal = selectedNppBC4Value;
    selectEl.innerHTML = '<option value="">-- Tất cả NPP --</option>';
    let foundPrev = false;
    allNppBC4.forEach(npp => {
      const opt = document.createElement('option');
      opt.value = npp;
      opt.textContent = npp;
      if (npp === prevVal) {
        opt.selected = true;
        foundPrev = true;
      }
      selectEl.appendChild(opt);
    });

    if (!foundPrev && prevVal !== '') {
      selectedNppBC4Value = '';
      selectEl.value = '';
    }
  }
}

function handleSelectNppBC4(val) {
  selectedNppBC4Value = val ? String(val).trim() : '';
  renderBC4Table();
}

function renderBC4Table(rows) {
  if (rows) currentBC4FilteredRows = rows;
  let filteredRows = currentBC4FilteredRows;

  // Filter by selected NPP if specified
  if (selectedNppBC4Value) {
    filteredRows = filteredRows.filter(row => {
      const c1 = getSafeValue(row, ['TÊN C1', 'TÊN ĐƠN VỊ', 'C1']);
      const c1Str = c1 ? String(c1).trim() : '';
      return c1Str === selectedNppBC4Value;
    });
  }

  // Aggregate by MÃ HÀNG
  const mapMaHang = {};
  filteredRows.forEach(row => {
    const maHang = getSafeValue(row, ['MÃ HÀNG', 'Mã Hàng']) || 'Chưa rõ';
    const maHangStr = String(maHang).trim();
    const tenHang = getSafeValue(row, ['TÊN HÀNG', 'Tên Hàng', 'MÃ HÀNG']) || maHangStr;
    const loai = getSafeValue(row, ['Loại hình', 'LOẠI HÌNH', 'LOẠI GIAO DỊCH']) || '';
    const loaiStr = String(loai).toLowerCase().trim();
    const qty = parseFloat(getSafeValue(row, ['SỐ LƯỢNG', 'SL'])) || 0;
    const isNhap = (loaiStr.indexOf('nhập') !== -1 || loaiStr.indexOf('nhap') !== -1);

    if (!mapMaHang[maHangStr]) {
      mapMaHang[maHangStr] = {
        maHang: maHangStr,
        tenHang: String(tenHang).trim(),
        nhapQty: 0,
        xuatQty: 0
      };
    }
    if (isNhap) {
      mapMaHang[maHangStr].nhapQty += qty;
    } else {
      mapMaHang[maHangStr].xuatQty += qty;
    }
  });

  let aggregatedList = Object.values(mapMaHang);

  // Search filter
  if (searchQueryBC4) {
    aggregatedList = aggregatedList.filter(item => {
      const q = searchQueryBC4.toLowerCase();
      return item.maHang.toLowerCase().includes(q) || item.tenHang.toLowerCase().includes(q);
    });
  }

  // Sorting
  aggregatedList.sort((a, b) => {
    let valA = a.maHang;
    let valB = b.maHang;
    if (currentSortColumnBC4 === 'TÊN HÀNG') {
      valA = a.tenHang; valB = b.tenHang;
    } else if (currentSortColumnBC4 === 'SL NHẬP') {
      valA = a.nhapQty; valB = b.nhapQty;
    } else if (currentSortColumnBC4 === 'SL XUẤT') {
      valA = a.xuatQty; valB = b.xuatQty;
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return currentSortOrderBC4 === 'asc' ? valA - valB : valB - valA;
    }
    return currentSortOrderBC4 === 'asc' 
      ? String(valA).localeCompare(String(valB), 'vi') 
      : String(valB).localeCompare(String(valA), 'vi');
  });

  // DOM update
  const tbody = document.getElementById('tbody-bc4');
  const tfoot = document.getElementById('tfoot-bc4');
  const recordsCount = document.getElementById('records-count-bc4');

  if (recordsCount) recordsCount.textContent = `${aggregatedList.length} Mã Hàng`;

  if (!tbody) return;
  tbody.innerHTML = '';

  if (aggregatedList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: var(--text-muted);">Không tìm thấy dữ liệu phù hợp với bộ lọc</td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  let totalNhap = 0;
  let totalXuat = 0;

  aggregatedList.forEach((item, index) => {
    totalNhap += item.nhapQty;
    totalXuat += item.xuatQty;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center" style="color: var(--text-muted); font-size: 0.82rem;">${index + 1}</td>
      <td style="font-weight: 600; color: var(--primary);">${item.maHang}</td>
      <td style="color: var(--text-dark);">${item.tenHang}</td>
      <td class="text-right" style="font-weight: 600; color: #2563eb;">${item.nhapQty ? Math.round(item.nhapQty).toLocaleString('vi-VN') : '-'}</td>
      <td class="text-right" style="font-weight: 600; color: #d97706;">${item.xuatQty ? Math.round(item.xuatQty).toLocaleString('vi-VN') : '-'}</td>
    `;
    tbody.appendChild(tr);
  });

  if (tfoot) {
    tfoot.innerHTML = `
      <tr style="background: rgba(37,99,235,0.06); font-weight: 700;">
        <td colspan="3" class="text-right" style="padding: 10px 12px; color: var(--text-dark);">TỔNG CỘNG:</td>
        <td class="text-right" style="padding: 10px 12px; color: #2563eb; font-size: 0.95rem;">${Math.round(totalNhap).toLocaleString('vi-VN')}</td>
        <td class="text-right" style="padding: 10px 12px; color: #d97706; font-size: 0.95rem;">${Math.round(totalXuat).toLocaleString('vi-VN')}</td>
      </tr>
    `;
  }
}

function handleSortBC4(column) {
  if (currentSortColumnBC4 === column) {
    currentSortOrderBC4 = currentSortOrderBC4 === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumnBC4 = column;
    currentSortOrderBC4 = 'asc';
  }

  ['MÃ HÀNG', 'TÊN HÀNG', 'SL NHẬP', 'SL XUẤT'].forEach(col => {
    const el = document.getElementById(`sort4-${col}`);
    if (el) {
      if (col === currentSortColumnBC4) {
        el.textContent = currentSortOrderBC4 === 'asc' ? '▲' : '▼';
        el.style.color = 'var(--primary)';
      } else {
        el.textContent = '↕';
        el.style.color = 'var(--text-muted)';
      }
    }
  });

  renderBC4Table();
}

// ── BẢNG CHI TIẾT GIAO DỊCH (LOẠI GIAO DỊCH 21035 & 29011) ─────────────────
var searchQueryBC4Sub = '';
var currentSortColumnBC4Sub = 'KHO 1-1';
var currentSortOrderBC4Sub = 'asc';
var currentBC4SubFilteredRows = [];

function handleSearchBC4Sub(val) {
  searchQueryBC4Sub = val ? String(val).toLowerCase().trim() : '';
  renderBC4SubTable();
}

function handleSortBC4Sub(column) {
  if (currentSortColumnBC4Sub === column) {
    currentSortOrderBC4Sub = currentSortOrderBC4Sub === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumnBC4Sub = column;
    currentSortOrderBC4Sub = 'asc';
  }

  ['KHO 1-1', 'SỐ XE', 'MÃ HÀNG', 'SL NHẬP', 'SL XUẤT'].forEach(col => {
    const el = document.getElementById(`sort4sub-${col}`);
    if (el) {
      if (col === currentSortColumnBC4Sub) {
        el.textContent = currentSortOrderBC4Sub === 'asc' ? '▲' : '▼';
        el.style.color = 'var(--primary)';
      } else {
        el.textContent = '↕';
        el.style.color = 'var(--text-muted)';
      }
    }
  });

  renderBC4SubTable();
}

function renderBC4SubTable(rows) {
  if (rows) currentBC4SubFilteredRows = rows;
  let filteredRows = currentBC4SubFilteredRows || [];

  // Bộ lọc mặc định luôn lấy 2 giá trị LOẠI GIAO DỊCH (21035 và 29011)
  filteredRows = filteredRows.filter(row => {
    const loaiGD = getSafeValue(row, ['LOẠI GIAO DỊCH', 'Loại giao dịch']) || '';
    const loaiGDStr = String(loaiGD);
    return loaiGDStr.includes('21035') || loaiGDStr.includes('29011');
  });

  // Gom nhóm theo [KHO 1-1] + [SỐ XE] + [MÃ HÀNG]
  const mapGroup = {};
  filteredRows.forEach(row => {
    const kho11 = getSafeValue(row, ['KHO 1-1', 'KHO1-1']) || getSafeValue(row, ['TÊN KHO']) || getSafeValue(row, ['MÃ KHO']) || 'Khác';
    const kho11Str = String(kho11).trim();
    const soXe = getSafeValue(row, ['SỐ XE', 'Số xe']) || 'Chưa rõ';
    const soXeStr = String(soXe).trim();
    const maHang = getSafeValue(row, ['MÃ HÀNG', 'Mã Hàng']) || 'Chưa rõ';
    const maHangStr = String(maHang).trim();

    const key = kho11Str + '||' + soXeStr + '||' + maHangStr;

    const loai = getSafeValue(row, ['Loại hình', 'LOẠI HÌNH', 'LOẠI GIAO DỊCH']) || '';
    const loaiStr = String(loai).toLowerCase().trim();
    const qty = parseFloat(getSafeValue(row, ['SỐ LƯỢNG', 'SL'])) || 0;
    const isNhap = (loaiStr.indexOf('nhập') !== -1 || loaiStr.indexOf('nhap') !== -1);

    if (!mapGroup[key]) {
      mapGroup[key] = {
        kho11: kho11Str,
        soXe: soXeStr,
        maHang: maHangStr,
        nhapQty: 0,
        xuatQty: 0
      };
    }

    if (isNhap) {
      mapGroup[key].nhapQty += qty;
    } else {
      mapGroup[key].xuatQty += qty;
    }
  });

  let aggregatedList = Object.values(mapGroup);

  // Lọc từ khóa tìm kiếm
  if (searchQueryBC4Sub) {
    aggregatedList = aggregatedList.filter(item => {
      const q = searchQueryBC4Sub;
      return item.kho11.toLowerCase().includes(q) ||
             item.soXe.toLowerCase().includes(q) ||
             item.maHang.toLowerCase().includes(q);
    });
  }

  // Sắp xếp đa cấp (Mặc định: KHO 1-1 -> SỐ XE -> MÃ HÀNG)
  aggregatedList.sort((a, b) => {
    if (currentSortColumnBC4Sub === 'KHO 1-1') {
      const cmpKho = String(a.kho11).localeCompare(String(b.kho11), 'vi');
      if (cmpKho !== 0) return currentSortOrderBC4Sub === 'asc' ? cmpKho : -cmpKho;

      const cmpXe = String(a.soXe).localeCompare(String(b.soXe), 'vi');
      if (cmpXe !== 0) return currentSortOrderBC4Sub === 'asc' ? cmpXe : -cmpXe;

      const cmpHang = String(a.maHang).localeCompare(String(b.maHang), 'vi');
      return currentSortOrderBC4Sub === 'asc' ? cmpHang : -cmpHang;
    }

    if (currentSortColumnBC4Sub === 'SỐ XE') {
      const cmpXe = String(a.soXe).localeCompare(String(b.soXe), 'vi');
      if (cmpXe !== 0) return currentSortOrderBC4Sub === 'asc' ? cmpXe : -cmpXe;

      const cmpKho = String(a.kho11).localeCompare(String(b.kho11), 'vi');
      if (cmpKho !== 0) return currentSortOrderBC4Sub === 'asc' ? cmpKho : -cmpKho;

      const cmpHang = String(a.maHang).localeCompare(String(b.maHang), 'vi');
      return currentSortOrderBC4Sub === 'asc' ? cmpHang : -cmpHang;
    }

    if (currentSortColumnBC4Sub === 'MÃ HÀNG') {
      const cmpHang = String(a.maHang).localeCompare(String(b.maHang), 'vi');
      if (cmpHang !== 0) return currentSortOrderBC4Sub === 'asc' ? cmpHang : -cmpHang;

      const cmpKho = String(a.kho11).localeCompare(String(b.kho11), 'vi');
      if (cmpKho !== 0) return currentSortOrderBC4Sub === 'asc' ? cmpKho : -cmpKho;

      const cmpXe = String(a.soXe).localeCompare(String(b.soXe), 'vi');
      return currentSortOrderBC4Sub === 'asc' ? cmpXe : -cmpXe;
    }

    if (currentSortColumnBC4Sub === 'SL NHẬP') {
      const diff = a.nhapQty - b.nhapQty;
      if (diff !== 0) return currentSortOrderBC4Sub === 'asc' ? diff : -diff;
      return String(a.kho11).localeCompare(String(b.kho11), 'vi');
    }

    if (currentSortColumnBC4Sub === 'SL XUẤT') {
      const diff = a.xuatQty - b.xuatQty;
      if (diff !== 0) return currentSortOrderBC4Sub === 'asc' ? diff : -diff;
      return String(a.kho11).localeCompare(String(b.kho11), 'vi');
    }

    return 0;
  });

  // Hiển thị DOM
  const tbody = document.getElementById('tbody-bc4-sub');
  const tfoot = document.getElementById('tfoot-bc4-sub');
  const recordsCount = document.getElementById('records-count-bc4-sub');

  if (recordsCount) recordsCount.textContent = `${aggregatedList.length} Dòng`;

  if (!tbody) return;
  tbody.innerHTML = '';

  if (aggregatedList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px; color: var(--text-muted);">Không tìm thấy dữ liệu giao dịch (21035 / 29011) phù hợp với bộ lọc</td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  let totalNhap = 0;
  let totalXuat = 0;

  aggregatedList.forEach((item, index) => {
    totalNhap += item.nhapQty;
    totalXuat += item.xuatQty;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center" style="color: var(--text-muted); font-size: 0.82rem;">${index + 1}</td>
      <td style="font-weight: 600; color: #0284c7;">${item.kho11}</td>
      <td style="font-weight: 600; color: var(--text-dark);">${item.soXe}</td>
      <td style="font-weight: 600; color: var(--primary);">${item.maHang}</td>
      <td class="text-right" style="font-weight: 600; color: #2563eb;">${item.nhapQty ? Math.round(item.nhapQty).toLocaleString('vi-VN') : '-'}</td>
      <td class="text-right" style="font-weight: 600; color: #d97706;">${item.xuatQty ? Math.round(item.xuatQty).toLocaleString('vi-VN') : '-'}</td>
    `;
    tbody.appendChild(tr);
  });

  if (tfoot) {
    tfoot.innerHTML = `
      <tr style="background: rgba(37,99,235,0.06); font-weight: 700;">
        <td colspan="4" class="text-right" style="padding: 10px 12px; color: var(--text-dark);">TỔNG CỘNG:</td>
        <td class="text-right" style="padding: 10px 12px; color: #2563eb; font-size: 0.95rem;">${Math.round(totalNhap).toLocaleString('vi-VN')}</td>
        <td class="text-right" style="padding: 10px 12px; color: #d97706; font-size: 0.95rem;">${Math.round(totalXuat).toLocaleString('vi-VN')}</td>
      </tr>
    `;
  }
}

// ── Chart helpers ─────────────────────────────

function bc4GetOrCreate(chartId, config) {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js chưa được tải!');
    return;
  }
  var ctx = document.getElementById(chartId);
  if (!ctx) {
    console.error('Canvas không tìm thấy:', chartId);
    return;
  }
  if (bc4Charts[chartId]) {
    bc4Charts[chartId].destroy();
    delete bc4Charts[chartId];
  }
  try {
    bc4Charts[chartId] = new Chart(ctx, config);
  } catch(e) {
    console.error('Lỗi tạo chart', chartId, e);
  }
}

var BC4_COLORS = ['#3b82f6','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4','#ec4899'];
var BC4_GRID   = { color: 'rgba(0,0,0,0.07)' };
var BC4_TICK   = { color: '#475569', font: { size: 10 } };

function bc4Fmt(v) {
  if (!v || v === 0) return '';
  return Math.round(v).toLocaleString('vi-VN');
}

// ─── Chart 1A: Nhập/Xuất Theo Nhóm Hàng ────────────────────────────────────
function bc4DrawChart1A(data) {
  var labels = ['Nhập', 'Xuất'];
  var datalabelsPlugin = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];
  
  var dsTP = { label: 'TP', backgroundColor: '#3b82f6', data: [data.Nhap.TP, data.Xuat.TP] };
  var dsBB = { label: 'BB', backgroundColor: '#ef4444', data: [data.Nhap.BB, data.Xuat.BB] };
  var dsPL = { label: 'PL', backgroundColor: '#84cc16', data: [data.Nhap.PL, data.Xuat.PL] };

  bc4GetOrCreate('chart-nhapxuat-nhomhang', {
    type: 'bar',
    plugins: datalabelsPlugin,
    data: {
      labels: labels,
      datasets: [dsTP, dsBB, dsPL]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 25 } },
      plugins: {
        legend: { position: 'right', labels: { color: '#334155', font: { size: 11 } } },
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'top',
          color: '#334155',
          font: { size: 10, weight: 'bold' },
          formatter: function(v) { return bc4Fmt(v); }
        }
      },
      scales: {
        x: { ticks: BC4_TICK, grid: { display: false } },
        y: { ticks: BC4_TICK, grid: BC4_GRID, beginAtZero: true, grace: '15%' }
      }
    }
  });
}

// ─── Chart 1B: Nhập/Xuất Theo Đơn Vị Tính ──────────────────────────────────
function bc4DrawChart1B(data) {
  var labels = ['Nhập', 'Xuất'];
  var datalabelsPlugin = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];
  
  var dsThung = { label: 'THUNG', backgroundColor: '#3b82f6', data: [data.Nhap.THUNG, data.Xuat.THUNG] };
  var dsKet   = { label: 'KET', backgroundColor: '#ef4444', data: [data.Nhap.KET, data.Xuat.KET] };
  var dsCai   = { label: 'CAI', backgroundColor: '#84cc16', data: [data.Nhap.CAI, data.Xuat.CAI] };

  bc4GetOrCreate('chart-nhapxuat-dvt', {
    type: 'bar',
    plugins: datalabelsPlugin,
    data: {
      labels: labels,
      datasets: [dsThung, dsKet, dsCai]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 25 } },
      plugins: {
        legend: { position: 'right', labels: { color: '#334155', font: { size: 11 } } },
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'top',
          color: '#334155',
          font: { size: 10, weight: 'bold' },
          formatter: function(v) { return bc4Fmt(v); }
        }
      },
      scales: {
        x: { ticks: BC4_TICK, grid: { display: false } },
        y: { ticks: BC4_TICK, grid: BC4_GRID, beginAtZero: true, grace: '15%' }
      }
    }
  });
}

// ─── Chart 2: Bar Kho Volume (HALF) ────────────────────────────────────────
function bc4DrawChart2(data) {
  var entries = Object.entries(data).sort(function(a,b){ return b[1]-a[1]; });
  if (!entries.length) { console.warn('Chart2: no data'); return; }

  var datalabelsPlugin = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];

  bc4GetOrCreate('chart-multi-line', {
    type: 'bar',
    plugins: datalabelsPlugin,
    data: {
      labels: entries.map(function(e){ return e[0]; }),
      datasets: [{
        label: 'Tổng SL',
        data: entries.map(function(e){ return e[1]; }),
        backgroundColor: BC4_COLORS,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true,
          color: '#334155',
          anchor: 'end',
          align: 'top',
          font: { size: 10, weight: 'bold' },
          formatter: function(v) { return bc4Fmt(v); }
        }
      },
      scales: {
        x: { ticks: BC4_TICK, grid: BC4_GRID },
        y: { ticks: BC4_TICK, grid: BC4_GRID }
      }
    }
  });
}

// ─── Chart 3: Horizontal Bar Top 10 Khách hàng (FULL WIDTH) ─────────────────
function bc4DrawChart3(data) {
  var sorted = Object.entries(data).sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);
  if (!sorted.length) { console.warn('Chart3: no data'); return; }

  var datalabelsPlugin = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];

  bc4GetOrCreate('chart-horizontal-bar', {
    type: 'bar',
    plugins: datalabelsPlugin,
    data: {
      labels: sorted.map(function(i){ var s = i[0]; return s.length > 38 ? s.substring(0,38)+'…' : s; }),
      datasets: [{
        label: 'Số Lượng',
        data: sorted.map(function(i){ return i[1]; }),
        backgroundColor: BC4_COLORS,
        borderRadius: 3
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true,
          color: '#fff',
          anchor: 'end',
          align: 'left',
          font: { size: 10, weight: 'bold' },
          formatter: function(v) { return bc4Fmt(v); }
        }
      },
      scales: {
        x: { ticks: BC4_TICK, grid: BC4_GRID },
        y: { ticks: { color: '#475569', font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ─── Chart 4: Doughnut Nhóm Hàng (HALF) ───────────────────────────────────
function bc4DrawChart4(data) {
  var labels = Object.keys(data);
  var values = Object.values(data);
  if (!labels.length) { console.warn('Chart4: no data'); return; }

  var total = values.reduce(function(s,v){ return s+v; }, 0);
  var datalabelsPlugin = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];

  bc4GetOrCreate('chart-doughnut', {
    type: 'doughnut',
    plugins: datalabelsPlugin,
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: BC4_COLORS,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#334155', font: { size: 11 }, padding: 14 } },
        datalabels: {
          display: true,
          color: '#fff',
          font: { size: 11, weight: 'bold' },
          formatter: function(v, ctx) {
            var pct = ((v/total)*100).toFixed(0);
            return pct + '%';
          }
        }
      }
    }
  });
}

// ─── Chart 5: Scatter Tương quan SL & Pallet (HALF) ───────────────────────
function bc4DrawChart5(data) {
  if (!data.length) { console.warn('Chart5: no data'); return; }

  // Scatter does NOT use datalabels (too many points)
  bc4GetOrCreate('chart-combo', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Giao dịch',
        data: data,
        backgroundColor: 'rgba(59,130,246,0.5)',
        borderColor: '#3b82f6',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { display: false }
      },
      scales: {
        x: { title: { display: true, text: 'Số Lượng', color: '#64748b', font:{size:10} }, ticks: BC4_TICK, grid: BC4_GRID },
        y: { title: { display: true, text: 'Số Pallet', color: '#64748b', font:{size:10} }, ticks: BC4_TICK, grid: BC4_GRID }
      }
    }
  });
}



// ─── Chart 4A: Top 5 Mã Hàng Nhập ─────────────────────────────────────
function bc4DrawChart4A(data) {
  var sorted = Object.entries(data).sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);
  if (!sorted.length) { console.warn('Chart4A: no data'); return; }
  
  var datalabelsPlugin = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];
  
  bc4GetOrCreate('chart-top-mahang-nhap', {
    type: 'bar',
    plugins: datalabelsPlugin,
    data: {
      labels: sorted.map(function(i){ var s = i[0]; return s.length > 25 ? s.substring(0,25)+'…' : s; }),
      datasets: [{
        label: 'Số Lượng Nhập',
        data: sorted.map(function(i){ return i[1]; }),
        backgroundColor: '#3b82f6',
        borderRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 25 } },
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true,
          color: '#334155',
          anchor: 'end',
          align: 'top',
          font: { size: 10, weight: 'bold' },
          formatter: function(v) { return bc4Fmt(v); }
        }
      },
      scales: {
        x: { ticks: BC4_TICK, grid: { display: false } },
        y: { ticks: BC4_TICK, grid: BC4_GRID, beginAtZero: true, grace: '15%' }
      }
    }
  });
}

// ─── Chart 4B: Top 5 Mã Hàng Xuất ─────────────────────────────────────
function bc4DrawChart4B(data) {
  var sorted = Object.entries(data).sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);
  if (!sorted.length) { console.warn('Chart4B: no data'); return; }
  
  var datalabelsPlugin = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];
  
  bc4GetOrCreate('chart-top-mahang-xuat', {
    type: 'bar',
    plugins: datalabelsPlugin,
    data: {
      labels: sorted.map(function(i){ var s = i[0]; return s.length > 25 ? s.substring(0,25)+'…' : s; }),
      datasets: [{
        label: 'Số Lượng Xuất',
        data: sorted.map(function(i){ return i[1]; }),
        backgroundColor: '#f59e0b',
        borderRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 25 } },
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true,
          color: '#334155',
          anchor: 'end',
          align: 'top',
          font: { size: 10, weight: 'bold' },
          formatter: function(v) { return bc4Fmt(v); }
        }
      },
      scales: {
        x: { ticks: BC4_TICK, grid: { display: false } },
        y: { ticks: BC4_TICK, grid: BC4_GRID, beginAtZero: true, grace: '15%' }
      }
    }
  });
}





// =========================================================
// BÁO CÁO 5 (TỒN KHO) LOGIC
// =========================================================

function applyFiltersAndRenderBC5() {
  renderBC5GlobalCharts(rawDataBC5);
  renderBC5Table(rawDataBC5);
}

let bc5Charts = {};
function bc5GetOrCreate(canvasId, config) {
  if (bc5Charts[canvasId]) {
    bc5Charts[canvasId].destroy();
  }
  var ctx = document.getElementById(canvasId).getContext('2d');
  bc5Charts[canvasId] = new Chart(ctx, config);
}

function renderBC5GlobalCharts(data) {
  var khoData = {};
  var mahangData = { TP: {}, BB: {} };

  data.forEach(function(row) {
    var nhomHang = getSafeValue(row, ['NHÓM HÀNG']);
    var nhomHangStr = nhomHang ? String(nhomHang).trim() : 'Unknown';
    if (selectedNhomHang.size > 0 && !selectedNhomHang.has(nhomHangStr)) return;

    // Ngay filter isn't directly matching "NGÀY" column in data7, because data7 has "THỜI ĐIỂM TẠO".
    // We can filter by selectedNgay if needed, but data7 is "Tồn kho theo ngày", maybe we just use the latest?
    var ngay = getSafeValue(row, ['THỜI ĐIỂM TẠO', 'NGÀY']);
    var ngayStr = ngay ? String(ngay).trim() : '';
    if (ngayStr && selectedNgayBC4.size > 0 && !selectedNgayBC4.has(ngayStr)) return;

    var kho = getSafeValue(row, ['MÃ KHO', 'KHO', 'Ma Kho']);
    var khoStr = kho ? String(kho).trim() : 'Unknown';
    if (selectedKho.size > 0 && !selectedKho.has(khoStr)) return;

    var gui = Number(getSafeValue(row, ['TỔNG GỬI'])) || 0;
    var ban = Number(getSafeValue(row, ['SỐ LƯỢNG BÁN ĐƯỢC'])) || 0;
    var ton = Number(getSafeValue(row, ['TỒN THỰC TẾ'])) || 0;
    var maHang = getSafeValue(row, ['MÃ HÀNG']) || 'Unknown';

    // Aggregate by Kho
    if (!khoData[khoStr]) khoData[khoStr] = { gui: 0, ban: 0, ton: 0, palletGui: 0, palletTon: 0 };
    khoData[khoStr].gui += gui;
    khoData[khoStr].ban += ban;
    khoData[khoStr].ton += ton;
    khoData[khoStr].palletGui += Number(getSafeValue(row, ['Pallet Hang gửi', 'Pallet Hàng gửi', 'Pallet Hàng Gửi'])) || 0;
    khoData[khoStr].palletTon += Number(getSafeValue(row, ['Pallet Hàng Tồn', 'Pallet Hàng tồn', 'Pallet Hàng TỒN'])) || 0;

    // Aggregate by Ma Hang (TP and BB)
    if (nhomHangStr === 'TP' || nhomHangStr === 'BB') {
      if (!mahangData[nhomHangStr][maHang]) mahangData[nhomHangStr][maHang] = 0;
      mahangData[nhomHangStr][maHang] += ton;
    }
  });

  var datalabelsPlugin = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];
  var chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { family: "'Inter', sans-serif" } } },
      datalabels: {
        color: '#fff',
        font: { weight: 'bold', size: 10 },
        formatter: function(val) { return val > 0 ? val.toLocaleString() : ''; }
      }
    }
  };

  // Chart 1: Kho Stacked
  var khos = Array.from(selectedKho).sort();
  if (khos.length === 0) khos = Object.keys(khoData).sort();
  var guiKho = khos.map(k => khoData[k] ? khoData[k].gui : 0);
  var banKho = khos.map(k => khoData[k] ? khoData[k].ban : 0);
  var tonKho = khos.map(k => khoData[k] ? khoData[k].ton : 0);

  bc5GetOrCreate('chart-bc5-kho', {
    type: 'bar',
    plugins: datalabelsPlugin,
    data: {
      labels: khos,
      datasets: [
        { label: 'Tổng Gửi', data: guiKho, backgroundColor: '#3b82f6', stack: 'Stack 0' },
        { label: 'Bán Được', data: banKho, backgroundColor: '#f59e0b', stack: 'Stack 0' },
        { label: 'Tồn Thực Tế (Tổng)', data: tonKho, type: 'line', borderColor: '#10b981', backgroundColor: '#10b981', fill: false, tension: 0.1, datalabels: { align: 'top', anchor: 'end', color: '#10b981' } }
      ]
    },
    options: Object.assign({}, chartOptions, {
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, grace: '15%' }
      }
    })
  });

  // Chart 2: Top 5 TP
  var tpArr = Object.keys(mahangData.TP).map(k => ({ ma: k, ton: mahangData.TP[k] }));
  tpArr.sort((a,b) => b.ton - a.ton);
  var top5TP = tpArr.slice(0, 5);
  bc5GetOrCreate('chart-bc5-top-tp', {
    type: 'bar',
    plugins: datalabelsPlugin,
    data: {
      labels: top5TP.map(x => x.ma),
      datasets: [{ label: 'Tồn Kho (TP)', data: top5TP.map(x => x.ton), backgroundColor: '#8b5cf6' }]
    },
    options: Object.assign({}, chartOptions, { indexAxis: 'y' })
  });

  // Chart 3: Top 5 TP Ít Nhất
  var tpArrMin = Object.keys(mahangData.TP).map(k => ({ ma: k, ton: mahangData.TP[k] }));
  tpArrMin.sort((a,b) => a.ton - b.ton);
  var bottom5TP = tpArrMin.slice(0, 5);
  bc5GetOrCreate('chart-bc5-bottom-tp', {
    type: 'bar',
    plugins: datalabelsPlugin,
    data: {
      labels: bottom5TP.map(x => x.ma),
      datasets: [{ label: 'Tồn Kho (TP - Ít Nhất)', data: bottom5TP.map(x => x.ton), backgroundColor: '#10b981' }]
    },
    options: Object.assign({}, chartOptions, { indexAxis: 'y' })
  });

  // Chart 4: So Sánh Pallet & Tỷ Lệ % (Grouped Bar + Line Combo Chart with Dual Y-Axis)
  var palletGuiKho = khos.map(k => khoData[k] ? khoData[k].palletGui : 0);
  var palletTonKho = khos.map(k => khoData[k] ? khoData[k].palletTon : 0);
  var palletRatioKho = khos.map(k => {
    var gui = khoData[k] ? khoData[k].palletGui : 0;
    var ton = khoData[k] ? khoData[k].palletTon : 0;
    return ton > 0 ? Math.round((gui / ton) * 1000) / 10 : 0;
  });

  bc5GetOrCreate('chart-bc5-pallet', {
    type: 'bar',
    plugins: datalabelsPlugin,
    data: {
      labels: khos,
      datasets: [
        {
          label: 'Tồn Hàng Gửi (Quy Pallet)',
          data: palletGuiKho,
          backgroundColor: '#f59e0b',
          yAxisID: 'y',
          borderRadius: 4,
          datalabels: {
            color: '#ffffff',
            anchor: 'center',
            align: 'center',
            font: { weight: 'bold', size: 10 },
            formatter: function(val) { return val > 0 ? Math.round(val).toLocaleString('vi-VN') : ''; }
          }
        },
        {
          label: 'Tồn Thực Tế (Quy Pallet)',
          data: palletTonKho,
          backgroundColor: '#3b82f6',
          yAxisID: 'y',
          borderRadius: 4,
          datalabels: {
            color: '#ffffff',
            anchor: 'center',
            align: 'center',
            font: { weight: 'bold', size: 10 },
            formatter: function(val) { return val > 0 ? Math.round(val).toLocaleString('vi-VN') : ''; }
          }
        },
        {
          label: 'Tỷ Lệ Tồn Gửi / Tồn Thực Tế (%)',
          data: palletRatioKho,
          type: 'line',
          yAxisID: 'y1',
          borderColor: '#ef4444',
          backgroundColor: '#ef4444',
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
          fill: false,
          tension: 0.2,
          datalabels: {
            color: '#dc2626',
            anchor: 'end',
            align: 'top',
            offset: 4,
            font: { weight: 'bold', size: 11 },
            formatter: function(val) { return val > 0 ? val + '%' : ''; }
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: "'Inter', sans-serif" } } },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              if (ctx.dataset.type === 'line') {
                return ctx.dataset.label + ': ' + ctx.raw + '%';
              }
              return ctx.dataset.label + ': ' + Math.round(ctx.raw).toLocaleString('vi-VN') + ' Pallet';
            }
          }
        }
      },
      scales: {
        x: { stacked: false, grid: { display: false } },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          stacked: false,
          beginAtZero: true,
          grace: '15%',
          title: { display: true, text: 'Số Pallet', color: '#475569', font: { size: 11, weight: '600' } },
          ticks: { color: '#475569', font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          stacked: false,
          beginAtZero: true,
          grace: '20%',
          title: { display: true, text: 'Tỷ Lệ (%)', color: '#dc2626', font: { size: 11, weight: '600' } },
          ticks: {
            color: '#dc2626',
            font: { size: 10, weight: '600' },
            callback: function(value) { return value + '%'; }
          },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function renderBC5Table(data) {
  var tbody = document.getElementById('tbody-bc5');
  if (!tbody) return;
  tbody.innerHTML = '';
  var count = 0;
  
  // Apply filters
  var filtered = data.filter(function(row) {
    var nhomHang = getSafeValue(row, ['NHÓM HÀNG']);
    var nhomHangStr = nhomHang ? String(nhomHang).trim() : 'Unknown';
    if (selectedNhomHang.size > 0 && !selectedNhomHang.has(nhomHangStr)) return false;

    var ngay = getSafeValue(row, ['THỜI ĐIỂM TẠO', 'NGÀY']);
    var ngayStr = ngay ? String(ngay).trim() : '';
    if (ngayStr && selectedNgayBC4.size > 0 && !selectedNgayBC4.has(ngayStr)) return false;

    var kho = getSafeValue(row, ['MÃ KHO', 'KHO', 'Ma Kho']);
    var khoStr = kho ? String(kho).trim() : 'Unknown';
    if (selectedKho.size > 0 && !selectedKho.has(khoStr)) return false;

    if (searchQueryBC5) {
      var rowText = [
        khoStr,
        nhomHangStr,
        getSafeValue(row, ['MÃ HÀNG']),
        getSafeValue(row, ['TÊN HÀNG'])
      ].join(' ').toLowerCase();
      if (rowText.indexOf(searchQueryBC5) === -1) return false;
    }
    return true;
  });

  // Sort
  filtered.sort(function(a, b) {
    var getVal = function(r) {
      switch(currentSortColumnBC5) {
        case 'MÃ KHO': return String(getSafeValue(r, ['MÃ KHO']) || '');
        case 'NHÓM HÀNG': return String(getSafeValue(r, ['NHÓM HÀNG']) || '').toLowerCase();
        case 'MÃ HÀNG': return String(getSafeValue(r, ['MÃ HÀNG']) || '').toLowerCase();
        case 'ĐVT': return String(getSafeValue(r, ['ĐƠN VỊ TÍNH', 'ĐVT']) || '').toLowerCase();
        case 'TỔNG GỬI': return Number(getSafeValue(r, ['TỔNG GỬI'])) || 0;
        case 'BÁN ĐƯỢC': return Number(getSafeValue(r, ['SỐ LƯỢNG BÁN ĐƯỢC'])) || 0;
        case 'TỒN THỰC TẾ': return Number(getSafeValue(r, ['TỒN THỰC TẾ'])) || 0;
        default: return 0;
      }
    };
    var valA = getVal(a);
    var valB = getVal(b);
    
    if (currentSortColumnBC5 === 'MÃ KHO') {
      const ORDER = ["052", "05NT", "05KH", "SKH"];
      let ia = ORDER.indexOf(valA);
      let ib = ORDER.indexOf(valB);
      if(ia === -1) ia = 999;
      if(ib === -1) ib = 999;
      if (ia !== ib) {
        return currentSortOrderBC5 === 'asc' ? ia - ib : ib - ia;
      }
    }
    
    if (valA < valB) return currentSortOrderBC5 === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortOrderBC5 === 'asc' ? 1 : -1;
    return 0;
  });

  filtered.forEach(function(row) {
    count++;
    var tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${getSafeValue(row, ['MÃ KHO']) || ''}</td>
      <td>${getSafeValue(row, ['NHÓM HÀNG']) || ''}</td>
      <td>${getSafeValue(row, ['MÃ HÀNG']) || ''}</td>
      <td>${getSafeValue(row, ['ĐƠN VỊ TÍNH', 'ĐVT']) || ''}</td>
      <td style="text-align: right;">${(Number(getSafeValue(row, ['TỔNG GỬI'])) || 0).toLocaleString()}</td>
      <td style="text-align: right;">${(Number(getSafeValue(row, ['SỐ LƯỢNG BÁN ĐƯỢC'])) || 0).toLocaleString()}</td>
      <td style="text-align: right;"><strong>${(Number(getSafeValue(row, ['TỒN THỰC TẾ'])) || 0).toLocaleString()}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  if (count === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">Không có dữ liệu phù hợp</td></tr>';
  }
}

function sortBC5Table(colIndex) {
  var cols = ['MÃ KHO', 'NHÓM HÀNG', 'MÃ HÀNG', 'ĐVT', 'TỔNG GỬI', 'BÁN ĐƯỢC', 'TỒN THỰC TẾ'];
  var col = cols[colIndex];
  if (currentSortColumnBC5 === col) {
    currentSortOrderBC5 = currentSortOrderBC5 === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumnBC5 = col;
    currentSortOrderBC5 = 'asc';
  }
  renderBC5Table(rawDataBC5);
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    var searchInput = document.getElementById('table-search-bc5');
    if(searchInput) {
      searchInput.addEventListener('input', function(e) {
        searchQueryBC5 = e.target.value.toLowerCase();
        renderBC5Table(rawDataBC5);
      });
    }
  }, 1000);
});


// ═══════════════════════════════════════════════
// BÁO CÁO 6: BẢNG PHÂN TÍCH C1
// ═══════════════════════════════════════════════
function applyFiltersAndRenderBC6() {
  const dataC1 = window.DASHBOARD_DATA['data C1chitiet'];
  if (!dataC1) return;

  const tbody = document.getElementById('bc6-tbody');
  const theadRow = document.getElementById('bc6-thead-row');
  if (!tbody || !theadRow) return;

  // Lọc dữ liệu theo Kho và Nhóm hàng
  const filteredData = dataC1.filter(row => {
    const maKho = row['MÃ KHO'];
    if (selectedKho.size > 0 && !selectedKho.has(maKho)) return false;
    
    const nhom = row['NHÓM HÀNG'];
    if (selectedNhomHang.size > 0 && !selectedNhomHang.has(nhom)) return false;
    
    return true;
  });

  // Lấy danh sách tháng từ cột NGÀY RA HÓA ĐƠN
  const monthSet = new Set();
  filteredData.forEach(row => {
    const dateStr = row['NGÀY RA HÓA ĐƠN'];
    if (dateStr && typeof dateStr === 'string' && dateStr.trim() !== '') {
      const parts = dateStr.trim().split('/');
      if (parts.length >= 2) {
        const monthYear = parts[1] + '/' + (parts[2] || '');
        monthSet.add(monthYear);
      } else {
        monthSet.add(dateStr);
      }
    } else {
      monthSet.add('N/A');
    }
  });

  // Sắp xếp các tháng
  const months = Array.from(monthSet).sort((a, b) => {
    if (a === 'N/A') return 1;
    if (b === 'N/A') return -1;
    const pA = a.split('/');
    const pB = b.split('/');
    if (pA.length === 2 && pB.length === 2) {
      if (pA[1] !== pB[1]) return parseInt(pA[1]) - parseInt(pB[1]);
      return parseInt(pA[0]) - parseInt(pB[0]);
    }
    return a.localeCompare(b);
  });

  // Xây dựng Pivot (Kho -> Tháng -> Tổng số lượng còn lại)
  const pivot = {};
  filteredData.forEach(row => {
    const maKho = row['MÃ KHO'] || 'N/A';
    const qty = parseFloat(row['SỐ LƯỢNG CÒN LẠI']) || 0;
    
    const dateStr = row['NGÀY RA HÓA ĐƠN'];
    let monthYear = 'N/A';
    if (dateStr && typeof dateStr === 'string' && dateStr.trim() !== '') {
      const parts = dateStr.trim().split('/');
      if (parts.length >= 2) {
        monthYear = parts[1] + '/' + (parts[2] || '');
      } else {
        monthYear = dateStr;
      }
    }
    
    if (!pivot[maKho]) pivot[maKho] = {};
    if (!pivot[maKho][monthYear]) pivot[maKho][monthYear] = 0;
    
    pivot[maKho][monthYear] += qty;
  });

  // Render Table Header
  let thHTML = `<th onclick="sortTable('table-bc6', 0)">Mã Kho ↕</th>`;
  months.forEach(m => {
    thHTML += `<th>Tháng ${m}</th>`;
  });
  thHTML += `<th>Tổng Cộng</th>`;
  theadRow.innerHTML = thHTML;

  // Render Table Body
  let tbodyHTML = '';
  const khoKeys = Object.keys(pivot).sort();
  khoKeys.forEach(kho => {
    let rowTotal = 0;
    let tr = `<tr><td>${kho}</td>`;
    months.forEach(m => {
      const val = pivot[kho][m] || 0;
      rowTotal += val;
      tr += `<td>${val.toLocaleString('vi-VN')}</td>`;
    });
    tr += `<td><strong>${rowTotal.toLocaleString('vi-VN')}</strong></td></tr>`;
    tbodyHTML += tr;
  });
  
  // Render Grand Total Row
  let trTotal = `<tr style="background-color: var(--card-bg-light); font-weight: bold;"><td>TỔNG</td>`;
  let grandTotal = 0;
  months.forEach(m => {
    let colTotal = 0;
    khoKeys.forEach(kho => {
      colTotal += pivot[kho][m] || 0;
    });
    grandTotal += colTotal;
    trTotal += `<td>${colTotal.toLocaleString('vi-VN')}</td>`;
  });
  trTotal += `<td>${grandTotal.toLocaleString('vi-VN')}</td></tr>`;
  tbodyHTML += trTotal;

  tbody.innerHTML = tbodyHTML;

  // --- Render Month Filter and Detail Table ---
  const monthFilter = document.getElementById('bc6-month-filter');
  if (monthFilter) {
    const currentVal = monthFilter.value;
    let optHTML = '';
    months.forEach(m => {
      optHTML += `<option value="${m}">Tháng ${m}</option>`;
    });
    monthFilter.innerHTML = optHTML;
    
    if (months.includes(currentVal)) {
      monthFilter.value = currentVal;
    } else if (months.length > 0) {
      // Default select the oldest (earliest) month first
      monthFilter.value = months[0];
    }
    
    monthFilter.onchange = () => {
      renderBC6Detail(filteredData);
    };
    
    renderBC6Detail(filteredData);
  }

  // Cập nhật bộ lọc NPP trong Báo cáo 6 theo các Mã Kho đang chọn (selectedKho)
  initBC3NppFilter();
}

function renderBC6Detail(filteredData) {
  const monthFilter = document.getElementById('bc6-month-filter');
  const detailTbody = document.getElementById('bc6-detail-tbody');
  if (!monthFilter || !detailTbody) return;

  const selectedMonth = monthFilter.value;
  if (!selectedMonth) return;

  // Filter by selected month
  const detailData = filteredData.filter(row => {
    const dateStr = row['NGÀY RA HÓA ĐƠN'];
    let mYear = 'N/A';
    if (dateStr && typeof dateStr === 'string' && dateStr.trim() !== '') {
      const parts = dateStr.trim().split('/');
      if (parts.length >= 2) mYear = parts[1] + '/' + (parts[2] || '');
      else mYear = dateStr;
    }
    return mYear === selectedMonth;
  });

  // Group by Mã Hàng + Mã Kho
  const group = {};
  detailData.forEach(row => {
    const maHang = row['MÃ HÀNG'] || 'N/A';
    const maKho = row['MÃ KHO'] || 'N/A';
    const key = maHang + '|' + maKho;
    if (!group[key]) {
      group[key] = { maHang, maKho, qty: 0 };
    }
    group[key].qty += parseFloat(row['SỐ LƯỢNG CÒN LẠI']) || 0;
  });

  // Sort by maKho (Tên kho) alphabetically, then by qty descending
  const list = Object.values(group).sort((a, b) => {
    if (a.maKho < b.maKho) return -1;
    if (a.maKho > b.maKho) return 1;
    return b.qty - a.qty;
  });

  // Render
  let html = '';
  list.forEach(item => {
    html += `<tr>
      <td>${item.maKho}</td>
      <td style="font-weight: 500;">${item.maHang}</td>
      <td><strong>${item.qty.toLocaleString('vi-VN')}</strong></td>
    </tr>`;
  });
  
  if (list.length === 0) {
    html = `<tr><td colspan="3" style="text-align:center;">Không có dữ liệu chi tiết</td></tr>`;
  }
  
  detailTbody.innerHTML = html;
}

// Initial render
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof applyFiltersAndRenderBC6 === 'function') {
      applyFiltersAndRenderBC6();
    }
  }, 100);
});

// ══════════════════════════════════════════════════════════
// BỘ LỌC NPP (BC3): Lọc theo Tên NPP (TÊN C1) từ data C1chitiet
// Kết quả: Mã Hàng | Số Lượng Còn Lại
// ══════════════════════════════════════════════════════════

let bc3NppSortCol = 'SỐ LƯỢNG CÒN LẠI';
let bc3NppSortOrder = 'desc';

function initBC3NppFilter() {
  const dataC1 = window.DASHBOARD_DATA && window.DASHBOARD_DATA['data C1chitiet'];
  if (!dataC1 || dataC1.length === 0) return;

  // Thu thập danh sách NPP duy nhất (TÊN C1) theo Kho đang chọn
  const nppSet = new Set();
  dataC1.forEach(row => {
    const maKho = (row['MÃ KHO'] || '').trim();
    if (selectedKho && selectedKho.size > 0 && !selectedKho.has(maKho)) return;
    const npp = (row['TÊN C1'] || '').trim();
    if (npp) nppSet.add(npp);
  });

  const sorted = Array.from(nppSet).sort((a, b) => a.localeCompare(b, 'vi'));

  const select = document.getElementById('bc3-npp-select');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Tất cả NPP --</option>';
  let foundCurrent = false;
  sorted.forEach(npp => {
    const opt = document.createElement('option');
    opt.value = npp;
    opt.textContent = npp;
    if (npp === currentVal) {
      opt.selected = true;
      foundCurrent = true;
    }
    select.appendChild(opt);
  });

  if (!foundCurrent && currentVal !== '') {
    select.value = '';
  }

  // Event listeners
  if (!select.dataset.bound) {
    select.addEventListener('change', renderBC3NppTable);
    select.dataset.bound = 'true';
  }

  const searchInput = document.getElementById('bc3-npp-search');
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', renderBC3NppTable);
    searchInput.dataset.bound = 'true';
  }

  // Render bảng chi tiết NPP
  renderBC3NppTable();
}

function renderBC3NppTable() {
  const dataC1 = window.DASHBOARD_DATA && window.DASHBOARD_DATA['data C1chitiet'];
  const tbody = document.getElementById('tbody-bc3-npp');
  const tfoot = document.getElementById('tfoot-bc3-npp');
  if (!tbody || !dataC1) return;

  const selectedNpp = (document.getElementById('bc3-npp-select') || {}).value || '';
  const searchQ = ((document.getElementById('bc3-npp-search') || {}).value || '').trim().toLowerCase();

  // Lọc theo Kho (bộ lọc chung)
  let filtered = dataC1.filter(row => {
    const maKho = (row['MÃ KHO'] || '').trim();
    if (selectedKho && selectedKho.size > 0 && !selectedKho.has(maKho)) return false;

    // Lọc NPP
    if (selectedNpp) {
      const tenC1 = (row['TÊN C1'] || '').trim();
      if (tenC1 !== selectedNpp) return false;
    }

    return true;
  });

  // Tổng hợp theo MÃ HÀNG
  const grouped = {};
  filtered.forEach(row => {
    const maHang = (row['MÃ HÀNG'] || '').trim();
    if (!maHang) return;
    const soLuong = parseFloat(row['SỐ LƯỢNG CÒN LẠI']) || 0;
    if (!grouped[maHang]) grouped[maHang] = { maHang, soLuong: 0 };
    grouped[maHang].soLuong += soLuong;
  });

  let rows = Object.values(grouped);

  // Search filter theo mã hàng
  if (searchQ) {
    rows = rows.filter(r => r.maHang.toLowerCase().includes(searchQ));
  }

  // Sort
  rows.sort((a, b) => {
    if (bc3NppSortCol === 'SỐ LƯỢNG CÒN LẠI') {
      return bc3NppSortOrder === 'asc' ? a.soLuong - b.soLuong : b.soLuong - a.soLuong;
    } else {
      const va = a.maHang.toLowerCase();
      const vb = b.maHang.toLowerCase();
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return bc3NppSortOrder === 'asc' ? cmp : -cmp;
    }
  });

  // Render tbody
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-center" style="color:#64748b; padding:16px;">Không có dữ liệu phù hợp</td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  let html = '';
  rows.forEach((r, idx) => {
    const bgClass = idx % 2 === 0 ? '' : 'style="background: rgba(0,0,0,0.03);"';
    html += `<tr ${bgClass}>
      <td style="font-weight:600;">${r.maHang}</td>
      <td style="text-align:right; font-weight:700;">${r.soLuong.toLocaleString('vi-VN')}</td>
    </tr>`;
  });
  tbody.innerHTML = html;

  // Footer tổng
  const grandTotal = rows.reduce((s, r) => s + r.soLuong, 0);
  if (tfoot) {
    tfoot.innerHTML = `<tr style="font-weight:800; background:rgba(59,130,246,0.08); border-top:2px solid rgba(59,130,246,0.3);">
      <td>TỔNG (${rows.length} mã)</td>
      <td style="text-align:right;">${grandTotal.toLocaleString('vi-VN')}</td>
    </tr>`;
  }

  // Update sort icons
  updateSortIconsBC3NPP();
}

function handleSortBC3NPP(col) {
  if (bc3NppSortCol === col) {
    bc3NppSortOrder = bc3NppSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    bc3NppSortCol = col;
    bc3NppSortOrder = col === 'SỐ LƯỢNG CÒN LẠI' ? 'desc' : 'asc';
  }
  renderBC3NppTable();
}

function updateSortIconsBC3NPP() {
  const mahangSpan = document.getElementById('sort-bc3npp-mahang');
  const soluongSpan = document.getElementById('sort-bc3npp-soluong');
  if (mahangSpan) mahangSpan.textContent = bc3NppSortCol === 'MÃ HÀNG' ? (bc3NppSortOrder === 'asc' ? '▲' : '▼') : '↕';
  if (soluongSpan) soluongSpan.textContent = bc3NppSortCol === 'SỐ LƯỢNG CÒN LẠI' ? (bc3NppSortOrder === 'asc' ? '▲' : '▼') : '↕';
}

// Khởi tạo bộ lọc NPP khi trang load xong
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initBC3NppFilter();
  }, 200);
});

/**
 * Kết xuất dữ liệu thô đã lọc của từng Báo cáo ra file Excel (.xlsx)
 */
function exportReportToExcel(reportId) {
  const target = reportId || currentReport || 'bc1';
  let dataToExport = [];
  let sheetName = 'DataTho';
  let fileTitle = 'KeHoachLeg1';

  // Lấy ngày hiện tại format YYYYMMDD_HHMM
  const now = new Date();
  const dateStr = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0');

  if (target === 'bc1') {
    sheetName = 'data1-đi đường';
    fileTitle = 'BaoCao1_KeHoachLeg1';
    const raw = window.DASHBOARD_DATA['data1-đi đường'] || [];
    dataToExport = raw.filter(row => {
      const kho = getSafeValue(row, ['MÃ KHO', 'Mã Kho', 'whseid', 'whsecode']);
      const nhom = getSafeValue(row, ['NHÓM HÀNG', 'Nhóm Hàng', 'skugroup']);
      if (kho && selectedKho.size > 0 && !selectedKho.has(String(kho).trim())) return false;
      if (nhom && selectedNhomHang.size > 0 && !selectedNhomHang.has(String(nhom).trim())) return false;
      return true;
    });
  } else if (target === 'bc2') {
    sheetName = 'data6-tồn kho theo HSD';
    fileTitle = 'BaoCao2_HangGanHetHan';
    const raw = window.DASHBOARD_DATA['data6-tồn kho theo HSD'] || [];
    dataToExport = raw.filter(row => {
      const kho = getSafeValue(row, ['MÃ KHO', 'Mã Kho', 'whseid', 'whsecode']);
      const nhom = getSafeValue(row, ['NHÓM HÀNG', 'Nhóm Hàng', 'skugroup']);
      if (kho && selectedKho.size > 0 && !selectedKho.has(String(kho).trim())) return false;
      if (nhom && selectedNhomHang.size > 0 && !selectedNhomHang.has(String(nhom).trim())) return false;
      return true;
    });
  } else if (target === 'bc3') {
    sheetName = 'data5-tồn kho theo PL, ví trí';
    fileTitle = 'BaoCao3_KiemTraPallet';
    const raw = window.DASHBOARD_DATA['data5-tồn kho theo PL, ví trí'] || window.DASHBOARD_DATA['baocao5-table8'] || [];
    dataToExport = raw.filter(row => {
      const kho = getSafeValue(row, ['MÃ KHO', 'Mã Kho', 'whseid', 'whsecode']);
      const nhom = getSafeValue(row, ['NHÓM HÀNG', 'Nhóm Hàng', 'skugroup']);
      if (kho && selectedKho.size > 0 && !selectedKho.has(String(kho).trim())) return false;
      if (nhom && selectedNhomHang.size > 0 && !selectedNhomHang.has(String(nhom).trim())) return false;
      return true;
    });
  } else if (target === 'bc4') {
    sheetName = 'Append1 Nhập- Xuất';
    fileTitle = 'BaoCao4_PhanTichNhapXuat';
    const raw = window.DASHBOARD_DATA['Append1 Nhập- Xuất'] || [];
    dataToExport = raw.filter(row => {
      const kho = getSafeValue(row, ['MÃ KHO', 'Mã Kho', 'whseid', 'whsecode']);
      const nhom = getSafeValue(row, ['NHÓM HÀNG', 'Nhóm Hàng', 'skugroup']);
      const ngay = getSafeValue(row, ['NGÀY', 'Ngày', 'Column1']);
      if (kho && selectedKho.size > 0 && !selectedKho.has(String(kho).trim())) return false;
      if (nhom && selectedNhomHang.size > 0 && !selectedNhomHang.has(String(nhom).trim())) return false;
      if (ngay && selectedNgayBC4.size > 0 && !selectedNgayBC4.has(String(ngay).trim())) return false;
      return true;
    });
  } else if (target === 'bc5') {
    sheetName = 'data7-tồn kho theo ngày';
    fileTitle = 'BaoCao5_TonKhoTheoNgay';
    const raw = window.DASHBOARD_DATA['data7-tồn kho theo ngày'] || [];
    dataToExport = raw.filter(row => {
      const kho = getSafeValue(row, ['MÃ KHO', 'Mã Kho', 'whseid', 'whsecode']);
      const nhom = getSafeValue(row, ['NHÓM HÀNG', 'Nhóm Hàng', 'skugroup']);
      if (kho && selectedKho.size > 0 && !selectedKho.has(String(kho).trim())) return false;
      if (nhom && selectedNhomHang.size > 0 && !selectedNhomHang.has(String(nhom).trim())) return false;
      return true;
    });
  } else if (target === 'bc6') {
    sheetName = 'baocao7-Tồn kho hàng gửi';
    fileTitle = 'BaoCao6_TonKhoHangGui';
    const raw = window.DASHBOARD_DATA['baocao7-Tồn kho hàng gửi'] || window.DASHBOARD_DATA['data C1chitiet'] || [];
    dataToExport = raw.filter(row => {
      const kho = getSafeValue(row, ['MÃ KHO', 'Mã Kho', 'whseid', 'whsecode']);
      const nhom = getSafeValue(row, ['NHÓM HÀNG', 'Nhóm Hàng', 'skugroup']);
      if (kho && selectedKho.size > 0 && !selectedKho.has(String(kho).trim())) return false;
      if (nhom && selectedNhomHang.size > 0 && !selectedNhomHang.has(String(nhom).trim())) return false;
      return true;
    });
  }

  if (!dataToExport || dataToExport.length === 0) {
    alert("Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại để kết xuất Excel!");
    return;
  }

  const fileName = `${fileTitle}_${dateStr}.xlsx`;

  // Kiểm tra thư viện SheetJS (XLSX)
  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Max 31 chars trong sheet name
    XLSX.writeFile(wb, fileName);
  } else {
    // Fallback sang CSV mã hóa UTF-8 BOM
    exportToCsvFallback(dataToExport, `${fileTitle}_${dateStr}.csv`);
  }
}

function exportToCsvFallback(dataArray, fileName) {
  if (!dataArray || dataArray.length === 0) return;
  const keys = Object.keys(dataArray[0]);
  let csvContent = keys.join(',') + '\n';

  dataArray.forEach(row => {
    const line = keys.map(k => {
      let val = row[k] == null ? '' : String(row[k]);
      val = val.replace(/"/g, '""');
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        val = `"${val}"`;
      }
      return val;
    }).join(',');
    csvContent += line + '\n';
  });

  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


