@echo off
chcp 65001 >nul

echo =======================================================
echo 0. KIEM TRA VA CAI DAT THU VIEN PYTHON...
echo =======================================================
pip install requests pandas pywin32 openpyxl >nul 2>&1
echo Hoan tat kiem tra thu vien.
echo.

echo =======================================================
echo 1. DANG LAY DU LIEU TU WEB PORTAL VA CAP NHAT EXCEL...
echo =======================================================
python extract_data.py

echo.
echo =======================================================
echo 2. DONG BO WEB DASHBOARD LEN GITHUB...
echo =======================================================
git --version >nul 2>&1
if errorlevel 1 (
    echo [CANH BAO] May tinh chua cai dat Git! Vui long cai dat Git de dong bo len web.
    echo Vao trang https://git-scm.com/downloads de tai Git.
    echo Du lieu van da duoc luu o file excel và trang web local!
) else (
    git add index.html app.js styles.css data.js >nul 2>&1
    if exist img\ git add img\ >nul 2>&1
    git add run.bat >nul 2>&1
    git commit -m "Auto update dashboard data %date% %time%" >nul 2>&1
    git push origin main
    echo.
    echo =======================================================
    echo HOAN TAT! DASHBOARD DA DUOC CAP NHAT TREN GITHUB.
    echo =======================================================
)
pause
