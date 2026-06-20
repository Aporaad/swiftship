@echo off
chcp 65001 > nul
cls

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║        alx — بناء تطبيق Desktop               ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: التحقق من وجود Node.js
node --version > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [خطأ] Node.js غير مثبت! يرجى تثبيته من https://nodejs.org
    pause
    exit /b 1
)

for /f %%i in ('node --version') do set NODE_VER=%%i
echo [✓] Node.js موجود: %NODE_VER%

echo.
echo [1/5] التحقق من ملف .env ...
if not exist ".env" (
    echo [!] ملف .env غير موجود، جارٍ إنشاؤه من القالب...
    copy ".env.example" ".env" > nul
    echo.
    echo  ┌─────────────────────────────────────────────────────┐
    echo  │ يرجى فتح ملف .env وتعديل بيانات Supabase:         │
    echo  │   VITE_SUPABASE_URL=...                            │
    echo  │   VITE_SUPABASE_ANON_KEY=...                       │
    echo  │   SUPABASE_URL=...                                  │
    echo  │   SUPABASE_ANON_KEY=...                            │
    echo  └─────────────────────────────────────────────────────┘
    echo.
    start notepad ".env"
    pause
)
echo [✓] ملف .env موجود

echo.
echo [2/5] تثبيت الحزم المطلوبة...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [خطأ] فشل تثبيت الحزم
    pause
    exit /b 1
)
echo [✓] تم تثبيت الحزم

echo.
echo [3/5] بناء الواجهة الأمامية (React/Vite)...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [خطأ] فشل بناء الواجهة الأمامية
    pause
    exit /b 1
)
echo [✓] تم بناء الواجهة الأمامية

echo.
echo [4/5] بناء خادم Express...
call npm run build:server
if %ERRORLEVEL% neq 0 (
    echo [خطأ] فشل بناء الخادم
    pause
    exit /b 1
)
echo [✓] تم بناء الخادم

echo.
echo [5/5] إنشاء ملف التثبيت للـ Windows...
call npx electron-builder --win
if %ERRORLEVEL% neq 0 (
    echo [خطأ] فشل بناء ملف التثبيت
    pause
    exit /b 1
)

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   ✓ تم البناء بنجاح!                                ║
echo  ║   الملف موجود في: dist-electron\                    ║
echo  ║   alx Setup 1.0.0.exe                         ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
start "" "dist-electron"
pause
