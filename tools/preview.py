"""サイトを手元で確認するための簡易サーバー（Jekyll / Ruby は不要）．

使い方（リポジトリのルートで）:
    python tools/preview.py          （ポート 4000）
    python tools/preview.py 8080     （ポートを指定する場合）
表示された URL をブラウザで開く．終了は Ctrl+C．

GitHub Pages（Jekyll）がビルド時に行う次の2つを，アクセスのたびに再現する．
  - research/<年>/*.md に _layouts/item.html を当てて，個別ページ（.html）にする
  - research/index.json（全業績の一覧）を作る
.md を保存してブラウザを再読み込みすれば反映される．
※ .md の書き方は「項目: 値」を1行ずつ並べる形だけに対応（research/README.md の書き方）．
"""
import functools
import html
import http.server
import json
import pathlib
import re
import sys
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
    return re.sub(r'\{\{ page\["([^"]+)"\] \| escape \}\}',
                  lambda m: html.escape(str(data.get(m.group(1)) or "")), text)


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


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
    handler = functools.partial(Handler, directory=str(ROOT))
    # Windows では同じポートで2つ目のサーバーが起動できてしまい，古い方が応答し続けることがあるので禁止する
    http.server.ThreadingHTTPServer.allow_reuse_address = False
    try:
        server = http.server.ThreadingHTTPServer(("localhost", port), handler)
    except OSError:
        sys.exit(f"ポート {port} は使用中です．前に起動したプレビューを Ctrl+C で止めるか，別のポートを指定してください（例 python tools/preview.py 4001）．")
    print(f"http://localhost:{port}/ で確認できます（Ctrl+C で終了）", flush=True)
    server.serve_forever()
