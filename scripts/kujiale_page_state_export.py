#!/usr/bin/env python3
import argparse
import json
import logging
import re
import time
import shutil
import subprocess
from pathlib import Path

import wasmtime
from playwright.sync_api import sync_playwright

CITY_CODES = {
    "北京市": "36",
    "上海市": "39",
    "广州市": "289",
    "深圳市": "291",
}

DEV_NAMES = ["华润", "中海", "万科"]


# --- decode helpers (from decode_image_url.py) ---

def load_wasm(wasm_path: Path):
    engine = wasmtime.Engine()
    module = wasmtime.Module.from_file(engine, str(wasm_path))

    def abort(a, b, c, d):
        return None

    store = wasmtime.Store(engine)
    linker = wasmtime.Linker(engine)
    abort_type = wasmtime.FuncType(
        [
            wasmtime.ValType.i32(),
            wasmtime.ValType.i32(),
            wasmtime.ValType.i32(),
            wasmtime.ValType.i32(),
        ],
        [],
    )
    linker.define(store, "env", "abort",
                  wasmtime.Func(store, abort_type, abort))

    instance = linker.instantiate(store, module)
    exports = instance.exports(store)
    return store, exports


def write_string(store, exports, s: str) -> int:
    mem = exports["memory"]
    new = exports["__new"]
    data = s.encode("utf-16le")
    ptr = new(store, len(data), 1)
    mem.write(store, data, ptr)
    return ptr


def read_string(store, exports, ptr: int) -> str:
    mem = exports["memory"]
    size_bytes = mem.read(store, ptr - 4, ptr)
    size = int.from_bytes(size_bytes, "little")
    data = mem.read(store, ptr, ptr + size)
    return data.decode("utf-16le")


def decode_image_url(store, exports, encoded: str) -> str:
    if not encoded:
        return ""
    if re.search(r"\.jpg|\.png|\.webp", encoded, re.I):
        return encoded
    decode_from_string = exports["decodeFromString"]
    in_ptr = write_string(store, exports, encoded)
    out_ptr = decode_from_string(store, in_ptr)
    return read_string(store, exports, out_ptr)


def to_992(url: str) -> str:
    if not url:
        return ""
    if "imageMogr2/thumbnail/" in url:
        return re.sub(
            r"imageMogr2/thumbnail/\d+x\d+!",
            "imageMogr2/thumbnail/992x992!",
            url,
        )
    if "-cos" in url:
        return url + "?imageMogr2/thumbnail/992x992!"
    return url


def encode_dev_name(name: str) -> str:
    if len(name) != 2:
        raise ValueError("仅支持2个汉字")
    utf16_bytes = name.encode("utf-16be")
    hex_str = utf16_bytes.hex()
    return f"{hex_str[:4]}-{hex_str[4:]}"


def build_url(city_code: str, dev_code: str, start: int, num: int) -> str:
    return (
        f"https://www.kujiale.cn/huxing/result/{city_code}-{dev_code}-0-0"
        f"?num={num}&start={start}"
    )


def load_progress(path: Path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_progress(path: Path, data: dict):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    tmp.replace(path)


def scroll_to_bottom(page, max_rounds=8, pause_ms=600):
    try:
        last_height = page.evaluate("document.body.scrollHeight")
    except Exception:
        return
    for _ in range(max_rounds):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(pause_ms)
        new_height = page.evaluate("document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height


def wait_for_page_state(page, timeout_ms=30000, poll_ms=500):
    deadline = time.time() + (timeout_ms / 1000.0)
    while time.time() < deadline:
        try:
            state = page.evaluate("() => window.__PAGE_STATE__ || null")
        except Exception:
            state = None
        if state:
            return state
        page.wait_for_timeout(poll_ms)
    return None




def wait_for_rendered_list(page, timeout_ms=45000, poll_ms=800, stable_rounds=3):
    """Wait until searchResult.list appears and stabilizes."""
    deadline = time.time() + (timeout_ms / 1000.0)
    last_len = None
    stable = 0
    while time.time() < deadline:
        try:
            data = page.evaluate('''() => {
                const s = window.__PAGE_STATE__?.info?.searchResult;
                if (!s) return null;
                return {
                    total: s.total || 0,
                    num: s.num || 0,
                    start: s.start || 0,
                    len: Array.isArray(s.list) ? s.list.length : 0
                };
            }''')
        except Exception:
            data = None
        if data:
            total = int(data.get("total") or 0)
            num = int(data.get("num") or 0)
            start = int(data.get("start") or 0)
            length = int(data.get("len") or 0)

            if length > 0:
                if last_len == length:
                    stable += 1
                else:
                    stable = 1
                last_len = length

                if num > 0 and length >= num:
                    return True
                if stable >= stable_rounds:
                    return True

                if total > 0 and num > 0:
                    remaining = max(total - start, 0)
                    if remaining and length >= min(num, remaining):
                        return True
        page.wait_for_timeout(poll_ms)
    return False



def start_caffeinate(logger):
    if shutil.which("caffeinate") is None:
        logger.warning("caffeinate not found; sleep prevention not enabled")
        return None
    try:
        proc = subprocess.Popen(["caffeinate", "-dimsu"])
        logger.info("Started caffeinate to prevent sleep (pid=%s)", proc.pid)
        return proc
    except Exception as e:
        logger.warning("Failed to start caffeinate: %s", e)
        return None


def stop_caffeinate(proc, logger):
    if not proc:
        return
    try:
        proc.terminate()
        proc.wait(timeout=5)
        logger.info("Stopped caffeinate")
    except Exception as e:
        logger.warning("Failed to stop caffeinate: %s", e)

def setup_logger(log_path: Path):
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("kujiale_page_state")
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
    parser.add_argument("--out", default="./downloads/kujiale/json")
    parser.add_argument("--num", type=int, default=100, help="每页条数")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--manual-login", action="store_true")
    parser.add_argument("--user-data-dir",
                        default="./downloads/kujiale/profile")
    parser.add_argument(
        "--wasm-file",
        default="/Users/hummingbird/Develop/anjuke-demo/scripts/optimized.wasm",
    )
    args = parser.parse_args()

    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)
    logger = setup_logger(out_root / "logs" / "kujiale_page_state.log")
    progress_path = out_root / "progress.json"
    progress = load_progress(progress_path)

    wasm_path = Path(args.wasm_file)
    if not wasm_path.exists():
        raise FileNotFoundError(f"optimized.wasm not found: {wasm_path}")
    store, exports = load_wasm(wasm_path)

    caffeinate_proc = start_caffeinate(logger)

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
                page.goto("https://www.kujiale.cn",
                          wait_until="domcontentloaded", timeout=90000)
            except Exception as e:
                logger.warning("Initial login page failed: %s", e)
            logger.info(
                "Please log in in the opened browser, then press Enter to continue.")
            input()

        for city_name, city_code in CITY_CODES.items():
            for dev_name in DEV_NAMES:
                dev_code = encode_dev_name(dev_name)
                key = f"{city_name}|{dev_name}"
                state = progress.get(key, {})
                if state.get("completed"):
                    logger.info("Skip completed: %s %s", city_name, dev_name)
                    continue

                start = int(state.get("start", 0))

                # First page to fetch total/num
                first_url = build_url(city_code, dev_code, start, args.num)
                try:
                    page.goto(
                        first_url, wait_until="domcontentloaded", timeout=90000)
                except Exception as e:
                    logger.warning("Goto failed: %s (%s)", first_url, e)
                scroll_to_bottom(page)
                page_state = wait_for_page_state(page, timeout_ms=30000)
                wait_for_rendered_list(page, timeout_ms=45000)
                time.sleep(15)
                if not page_state:
                    logger.warning("No __PAGE_STATE__ for %s", first_url)
                    progress[key] = {"start": start, "completed": True}
                    save_progress(progress_path, progress)
                    continue

                info = page_state.get("info") or {}
                search_result = info.get("searchResult") or {}
                total = int(search_result.get("total") or 0)
                num = int(search_result.get("num") or args.num)

                if total <= 0:
                    logger.info("Total is 0 for %s %s; will continue until empty list",
                                city_name, dev_name)

                start_page = start // num
                page_idx = start_page

                empty_streak = int(state.get("empty_streak", 0))

                while True:
                    start = page_idx * num
                    if total > 0 and start >= total:
                        break

                    url = build_url(city_code, dev_code, start, num)
                    try:
                        page.goto(url, wait_until="domcontentloaded",
                                  timeout=90000)
                    except Exception as e:
                        logger.warning("Goto failed: %s (%s)", url, e)
                    scroll_to_bottom(page)
                    page_state = wait_for_page_state(page, timeout_ms=30000)
                    wait_for_rendered_list(page, timeout_ms=45000)
                    time.sleep(15)
                    if not page_state:
                        logger.warning("No __PAGE_STATE__ for %s", url)
                        page_idx += 1
                        continue

                    info = page_state.get("info") or {}
                    search_result = info.get("searchResult") or {}
                    items = search_result.get("list") or []
                    if not items:
                        empty_streak += 1
                        logger.info("Empty list at %s %s start=%s (streak=%s)",
                                    city_name, dev_name, start, empty_streak)
                        progress[key] = {
                            "start": start,
                            "completed": False,
                            "empty_streak": empty_streak,
                        }
                        save_progress(progress_path, progress)
                        if empty_streak >= 1:
                            logger.info("Empty list 2 pages in a row; stop this condition")
                            progress[key] = {"start": start, "completed": True}
                            save_progress(progress_path, progress)
                            break
                        page_idx += 1
                        continue

                    empty_streak = 0

                    out_dir = out_root / city_name / dev_name
                    out_dir.mkdir(parents=True, exist_ok=True)
                    out_path = out_dir / f"start_{start}.json"
                    if out_path.exists():
                        logger.info("Exists, skip: %s", out_path)
                        page_idx += 1
                        continue

                    out_items = []
                    for item in items:
                        def decode_field(key):
                            val = item.get(key) or ""
                            decoded = decode_image_url(store, exports, val)
                            decoded = to_992(decoded)
                            return {
                                "encoded": val,
                                "decoded": decoded,
                            }

                        out = dict(item)
                        out["imageUrlDecoded"] = decode_field("imageUrl")
                        out["withoutDimensionLineDecoded"] = decode_field(
                            "withoutDimensionLine")
                        out["wallCenterLineDecoded"] = decode_field(
                            "wallCenterLine")
                        out["insideTheWallDecoded"] = decode_field(
                            "insideTheWall")
                        out_items.append(out)

                    payload = {
                        "cityName": city_name,
                        "cityId": city_code,
                        "developer": dev_name,
                        "developerCode": dev_code,
                        "total": total,
                        "num": num,
                        "start": start,
                        "list": out_items,
                    }
                    out_path.write_text(json.dumps(
                        payload, ensure_ascii=False, indent=2))

                    logger.info(
                        "Saved %s items to %s (total=%s)",
                        len(out_items),
                        out_path,
                        total,
                    )

                    progress[key] = {
                        "start": (page_idx + 1) * num, "completed": False}
                    save_progress(progress_path, progress)

                    page_idx += 1

                progress[key] = {"start": page_idx * num, "completed": True, "empty_streak": 0}
                save_progress(progress_path, progress)

        context.close()


if __name__ == "__main__":
    main()
