@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: run.bat - HE THONG TU DONG CAP NHAT BAO CAO KHO NTB
:: Mo ta: Lay du lieu tu Web Portal, cap nhat Excel, xuat
::         data.js va dong bo len GitHub.
:: Tuong thich: Chay duoc tren moi may Windows (ca VPS headless)
:: Khong dung: pause, input(), cac lenh can GUI.
:: ============================================================

cd /d "%~dp0"
set "VENV_DIR=%~dp0venv"
set "REQ_FILE=%~dp0requirements.txt"

:: Don dep tien trinh Excel ngam cu bi treo (tranh ket file tren VPS)
taskkill /F /IM EXCEL.EXE >nul 2>&1

:: Ghi log thoi gian bat dau
echo [%date% %time%] === BAT DAU CHAY === > log.txt

:: ------------------------------------------------------------
:: 0. DONG BO PULL CODE MOI TRUOC KHI XU LY
:: ------------------------------------------------------------
git --version >nul 2>&1
if not errorlevel 1 (
    set GIT_TERMINAL_PROMPT=0
    set GCM_INTERACTIVE=never
    set GIT_SSH_COMMAND=ssh -o BatchMode=yes
    git remote set-url origin https://github.com/hoten08031984-lab/khoNTB.git >nul 2>&1
    git fetch origin main >nul 2>&1
    git reset --hard origin/main >nul 2>&1
)

echo.
echo =======================================================
echo 1. KIEM TRA VA CAI DAT MOI TRUONG (VENV)...
echo =======================================================

:: Kiem tra Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] [LOI] Khong tim thay Python! >> log.txt
    echo [LOI] Khong tim thay Python tren he thong.
    exit /b 1
)

:: Tao Virtual Environment moi neu chua co
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo Dang tao Virtual Environment moi ...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [%date% %time%] [LOI] Tao venv that bai! >> log.txt
        echo LOI: Khong the tao Virtual Environment.
        exit /b 1
    )
)

"%VENV_DIR%\Scripts\python.exe" -m pip install -r "%REQ_FILE%" -q >nul 2>&1
echo [%date% %time%] Da kiem tra thu vien Python. >> log.txt

echo.
echo =======================================================
echo 2. DANG LAY DU LIEU TU WEB PORTAL VA CAP NHAT EXCEL...
echo =======================================================
"%VENV_DIR%\Scripts\python.exe" extract_data.py
if errorlevel 1 (
    echo [%date% %time%] [LOI] extract_data.py that bai! >> log.txt
    echo [LOI] Lay du lieu that bai. Xem log.txt de biet chi tiet.
) else (
    echo [%date% %time%] extract_data.py hoan tat thanh cong. >> log.txt
)

echo.
echo.
echo =======================================================
echo 3. DONG BO WEB DASHBOARD LEN GITHUB...
echo =======================================================
git --version >nul 2>&1
if not errorlevel 1 (
    set GIT_TERMINAL_PROMPT=0
    set GCM_INTERACTIVE=never
    set GIT_SSH_COMMAND=ssh -o BatchMode=yes
    git remote set-url origin https://github.com/hoten08031984-lab/khoNTB.git >nul 2>&1
    git add .
    git commit -m "Auto update dashboard data [%date% %time%]" >nul 2>&1
    git pull origin main --rebase >nul 2>&1
    git push origin main >nul 2>&1
    if not errorlevel 1 (
        echo [%date% %time%] Dong bo GitHub thanh cong. >> log.txt
        echo [OK] Da dong bo len GitHub thanh cong.
    ) else (
        echo [%date% %time%] [CANH BAO] Push GitHub that bai! >> log.txt
        echo [CANH BAO] Khong the push len GitHub.
    )
) else (
    echo [%date% %time%] Khong tim thay Git. >> log.txt
)


echo.
echo [%date% %time%] === KET THUC === >> log.txt
echo =======================================================
echo XONG! Tat cua so nay se khong anh huong den ket qua.
echo =======================================================
echo XONG! Tat cua so nay se khong anh huong den ket qua.
echo =======================================================
