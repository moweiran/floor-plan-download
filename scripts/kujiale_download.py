#!/usr/bin/env python3
import argparse
import hashlib
import json
import logging
import re
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

IMG_RE = re.compile(
    r"https?://[^\s\"')]+?\.(?:jpe?g|png|webp)(?:\?[^\s\"')]+)?",
    re.IGNORECASE,
)

CITY_CODES = {
    "北京市": "36",
    "上海市": "39",
    "广州市": "289",
    "深圳市": "291",
}

DEV_NAMES = ["华润", "中海", "万科"]


def encode_dev_name(name: str) -> str:
    """开发商名称 → UTF-16BE十六进制编码"""
    if len(name) != 2:
        raise ValueError("仅支持2个汉字")
    utf16_bytes = name.encode("utf-16be")
    hex_str = utf16_bytes.hex()
    return f"{hex_str[:4]}-{hex_str[4:]}"


def download_image(url, out_dir: Path, seen, request_context):
    ext = Path(url.split("?", 1)[0]).suffix or ".jpg"
    name_hash = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    filename = f"{name_hash}{ext}"
    if filename in seen:
        return False
    out_path = out_dir / filename
    if out_path.exists():
        seen.add(filename)
        return False
    resp = request_context.get(url, timeout=30000)
    if not resp.ok:
        raise RuntimeError(f"HTTP {resp.status}")
    out_path.write_bytes(resp.body())
    seen.add(filename)
    return True


def get_result_total(page):
    try:
        text = page.locator("span.resultTotal").first.text_content() or ""
    except Exception:
        text = ""
    text = text.strip()
    if not text:
        return 0, False
    is_plus = "+" in text
    digits = re.findall(r"\d+", text)
    if not digits:
        return 0, is_plus
    return int(digits[0]), is_plus


def build_url(city_code: str, dev_code: str, start: int, num: int) -> str:
    return (
        f"https://www.kujiale.cn/huxing/result/{city_code}-{dev_code}-0-0"
        f"?num={num}&start={start}"
    )


def load_progress(path: Path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def save_progress(path: Path, data: dict):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    tmp.replace(path)


def setup_logger(log_path: Path):
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("kujiale")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    logger.addHandler(sh)
    return logger


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="./downloads/kujiale")
    parser.add_argument("--num", type=int, default=50, help="每页条数")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--manual-login", action="store_true")
    parser.add_argument("--user-data-dir", default="./downloads/kujiale/profile")
    args = parser.parse_args()

    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)

    logger = setup_logger(out_root / "logs" / "kujiale_download.log")
    progress_path = out_root / "progress.json"
    progress = load_progress(progress_path)

    with sync_playwright() as p:
        if args.manual_login:
            context = p.chromium.launch_persistent_context(
                args.user_data_dir, headless=False
            )
        else:
            browser = p.chromium.launch(headless=args.headless)
            context = browser.new_context()

        page = context.new_page()

        if args.manual_login:
            try:
                page.goto("https://www.kujiale.cn", wait_until="domcontentloaded", timeout=90000)
            except Exception as e:
                logger.warning("Initial login page failed: %s", e)
                try:
                    page.goto("about:blank")
                except Exception:
                    pass
            logger.info("Please log in in the opened browser, then press Enter to continue.")
            input()

        for city_name, city_code in CITY_CODES.items():
            for dev_name in DEV_NAMES:
                key = f"{city_name}|{dev_name}"
                state = progress.get(key, {})
                if state.get("completed"):
                    logger.info("Skip completed: %s %s", city_name, dev_name)
                    continue

                dev_code = encode_dev_name(dev_name)
                out_dir = out_root / city_name / dev_name
                out_dir.mkdir(parents=True, exist_ok=True)

                collected = set()
                downloaded = set()

                total = None
                start = int(state.get("start", 0))
                page_idx = start // args.num + 1
                empty_streak = 0

                while True:
                    url = build_url(city_code, dev_code, start, args.num)

                    def on_request(req):
                        try:
                            if req.resource_type != "image":
                                return
                        except Exception:
                            return
                        if IMG_RE.search(req.url):
                            collected.add(req.url)

                    page.on("request", on_request)
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=90000)
                    except Exception as e:
                        logger.warning("Goto failed: %s (%s)", url, e)
                    time.sleep(2.5)
                    page.off("request", on_request)

                    if total is None:
                        total_val, is_plus = get_result_total(page)
                        if total_val == 0 and not is_plus:
                            logger.info("No results for %s %s", city_name, dev_name)
                            progress[key] = {"start": start, "completed": True}
                            save_progress(progress_path, progress)
                            break
                        if is_plus:
                            total = None
                        else:
                            total = total_val

                    new_urls = list(collected)
                    collected.clear()

                    if not new_urls:
                        empty_streak += 1
                    else:
                        empty_streak = 0

                    ok = 0
                    for img_url in new_urls:
                        try:
                            if download_image(img_url, out_dir, downloaded, page.request):
                                ok += 1
                        except Exception as e:
                            logger.warning("Download failed: %s (%s)", img_url, e)

                    logger.info(
                        "[%s/%s] page %s start=%s downloaded=%s empty_streak=%s",
                        city_name,
                        dev_name,
                        page_idx,
                        start,
                        ok,
                        empty_streak,
                    )

                    start += args.num
                    page_idx += 1

                    progress[key] = {"start": start, "completed": False}
                    save_progress(progress_path, progress)

                    if total is not None and start >= total:
                        progress[key] = {"start": start, "completed": True}
                        save_progress(progress_path, progress)
                        break

                    if empty_streak >= 2:
                        logger.info("Stop due to empty pages for %s %s", city_name, dev_name)
                        progress[key] = {"start": start, "completed": True}
                        save_progress(progress_path, progress)
                        break

        context.close()


if __name__ == "__main__":
    main()
