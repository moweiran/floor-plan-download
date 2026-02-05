#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
import urllib.request
import ssl
import re
import sys

WASM_URL = "https://qhstaticssl.kujiale.com/application/wasm/optimized.wasm"


def fetch_wasm(wasm_url: str, verify_ssl: bool = True):
    ctx = None
    if not verify_ssl:
        ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(wasm_url, context=ctx) as resp:
        return resp.read()




def _default_return(store, wasm_type):
    # Return zero-equivalent for numeric returns, None for void.
    if wasm_type is None:
        return None
    kind = str(wasm_type)
    if kind in ("i32", "i64"):
        return 0
    if kind in ("f32", "f64"):
        return 0.0
    return None


def _make_stub_func(store, func_type):
    def _stub(*args):
        # no-op
        if func_type.results:
            if len(func_type.results) == 1:
                return _default_return(store, func_type.results[0])
            return tuple(_default_return(store, t) for t in func_type.results)
        return None
    return _stub


def instantiate_wasm(wasm_bytes: bytes):
    import wasmtime

    engine = wasmtime.Engine()
    store = wasmtime.Store(engine)
    module = wasmtime.Module(engine, wasm_bytes)

    linker = wasmtime.Linker(engine)
    # Provide stub imports required by the wasm module.
    for imp in module.imports:
        mod = imp.module
        name = imp.name
        itype = imp.type
        if isinstance(itype, wasmtime.FuncType):
            func = wasmtime.Func(store, itype, _make_stub_func(store, itype))
            linker.define(store, mod, name, func)
        elif isinstance(itype, wasmtime.MemoryType):
            mem = wasmtime.Memory(store, itype)
            linker.define(store, mod, name, mem)
        elif isinstance(itype, wasmtime.TableType):
            table = wasmtime.Table(store, itype, wasmtime.Ref.null(itype.element))
            linker.define(store, mod, name, table)
        elif isinstance(itype, wasmtime.GlobalType):
            glob = wasmtime.Global(store, itype, _default_return(store, itype.content))
            linker.define(store, mod, name, glob)
        else:
            # Unknown import type; leave undefined
            pass

    instance = linker.instantiate(store, module)
    exports = instance.exports(store)
    return store, exports


def list_exports(exports):
    return sorted(list(exports))




def _as_new_string(store, exports, s: str) -> int:
    mem = exports["memory"]
    new = exports["__new"]
    # AssemblyScript string id is 1
    ptr = new(store, len(s) * 2, 1)
    data = s.encode("utf-16le")
    mem.write(store, ptr, data)
    return ptr


def _as_get_string(store, exports, ptr: int) -> str:
    mem = exports["memory"]
    size_bytes = int.from_bytes(mem.read(store, ptr - 4, 4), "little")
    data = mem.read(store, ptr, size_bytes)
    return data.decode("utf-16le")


def decode_with_wasm(store, exports, encoded: str) -> str:
    if not encoded:
        return ""
    if re.search(r"\.jpg|\.png|\.webp", encoded, re.I):
        return encoded
    if "decodeFromString" not in exports or "__new" not in exports or "memory" not in exports:
        raise KeyError(f"Missing exports. Available: {list_exports(exports)}")
    decode_from_string = exports["decodeFromString"]
    in_ptr = _as_new_string(store, exports, encoded)
    out_ptr = decode_from_string(store, in_ptr)
    return _as_get_string(store, exports, out_ptr)


def to_992(url: str) -> str:
    if not url:
        return ""
    if "imageMogr2/thumbnail/" in url:
        return re.sub(r"imageMogr2/thumbnail/\d+x\d+!", "imageMogr2/thumbnail/992x992!", url)
    if "-cos" in url:
        return url + "?imageMogr2/thumbnail/992x992!"
    return url


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("encoded", nargs="?", help="encoded imageUrl string")
    parser.add_argument("--file", help="path to JSON file containing imageUrl")
    parser.add_argument("--raw", action="store_true", help="do not force 992x992")
    parser.add_argument("--wasm-file", help="local wasm file path to avoid network fetch")
    parser.add_argument("--no-verify-ssl", action="store_true", help="disable SSL verification when fetching wasm")
    parser.add_argument("--list-exports", action="store_true", help="print wasm exports and exit")
    args = parser.parse_args()

    if not args.encoded and not args.file:
        print("Provide an encoded string or --file JSON.", file=sys.stderr)
        sys.exit(1)

    if args.wasm_file:
        wasm_bytes = Path(args.wasm_file).read_bytes()
    else:
        wasm_bytes = fetch_wasm(WASM_URL, verify_ssl=not args.no_verify_ssl)
    store, exports = instantiate_wasm(wasm_bytes)

    if args.list_exports:
        print("\n".join(list_exports(exports)))
        return

    if args.file:
        data = json.loads(Path(args.file).read_text(encoding="utf-8"))
        encoded = data.get("imageUrl", "")
    else:
        encoded = args.encoded

    decoded = decode_with_wasm(store, exports, encoded)
    if not args.raw:
        decoded = to_992(decoded)
    print(decoded)


if __name__ == "__main__":
    main()
