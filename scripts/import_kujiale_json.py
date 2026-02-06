#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import glob
import json
import os
import sys
from typing import Any, Dict, Iterable, List, Tuple

try:
    import psycopg2
    from psycopg2.extras import execute_values
except Exception as exc:  # pragma: no cover - runtime dependency
    psycopg2 = None
    execute_values = None


COLUMNS: Tuple[str, ...] = (
    "nation_id",
    "nation_name",
    "state_id",
    "state_name",
    "city_id",
    "city_name",
    "region_id",
    "region_name",
    "obs_community_id",
    "comm_name",
    "obs_plan_id",
    "obs_design_id",
    "is_bim",
    "name",
    "build_area",
    "use_area",
    "specs_info",
    "public_type",
    "update_time",
    "room",
    "image_url_encoded",
    "image_url_decoded",
    "without_dimension_line_encoded",
    "without_dimension_line_decoded",
    "wall_center_line_encoded",
    "wall_center_line_decoded",
    "inside_the_wall_encoded",
    "inside_the_wall_decoded",
)


def iter_json_files(base_dir: str) -> Iterable[str]:
    pattern = os.path.join(base_dir, "**", "start_*.json")
    for path in glob.iglob(pattern, recursive=True):
        if os.path.isfile(path):
            yield path


def load_rows(path: str) -> List[Tuple[Any, ...]]:
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    room_value = None
    if isinstance(payload, dict):
        room_value = payload.get("room")

    if isinstance(payload, dict) and isinstance(payload.get("list"), list):
        items = payload["list"]
    elif isinstance(payload, list):
        items = payload
    else:
        return []

    rows: List[Tuple[Any, ...]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        image_url_decoded = item.get("imageUrlDecoded") or {}
        without_dimension_line_decoded = item.get("withoutDimensionLineDecoded") or {}
        wall_center_line_decoded = item.get("wallCenterLineDecoded") or {}
        inside_the_wall_decoded = item.get("insideTheWallDecoded") or {}
        row = (
            item.get("nationId"),
            item.get("nationName"),
            item.get("stateId"),
            item.get("stateName"),
            item.get("cityId"),
            item.get("cityName"),
            item.get("regionId"),
            item.get("regionName"),
            item.get("obsCommunityId"),
            item.get("commName"),
            item.get("obsPlanId"),
            item.get("obsDesignId"),
            item.get("isBim"),
            item.get("name"),
            item.get("buildArea"),
            item.get("useArea"),
            item.get("specsInfo"),
            item.get("publicType"),
            item.get("updateTime"),
            room_value if room_value is not None else item.get("room"),
            image_url_decoded.get("encoded"),
            image_url_decoded.get("decoded"),
            without_dimension_line_decoded.get("encoded"),
            without_dimension_line_decoded.get("decoded"),
            wall_center_line_decoded.get("encoded"),
            wall_center_line_decoded.get("decoded"),
            inside_the_wall_decoded.get("encoded"),
            inside_the_wall_decoded.get("decoded"),
        )
        rows.append(row)
    return rows


def connect_db(host: str, port: int, user: str, password: str, dbname: str):
    if psycopg2 is None:
        raise RuntimeError(
            "psycopg2 is not installed. Install with: pip install psycopg2-binary"
        )
    return psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname=dbname,
    )


def insert_rows(conn, rows: List[Tuple[Any, ...]]):
    if not rows:
        return 0
    if execute_values is None:
        raise RuntimeError(
            "psycopg2 extras not available. Install with: pip install psycopg2-binary"
        )
    with conn.cursor() as cur:
        sql = f"INSERT INTO properties ({', '.join(COLUMNS)}) VALUES %s"
        execute_values(cur, sql, rows, page_size=1000)
    return len(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Kujiale JSON data into Postgres.")
    parser.add_argument("--base-dir", default="downloads/kujiale/json", help="JSON base dir")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--password", default="postgres")
    parser.add_argument("--db", default="chaodapei")
    args = parser.parse_args()

    base_dir = os.path.abspath(args.base_dir)
    if not os.path.isdir(base_dir):
        print(f"Base dir not found: {base_dir}", file=sys.stderr)
        return 1

    json_files = list(iter_json_files(base_dir))
    if not json_files:
        print(f"No json files found under: {base_dir}", file=sys.stderr)
        return 1

    conn = connect_db(args.host, args.port, args.user, args.password, args.db)
    inserted_total = 0
    try:
        for path in sorted(json_files):
            rows = load_rows(path)
            if not rows:
                continue
            inserted = insert_rows(conn, rows)
            inserted_total += inserted
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"Imported rows: {inserted_total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
