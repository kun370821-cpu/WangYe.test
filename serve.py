# -*- coding: utf-8 -*-
"""家庭大字体电话本 —— 本地预览服务器

作用：把当前文件夹通过 http:// 提供出去，给浏览器看。
PWA 的「添加到主屏幕」和离线缓存必须在 http 下才生效，直接双击
index.html 用不了这两个功能，所以需要这个文件。

它不是后端：不处理业务逻辑、不保存数据，只是把文件递给浏览器。
"""

import http.server
import datetime
import json
import pathlib
import shutil
import socket
import socketserver
import sys
import threading
import webbrowser

DEFAULT_PORT = 8000
LOG_PATH = pathlib.Path(__file__).with_name("访问记录.log")
DATA_PATH = pathlib.Path(__file__).with_name("data.js")
BACKUP_PATH = pathlib.Path(__file__).with_name("data.js.bak")
GROUP_ORDER_FALLBACK = ["家人", "医生", "物业", "快递"]


class PreviewServer(http.server.ThreadingHTTPServer):
    """多线程版本。

    浏览器打开页面后会占着一条连接不放（预连接），单线程的服务器
    会被它卡住，导致手机再连进来时一直转圈打不开。用多线程就不会。
    """

    # Windows 上打开 SO_REUSEADDR 会让第二个实例"偷偷"抢占同一个端口，
    # 反而看不到"端口被占用"的提示，所以这里保持关闭。
    allow_reuse_address = False
    daemon_threads = True


class PhonebookHandler(http.server.SimpleHTTPRequestHandler):
    """处理网页请求。

    关键：不往控制台写日志，改写文件。
    Windows 控制台只要被鼠标选中（复制窗口里的文字时很常见），
    往控制台写日志的程序就会被暂停——那样手机和电脑都会连不上。
    另外给每条连接设 15 秒超时，避免浏览器的空闲连接一直占着线程。
    """

    timeout = 15

    def log_message(self, fmt, *args):
        line = "%s  %s\n" % (self.log_date_time_string(), fmt % args)
        try:
            with open(LOG_PATH, "a", encoding="utf-8") as fh:
                fh.write(line)
        except OSError:
            pass

    # ---------- 网页上点「保存」时，直接把 data.js 写掉 ----------

    def _send_json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = self.path.split("?")[0]
        if path != "/api/save-contacts":
            self.send_error(404, "Not Found")
            return

        # 只允许这台电脑自己保存，手机等其他设备只能看，不能改文件
        if self.client_address[0] not in ("127.0.0.1", "::1"):
            self._send_json(403, {"ok": False, "error": "只允许本机保存"})
            return

        try:
            length = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            items = payload.get("contacts")
            if not isinstance(items, list):
                raise ValueError("contacts 必须是数组")

            text = build_data_js(items)
            if DATA_PATH.exists():
                shutil.copyfile(DATA_PATH, BACKUP_PATH)      # 留一份上一次的
            DATA_PATH.write_text(text, encoding="utf-8")
        except Exception as err:                              # noqa: BLE001
            self._send_json(500, {"ok": False, "error": str(err)})
            return

        self._send_json(200, {"ok": True, "count": len(items)})


def build_data_js(items):
    """把联系人数组写成 data.js 的内容（格式和网页导出的完全一样）。"""
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    clean = []
    for raw in items:
        item = {
            "group": str(raw.get("group", "")).strip() or "家人",
            "relation": str(raw.get("relation", "")).strip(),
            "name": str(raw.get("name", "")).strip(),
            "phone": str(raw.get("phone", "")).strip(),
            "emoji": str(raw.get("emoji", "") or "👤"),
            "photo": str(raw.get("photo", "") or ""),
            "note": str(raw.get("note", "")).strip(),
        }
        clean.append(item)

    order = []
    for g in GROUP_ORDER_FALLBACK:
        if any(item["group"] == g for item in clean):
            order.append(g)
    for item in clean:
        if item["group"] and item["group"] not in order:
            order.append(item["group"])

    lines = [
        "/* ============================================================",
        " * 家庭大字体电话本 —— 联系人数据",
        " * 由本地网页的「编辑」功能写入，时间：" + now,
        " *",
        " * 照片已经压缩并内嵌在里面，不需要额外的图片文件。",
        " * 想让长辈看到，把改动推送到 GitHub：",
        ' *   cd E:\\网页试验\\test2',
        " *   git add -A",
        ' *   git commit -m "更新联系人"',
        " *   git push",
        " * ============================================================ */",
        "",
        "const CONTACTS = [",
    ]
    for item in clean:
        lines.append("  " + json.dumps(item, ensure_ascii=False) + ",")
    lines += [
        "];",
        "",
        "/* 分类在页面上的先后顺序 */",
        "const DEFAULT_GROUP_ORDER = " + json.dumps(order, ensure_ascii=False) + ";",
        "",
    ]
    return "\n".join(lines)


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
        httpd = PreviewServer(("0.0.0.0", port), PhonebookHandler)
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
    print("  谁访问过都记在「访问记录.log」里，窗口可以随便点、随便选，不会再卡住。")
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
