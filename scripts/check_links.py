# -*- coding: utf-8 -*-
"""
data/ai-tools.json のURLをすべて開いて、リンク切れを調べるスクリプト。
GitHub Actions から週1回自動で実行され、結果をGitHubの「Issues」に書き込みます。
"""
import json
import os
import socket
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "data" / "ai-tools.json").read_text(encoding="utf-8"))
ISSUE_TITLE = "🔗 リンク切れチェックの結果"
IGNORE_FILE = ROOT / "scripts" / "link_check_ignore.txt"


def load_ignore():
    """確認済みリスト（link_check_ignore.txt）を読み込む"""
    if not IGNORE_FILE.exists():
        return set()
    names = set()
    for line in IGNORE_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            names.add(line)
    return names

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en;q=0.8",
}

# 404・410 は「ページがない」ので、リンク切れの可能性が高い
BROKEN_STATUS = {404, 410}


def check(tool):
    url = tool["url"]
    last_error = ""
    for _ in range(2):  # 失敗したら1回だけやり直す
        try:
            r = requests.get(url, headers=HEADERS, timeout=25, allow_redirects=True, stream=True)
            r.close()
            final = r.url
            moved = urlparse(final).netloc.replace("www.", "") != urlparse(url).netloc.replace("www.", "")
            if r.status_code < 400:
                return {"tool": tool, "kind": "moved" if moved else "ok", "status": r.status_code, "final": final}
            if r.status_code in BROKEN_STATUS:
                return {"tool": tool, "kind": "broken", "status": r.status_code, "final": final}
            last_error = f"HTTP {r.status_code}"
        except requests.exceptions.ConnectionError as e:
            if isinstance(getattr(e, "__context__", None), socket.gaierror) or "Name or service not known" in str(e) \
                    or "NameResolutionError" in str(e) or "getaddrinfo" in str(e):
                return {"tool": tool, "kind": "broken", "status": "ドメインが見つからない", "final": ""}
            last_error = "接続できない"
        except requests.exceptions.Timeout:
            last_error = "時間切れ"
        except requests.exceptions.SSLError:
            last_error = "SSL（証明書）エラー"
        except Exception as e:  # noqa: BLE001
            last_error = type(e).__name__
    return {"tool": tool, "kind": "check", "status": last_error, "final": ""}


def table(rows, show_final=False):
    head = "| AI名 | 状態 | URL |" + (" 転送先 |" if show_final else "")
    line = "|---|---|---|" + ("---|" if show_final else "")
    body = [f"| {r['tool']['name']} | {r['status']} | {r['tool']['url']} |" + (f" {r['final']} |" if show_final else "")
            for r in rows]
    return "\n".join([head, line, *body])


def main():
    tools = DATA["tools"]
    with ThreadPoolExecutor(max_workers=12) as ex:
        results = list(ex.map(check, tools))

    ignore = load_ignore()
    unknown = sorted(ignore - {t["name"] for t in tools})

    # 確認済みのAIは 🟡・🔵 から外す（🔴 は念のため報告する）
    def listed(r):
        return r["tool"]["name"] in ignore

    broken = [r for r in results if r["kind"] == "broken"]
    suspicious = [r for r in results if r["kind"] == "check" and not listed(r)]
    moved = [r for r in results if r["kind"] == "moved" and not listed(r)]
    skipped = [r for r in results if r["kind"] in ("check", "moved") and listed(r)]
    ok = [r for r in results if r["kind"] == "ok"]

    jst = timezone(timedelta(hours=9))
    now = datetime.now(jst).strftime("%Y年%m月%d日 %H:%M")

    report = [f"**チェック日時：** {now}（全{len(tools)}件）", "",
              f"- 🔴 リンク切れの可能性が高い：**{len(broken)}件**",
              f"- 🟡 開けなかった（要確認）：**{len(suspicious)}件**",
              f"- 🔵 別のサイトに転送された：**{len(moved)}件**",
              f"- 🟢 正常：{len(ok)}件",
              f"- ⚪ 確認済みのため省略：{len(skipped)}件（link_check_ignore.txt に登録済み）", ""]
    if broken:
        report += ["## 🔴 リンク切れの可能性が高い",
                   "ページが見つからない（404など）か、サイトのドメインがなくなっています。URLの修正か、掲載の取りやめを検討してください。", "",
                   table(broken), ""]
    if suspicious:
        report += ["## 🟡 開けなかった（要確認）",
                   "AIサイトの中には、自動チェックのアクセスを拒否するところがあります（403など）。"
                   "**ブラウザで開いて正常に表示されれば問題ありません。**", "",
                   table(suspicious), ""]
    if moved:
        report += ["## 🔵 別のサイトに転送された",
                   "サイトのURLが変わった可能性があります。転送先が正しければ、URLを新しいものに書き換えておくと安心です。", "",
                   table(moved, show_final=True), ""]
    if unknown:
        report += ["## ⚠️ 確認済みリストの名前がデータに見つかりません",
                   "AI名を変えたか、削除した可能性があります。link_check_ignore.txt の名前を直してください。", "",
                   *[f"- {n}" for n in unknown], ""]
    if not (broken or suspicious or moved or unknown):
        report += ["✅ 新しく確認が必要なリンクはありませんでした。"]
    text = "\n".join(report)

    summary_file = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_file:
        with open(summary_file, "a", encoding="utf-8") as f:
            f.write("# リンク切れチェック\n\n" + text)
    print(text)

    report_issue(text, needs_attention=bool(broken or suspicious or moved or unknown))


def report_issue(body, needs_attention):
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not token or not repo:
        return
    api = f"https://api.github.com/repos/{repo}/issues"
    h = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}

    existing = None
    r = requests.get(api, headers=h, params={"state": "open", "per_page": 100}, timeout=30)
    r.raise_for_status()
    for issue in r.json():
        if issue.get("title") == ISSUE_TITLE and "pull_request" not in issue:
            existing = issue
            break

    if needs_attention:
        if existing:
            requests.patch(f"{api}/{existing['number']}", headers=h, json={"body": body}, timeout=30).raise_for_status()
            print(f"Issue #{existing['number']} を更新しました")
        else:
            res = requests.post(api, headers=h, json={"title": ISSUE_TITLE, "body": body}, timeout=30)
            res.raise_for_status()
            print(f"Issue #{res.json()['number']} を作成しました")
    elif existing:
        requests.post(f"{api}/{existing['number']}/comments", headers=h,
                      json={"body": "✅ すべてのリンクが正常でした。このIssueを閉じます。"}, timeout=30).raise_for_status()
        requests.patch(f"{api}/{existing['number']}", headers=h, json={"state": "closed"}, timeout=30).raise_for_status()


if __name__ == "__main__":
    main()
