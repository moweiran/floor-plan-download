#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const wasmPath = path.join(__dirname, 'optimized.wasm');

function loadWasmSync() {
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`optimized.wasm not found at ${wasmPath}`);
  }
  const bytes = fs.readFileSync(wasmPath);
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
    env: {
      abort() {},
    },
  });
  return instance.exports;
}

function writeString(exports, str) {
  const { memory, __new } = exports;
  const buf = Buffer.from(str, 'utf16le');
  const ptr = __new(buf.length, 1);
  new Uint8Array(memory.buffer, ptr, buf.length).set(buf);
  return ptr;
}

function readString(exports, ptr) {
  const { memory } = exports;
  const size = new DataView(memory.buffer).getUint32(ptr - 4, true);
  const bytes = new Uint8Array(memory.buffer, ptr, size);
  return Buffer.from(bytes).toString('utf16le');
}

function decodeWithWasm(exports, encoded) {
  if (!encoded) return '';
  if (/\.jpg|\.png|\.webp/i.test(encoded)) return encoded;
  const { decodeFromString } = exports;
  const inPtr = writeString(exports, encoded);
  const outPtr = decodeFromString(inPtr);
  return readString(exports, outPtr);
}

function to992(url) {
  if (!url) return '';
  if (url.includes('imageMogr2/thumbnail/')) {
    return url.replace(/imageMogr2\/thumbnail\/\d+x\d+!/, 'imageMogr2/thumbnail/992x992!');
  }
  if (url.includes('-cos')) {
    return `${url}?imageMogr2/thumbnail/992x992!`;
  }
  return url;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node decode_image_url.js <encoded>');
    process.exit(1);
  }
  const exports = loadWasmSync();
  const encoded = args.join(' ');
  const decoded = decodeWithWasm(exports, encoded);
  console.log(to992(decoded));
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
