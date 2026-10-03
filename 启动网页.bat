@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 家庭大字体电话本

rem 端口被占用时，把下面这行的 8000 改成别的数字（例如 9000）
set PORT=8000

where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo 没有找到 python 命令。
    echo 请先安装 Python，安装时记得勾选 "Add Python to PATH"。
    echo.
    echo 也可以直接双击 index.html 打开（这种方式下"添加到主屏幕"用不了）。
    echo.
    pause
    exit /b 1
)

echo.
echo 正在启动电话本，稍后浏览器会自动打开...
echo 地址： http://127.0.0.1:%PORT%/
echo 手机上要用的话，请看 README.md 里的说明。
echo 用完之后回到这个窗口按 Ctrl+C，或者直接关掉窗口。
echo.

python -c "import http.server,socketserver,threading,webbrowser,sys;port=int(sys.argv[1]);url='http://127.0.0.1:'+str(port)+'/';httpd=socketserver.TCPServer(('127.0.0.1',port),http.server.SimpleHTTPRequestHandler);threading.Timer(1.0,lambda:webbrowser.open(url)).start();print('serving',url);httpd.serve_forever()" %PORT%

echo.
echo 电话本已停止。
pause
