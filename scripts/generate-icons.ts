/**
 * PWA アイコン（PNG）を生成する。
 *
 * 「ホーム画面に追加」で アプリ扱いされるには 192px 以上の PNG アイコンが要る。
 * ここで生成した PNG は public/ に commit するので、通常のビルドでは動かない。
 * デザインを変えたときだけ `npm run icons` を実行する。
 *
 * 画像ライブラリ（sharp / canvas）は入れない。ネイティブ依存は GitHub Actions の
 * ビルド時間とキャッシュを重くするだけで、この単純な図形には過剰なため、
 * zlib だけで PNG を直接書き出す。
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// ── PNG エンコーダ（8bit RGBA / 非インターレース） ──────────────────────

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** RGBA バイト列（size×size×4）を PNG にする */
function encodePng(size: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolor + alpha
  // 10,11,12 = compression / filter / interlace（すべて 0 が標準）

  // 各スキャンラインの先頭にフィルタ種別バイト(0 = None)を付ける
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── 描画（角丸長方形の SDF + スーパーサンプリング） ─────────────────────

type Rgb = [number, number, number];

/** 角丸長方形の符号付き距離。負なら内側。座標は 0..1 の正規化空間 */
function roundedRectSdf(
  x: number,
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
): number {
  const hw = (x1 - x0) / 2;
  const hh = (y1 - y0) / 2;
  const px = Math.abs(x - (x0 + hw)) - (hw - r);
  const py = Math.abs(y - (y0 + hh)) - (hh - r);
  const outside = Math.hypot(Math.max(px, 0), Math.max(py, 0));
  return outside + Math.min(Math.max(px, py), 0) - r;
}

type Shape = { x0: number; y0: number; x1: number; y1: number; r: number; color: Rgb };

const hex = (value: string): Rgb => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

const BG = hex("#0e0e11");
const TILE = hex("#fafafa");
const ACCENT = hex("#60a5fa");

/**
 * ダッシュボード記号（4枚のタイル）。lucide の LayoutDashboard に合わせてあり、
 * ヘッダーのアイコンと同じ形になる。座標は 0..1。
 */
const GLYPH: Omit<Shape, "color">[] = [
  { x0: 0.0, y0: 0.0, x1: 0.44, y1: 0.6, r: 0.07 },
  { x0: 0.56, y0: 0.0, x1: 1.0, y1: 0.32, r: 0.07 },
  { x0: 0.56, y0: 0.44, x1: 1.0, y1: 1.0, r: 0.07 },
  { x0: 0.0, y0: 0.72, x1: 0.44, y1: 1.0, r: 0.07 },
];

/**
 * @param scale     アイコン全体に対する記号の大きさ（マスカブルは安全域に収めるため小さく）
 * @param bgRadius  背景の角丸。1 に近いほど丸い。マスカブルは OS 側が切り抜くので全面塗り
 */
function render(size: number, scale: number, bgRadius: number): Uint8Array {
  const pixels = new Uint8Array(size * size * 4);
  const shapes: Shape[] = GLYPH.map((g, i) => ({
    ...g,
    // 左上の大きいタイルだけアクセント色。単色よりホーム画面で見分けやすい
    color: i === 0 ? ACCENT : TILE,
    x0: 0.5 + (g.x0 - 0.5) * scale,
    y0: 0.5 + (g.y0 - 0.5) * scale,
    x1: 0.5 + (g.x1 - 0.5) * scale,
    y1: 0.5 + (g.y1 - 0.5) * scale,
    r: g.r * scale,
  }));

  const SAMPLES = 4; // 1ピクセルを 4×4 で評価してアンチエイリアスする
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / size;
          const y = (py + (sy + 0.5) / SAMPLES) / size;

          // 背景（角丸の外は透明）
          let [cr, cg, cb] = BG;
          let ca = roundedRectSdf(x, y, 0, 0, 1, 1, bgRadius) < 0 ? 1 : 0;

          // 記号を上から重ねる
          for (const shape of shapes) {
            if (roundedRectSdf(x, y, shape.x0, shape.y0, shape.x1, shape.y1, shape.r) < 0) {
              [cr, cg, cb] = shape.color;
              ca = 1;
            }
          }

          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }

      const total = SAMPLES * SAMPLES;
      const i = (py * size + px) * 4;
      // 色は「不透明だったサンプルの平均」。ここで a で割らないと縁が黒ずむ
      pixels[i] = a > 0 ? Math.round(r / a) : 0;
      pixels[i + 1] = a > 0 ? Math.round(g / a) : 0;
      pixels[i + 2] = a > 0 ? Math.round(b / a) : 0;
      pixels[i + 3] = Math.round((a / total) * 255);
    }
  }

  return pixels;
}

// ── 出力 ────────────────────────────────────────────────────────────────

const outDir = path.join(process.cwd(), "public", "icons");
mkdirSync(outDir, { recursive: true });

const targets = [
  // 通常アイコン（purpose: any）。角丸の絵柄をそのまま表示される前提
  { file: path.join(outDir, "icon-192.png"), size: 192, scale: 0.56, radius: 0.22 },
  { file: path.join(outDir, "icon-512.png"), size: 512, scale: 0.56, radius: 0.22 },
  // マスカブル（purpose: maskable）。OS が任意の形に切り抜くので全面塗り＋安全域を確保
  { file: path.join(outDir, "maskable-512.png"), size: 512, scale: 0.42, radius: 0 },
  // iOS のホーム画面用。角丸は iOS 側が付けるので四角のまま
  { file: path.join(process.cwd(), "public", "apple-touch-icon.png"), size: 180, scale: 0.5, radius: 0 },
];

for (const { file, size, scale, radius } of targets) {
  writeFileSync(file, encodePng(size, render(size, scale, radius)));
  console.log(`[icons] ${path.relative(process.cwd(), file)} (${size}px)`);
}
