"""サイトを手元で確認するための簡易サーバー（Jekyll / Ruby は不要）．

使い方（リポジトリのルートで）:
    python tools/preview.py          （4000 から順に空いているポートを自動で選ぶ）
    python tools/preview.py 8080     （ポートを指定する場合）
表示された URL をブラウザで開く．終了は Ctrl+C．

GitHub Pages（Jekyll）がビルド時に行う次の2つを，アクセスのたびに再現する．
  - research/<年>/*.md に _layouts/item.html を当てて，個別ページ（.html）にする
  - research/index.json（全業績の一覧）を作る
.md を保存してブラウザを再読み込みすれば反映される．
※ .md の書き方は「項目: 値」を1行ずつ並べる形だけに対応（research/README.md の書き方）．
"""
import errno
import functools
import html
import http.server
import json
import pathlib
import re
import socket
import sys
import threading
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "research"
LAYOUT = ROOT / "_layouts" / "item.html"
FM = re.compile(r"\A---\r?\n(.*?)\r?\n---\s*(\r?\n|\Z)", re.S)


def front_matter(path):
    """「項目: 値」形式の front matter を辞書にする"""
    m = FM.match(path.read_text(encoding="utf-8"))
    if not m:
        return None
    data = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        kv = re.match(r"^([^:#]+?)\s*:\s*(.*?)\s*$", line)
        if not kv:
            print(f"[警告] 読めない行: {path.relative_to(ROOT)}: {line}", flush=True)
            continue
        key, v = kv.group(1).strip(), kv.group(2)
        if v.startswith('"'):
            try:
                v = json.loads(v)
            except json.JSONDecodeError:
                print(f"[警告] \" の閉じ忘れ？: {path.relative_to(ROOT)}: {line}", flush=True)
                v = v.strip('"')
        elif v.startswith("'") and v.endswith("'") and len(v) >= 2:
            v = v[1:-1].replace("''", "'")
        data[key] = v if v != "" else None
    return data


def item_files():
    """一覧に載せる .md（_ で始まるフォルダ・ファイルと README は除く）"""
    for p in sorted(RESEARCH.rglob("*.md")):
        rel = p.relative_to(ROOT)
        if p.name == "README.md" or any(part.startswith("_") for part in rel.parts):
            continue
        yield p


def index_json():
    entries = []
    for p in item_files():
        data = front_matter(p)
        if data is None:
            print(f"[警告] 先頭の --- が見つからない: {p.relative_to(ROOT)}", flush=True)
            continue
        rel = p.relative_to(ROOT).as_posix()
        entries.append({"file": rel, "url": rel[:-3] + ".html", "data": data})
    return json.dumps(entries, ensure_ascii=False, indent=1)


def item_page(md):
    data = front_matter(md) or {}
    text = LAYOUT.read_text(encoding="utf-8")
    text = text.replace("{{ site.baseurl }}", "")
    # {{ page["項目"] | escape }} と {{ page["項目"] | default: page["項目2"] | escape }} を値に置き換える
    def value(m):
        keys = re.findall(r'page\["([^"]+)"\]', m.group(0))
        return html.escape(str(next((data.get(k) for k in keys if data.get(k)), "")))
    return re.sub(r'\{\{ page\[[^}]*\| escape \}\}', value, text)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # ファイルを直した直後でも古い内容が表示されないようにする
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_text(self, body, ctype):
        data = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        if path == "/research/index.json":
            return self.send_text(index_json(), "application/json; charset=utf-8")
        if path.startswith("/research/"):
            md = ROOT / (path.lstrip("/").removesuffix(".html") + ".md")
            if md in set(item_files()):
                return self.send_text(item_page(md), "text/html; charset=utf-8")
        return super().do_GET()


class Server6(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6


def open_servers(port, handler):
    """localhost は IPv4(127.0.0.1) と IPv6(::1) のどちらでも来るので両方で待ち受ける．
    IPv4 側が使用中なら None を返す（IPv6 が無い環境では IPv4 だけで動かす）"""
    try:
        v4 = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    except OSError:
        return None
    try:
        v6 = Server6(("::1", port), handler)
    except OSError as e:
        if e.errno == errno.EADDRINUSE:
            v4.server_close()   # IPv6 側だけ使用中 → このポートは使わない
            return None
        return [v4]
    return [v4, v6]


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=str(ROOT))
    # Windows では同じポートで2つ目のサーバーが起動できてしまい，古い方が応答し続けることがあるので禁止する
    http.server.ThreadingHTTPServer.allow_reuse_address = False
    if len(sys.argv) > 1:
        candidates = [int(sys.argv[1])]   # 指定されたポートだけを使う
    else:
        candidates = range(4000, 4100)    # 4000 から順に空いているポートを探す
    servers = None
    for port in candidates:
        servers = open_servers(port, handler)
        if servers:
            break
    if not servers:
        if len(sys.argv) > 1:
            sys.exit(f"ポート {candidates[0]} は使用中です．別のポートを指定するか，ポートを指定せずに起動してください．")
        sys.exit("ポート 4000〜4099 がすべて使用中です．前に起動したプレビューを Ctrl+C で止めてください．")
    for s in servers[1:]:
        threading.Thread(target=s.serve_forever, daemon=True).start()
    print(f"http://localhost:{servers[0].server_address[1]}/ で確認できます（Ctrl+C で終了）", flush=True)
    try:
        servers[0].serve_forever()
    except KeyboardInterrupt:
        pass
