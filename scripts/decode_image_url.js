#!/usr/bin/env node
const fs = require('fs');

const wasmUrl = 'https://qhstaticssl.kujiale.com/application/wasm/optimized.wasm';

async function loadWasm() {
  const res = await fetch(wasmUrl);
  if (!res.ok) throw new Error(`Failed to fetch wasm: ${res.status}`);
  const bytes = await res.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports;
}

function decodeWithWasm(exports, encoded) {
  if (!encoded) return '';
  if (/\.jpg|\.png|\.webp/i.test(encoded)) return encoded;
  const { decodeFromString, __newString, __getString } = exports;
  return __getString(decodeFromString(__newString(encoded)));
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

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node decode_image_url.js <encoded> | --file <jsonfile>');
    process.exit(1);
  }

  const exports = await loadWasm();

  if (args[0] === '--file') {
    const file = args[1];
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    const encoded = data.imageUrl;
    const decoded = decodeWithWasm(exports, encoded);
    console.log(to992(decoded));
    return;
  }

  const encoded = args.join(' ');
  const decoded = decodeWithWasm(exports, encoded);
  console.log(to992(decoded));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
