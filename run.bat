@echo off
chcp 65001 >nul
echo =======================================================
echo 1. DANG LAY DU LIEU TU WEB PORTAL VA CAP NHAT EXCEL...
echo =======================================================
python extract_data.py

echo.
echo =======================================================
echo 2. DONG BO WEB DASHBOARD LEN GITHUB...
echo =======================================================
git add index.html app.js styles.css data.js img/ >nul 2>&1
git add run.bat >nul 2>&1
git commit -m "Auto update dashboard data %date% %time%"
git push origin main

echo.
echo =======================================================
echo HOAN TAT! DASHBOARD DA DUOC CAP NHAT TREN GITHUB.
echo =======================================================
pause
