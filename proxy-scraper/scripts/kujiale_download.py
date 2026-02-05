#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import time
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


IMG_RE = re.compile(
    r"https?://[^\s\"')]+?\.(?:jpe?g|png|webp)(?:\?[^\s\"')]+)?",
    re.IGNORECASE,
)

KUJIALE_IMG_HOSTS = (
    "fphimage-cos.kujiale.com",
    "fphimage.kujiale.com",
    "kujiale.com",
)


def extract_images_from_json(obj, out):
    if isinstance(obj, dict):
        for v in obj.values():
            extract_images_from_json(v, out)
        return
    if isinstance(obj, list):
        for v in obj:
            extract_images_from_json(v, out)
        return
    if isinstance(obj, str):
        for m in IMG_RE.findall(obj):
            out.add(m)


def extract_images_from_dom(page, out):
    attrs = ["src", "data-src", "data-original", "data-lazy", "data-srcset", "srcset"]
    for attr in attrs:
        locator = page.locator(f"img[{attr}]")
        count = locator.count()
        for i in range(count):
            val = locator.nth(i).get_attribute(attr) or ""
            for m in IMG_RE.findall(val):
                out.add(m)


def extract_images_from_response(resp, out):
    url = resp.url
    ct = resp.headers.get("content-type", "").lower()
    # Add any direct image responses (e.g., canvas-backed thumbnails).
    if ct.startswith("image/"):
        out.add(url)
        return
    # Some image URLs arrive without image content-type; capture known host patterns.
    if any(h in url for h in KUJIALE_IMG_HOSTS) and IMG_RE.search(url):
        out.add(url)


def download_image(url, out_dir, seen, request_context=None):
    parsed = urlparse(url)
    ext = Path(parsed.path).suffix or ".jpg"
    name_hash = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    filename = f"{name_hash}{ext}"
    if filename in seen:
        return False
    out_path = out_dir / filename
    if out_path.exists():
        seen.add(filename)
        return False
    if request_context is None:
        raise RuntimeError("request_context required for download")
    resp = request_context.get(url, timeout=30000)
    if not resp.ok:
        raise RuntimeError(f"HTTP {resp.status}")
    out_path.write_bytes(resp.body())
    seen.add(filename)
    return True


def find_next_button(page):
    selectors = [
        "text=下一页",
        "text=下页",
        "text=Next",
        "a[rel='next']",
        "button[rel='next']",
        "a[aria-label*='Next']",
        "button[aria-label*='Next']",
    ]
    for sel in selectors:
        loc = page.locator(sel)
        if loc.count() > 0:
            btn = loc.first
            if btn.is_enabled():
                return btn
    return None


def scroll_to_bottom(page, max_rounds=8, pause=1.2):
    last_height = page.evaluate("document.body.scrollHeight")
    rounds = 0
    while rounds < max_rounds:
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(pause)
        new_height = page.evaluate("document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height
        rounds += 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--out", default="./downloads/kujiale")
    parser.add_argument("--max-pages", type=int, default=200)
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--user-data-dir", default="./downloads/kujiale/profile")
    parser.add_argument(
        "--manual-login",
        action="store_true",
        help="Open a persistent browser and wait for manual login before scraping.",
    )
    parser.add_argument(
        "--media-only",
        action="store_true",
        help="Only collect from network responses whose resource type is image.",
    )
    parser.add_argument(
        "--debug-log",
        action="store_true",
        help="Write response URLs and resource type counts for debugging.",
    )
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    all_images = set()
    downloaded = set()

    with sync_playwright() as p:
        if args.manual_login:
            context = p.chromium.launch_persistent_context(
                args.user_data_dir, headless=False
            )
            page = context.new_page()
        else:
            browser = p.chromium.launch(headless=args.headless)
            page = browser.new_page()
        type_counts = Counter()
        debug_file = None
        if args.debug_log:
            debug_file = (out_dir / "response_urls.txt").open("w", encoding="utf-8")

        def on_request(req):
            try:
                rtype = req.resource_type
            except Exception:
                rtype = "unknown"
            type_counts[rtype] += 1
            if args.media_only and rtype == "image":
                if debug_file:
                    debug_file.write(f"{req.url}\n")
                all_images.add(req.url)
            elif debug_file and not args.media_only:
                debug_file.write(f"{rtype}\t{req.url}\n")

        def on_response(resp):
            print(f"{resp.status} {resp.url}")
            try:
                rtype = resp.request.resource_type
            except Exception:
                rtype = "unknown"
            type_counts[rtype] += 1
            if debug_file and not args.media_only:
                debug_file.write(f"{rtype}\t{resp.url}\n")

            if args.media_only:
                try:
                    if resp.request.resource_type != "image":
                        return
                except Exception:
                    return
                # In practice some "Img" responses may miss image content-type,
                # so also accept URL patterns from known image hosts.
                extract_images_from_response(resp, all_images)
                return

            extract_images_from_response(resp, all_images)
            ct = resp.headers.get("content-type", "")
            if "application/json" in ct:
                try:
                    data = resp.json()
                except Exception:
                    return
                extract_images_from_json(data, all_images)

        page.on("request", on_request)
        page.on("response", on_response)
        try:
            page.goto(args.url, wait_until="domcontentloaded", timeout=90000)
        except Exception as e:
            print(f"Initial goto timed out: {e}")
            # Keep browser open; proceed to allow manual interaction if possible.
            try:
                page.wait_for_timeout(5000)
            except Exception:
                pass
        if args.manual_login:
            print("Please log in in the opened browser, then press Enter here to continue.")
            input()
        # Some canvas-based sites fetch images after a delay.
        time.sleep(3)

        no_new_pages = 0
        for page_idx in range(1, args.max_pages + 1):
            before = len(all_images)
            extract_images_from_dom(page, all_images)
            scroll_to_bottom(page)
            extract_images_from_dom(page, all_images)
            after = len(all_images)

            new_count = after - before
            print(f"[page {page_idx}] found {new_count} new image urls, total {after}")

            if new_count == 0:
                no_new_pages += 1
            else:
                no_new_pages = 0

            if no_new_pages >= 2:
                print("No new images for 2 pages; stopping.")
                break

            next_btn = find_next_button(page)
            if not next_btn:
                print("No next page button found; stopping.")
                break
            next_btn.click()
            page.wait_for_load_state("networkidle")

        print("Response type counts:", dict(type_counts))
        if debug_file:
            debug_file.close()

        print(f"Total image URLs collected: {len(all_images)}")

        ok = 0
        for url in sorted(all_images):
            try:
                if download_image(url, out_dir, downloaded, page.request):
                    ok += 1
            except Exception as e:
                print(f"Download failed: {url} ({e})")

        print(f"Downloaded {ok} images to {out_dir}")
        # if args.manual_login:
        #     context.close()
        # else:
        #     browser.close()


if __name__ == "__main__":
    main()
