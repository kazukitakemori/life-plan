@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Life plan 開発サーバー
echo.
echo  ========================================
echo   Life plan を起動しています...
echo  ========================================
echo.
echo  起動が完了したら、ブラウザで次を開いてください:
echo    http://127.0.0.1:5173/
echo.
echo  ※ この黒い画面を閉じると、ブラウザの表示も止まります
echo.
npm run dev
