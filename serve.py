# -*- coding: utf-8 -*-
"""家庭大字体电话本 —— 本地预览服务器

作用：把当前文件夹通过 http:// 提供出去，给浏览器看。
PWA 的「添加到主屏幕」和离线缓存必须在 http 下才生效，直接双击
index.html 用不了这两个功能，所以需要这个文件。

它不是后端：不处理业务逻辑、不保存数据，只是把文件递给浏览器。
"""

import http.server
import socket
import socketserver
import sys
import threading
import webbrowser

DEFAULT_PORT = 8000


class PreviewServer(http.server.ThreadingHTTPServer):
    """多线程版本。

    浏览器打开页面后会占着一条连接不放（预连接），单线程的服务器
    会被它卡住，导致手机再连进来时一直转圈打不开。用多线程就不会。
    """

    # Windows 上打开 SO_REUSEADDR 会让第二个实例"偷偷"抢占同一个端口，
    # 反而看不到"端口被占用"的提示，所以这里保持关闭。
    allow_reuse_address = False
    daemon_threads = True


def lan_ip():
    """取本机在局域网里的地址（UDP 只是问系统走哪块网卡，不会真的发包）。"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return ""
    finally:
        sock.close()


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"端口号「{sys.argv[1]}」不是数字，改用 {DEFAULT_PORT}。")

    try:
        httpd = PreviewServer(("0.0.0.0", port), http.server.SimpleHTTPRequestHandler)
    except OSError as err:
        print()
        print(f"启动失败：端口 {port} 被占用了（{err}）。")
        print(f"解决办法：用记事本打开 启动网页.bat，把 set PORT={port} 改成 9000 之类的数字。")
        print()
        input("按回车键关闭这个窗口...")
        return 1

    local_url = f"http://127.0.0.1:{port}/"
    ip = lan_ip()

    print()
    print("  家庭电话本已启动    （按 Ctrl+C 或直接关掉窗口即可停止）")
    print("  " + "-" * 52)
    print(f"  这台电脑打开：  {local_url}")
    if ip:
        print(f"  手机打开（连同一个 Wi-Fi）：  http://{ip}:{port}/")
        print("  第一次可能弹 Windows 防火墙提示，选「允许访问」")
    print("  " + "-" * 52)
    print("  浏览器马上就自动打开，稍等一两秒。")
    print()

    threading.Timer(1.0, lambda: webbrowser.open(local_url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  已停止。")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
