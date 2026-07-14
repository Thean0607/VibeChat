@echo off
chcp 65001 >nul
echo ========================================================
echo        VIBECHAT - CÀI ĐẶT TỰ ĐỘNG (SETUP SCRIPT)
echo ========================================================
echo.

echo [1/3] Dang cai dat thu vien cho Backend...
cd backend
call npm install
cd ..
echo OK! Backend da duoc cai dat xong.
echo.

echo [2/3] Dang cai dat thu vien cho Frontend (Vite)...
cd vibechat-vite
call npm install
cd ..
echo OK! Frontend da duoc cai dat xong.
echo.

echo [3/3] Dang thiet lap Co so du lieu (Database)...
echo Chay file database.sql thong qua sqlcmd...
sqlcmd -S (localdb)\MSSQLLocalDB -i backend\database.sql
if %ERRORLEVEL% NEQ 0 (
    echo [CANH BAO] Khong the tu dong khoi tao Database.
    echo Vui long kiem tra xem SQL Server LocalDB da duoc cai dat hay chua,
    echo hoac ban co the chay file backend\database.sql thu cong bang SSMS.
) else (
    echo OK! Database da duoc tao va cap nhat thanh cong.
)
echo.

echo ========================================================
echo Cài đặt hoan tat! Ban co the nhap dup chuot vao file
echo 'run_all.cmd' de khoi dong ca Backend va Frontend.
echo ========================================================
pause
