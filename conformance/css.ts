/**
 * その部品が実際に読み込む CSS を集める。
 *
 * 図の束では CSS が部品ごとに一枚ではない(外枠は internal/frame.css が持ち、折れ線と面は
 * internal/LineArea.svelte を経由する)。かといって internal を丸ごと見ると、その部品が読んでいない
 * CSS まで数えてしまう(小さな線が円の CSS の字の役を要求される、という誤りが出た)。
 * だから import を辿る。
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** 副作用の import('./x.css') と、既定の import(from './X.svelte') の両方を拾う。 */
const IMPORT = /(?:from\s+|import\s+)['"]([^'"]+\.(?:css|svelte))['"]/g;

function walk(file: string, seen: Set<string>, css: string[]): void {
  if (seen.has(file) || !existsSync(file)) return;
  seen.add(file);
  if (file.endsWith('.css')) {
    css.push(readFileSync(file, 'utf-8'));
    return;
  }
  const text = readFileSync(file, 'utf-8');
  for (const match of text.matchAll(IMPORT)) {
    walk(resolve(dirname(file), match[1]!), seen, css);
  }
}

/** 部品(src/lib/<name>/<name>.svelte)から辿れる CSS をすべて連ねて返す。 */
export function cssFor(lib: string, name: string): string {
  const css: string[] = [];
  walk(join(lib, name, `${name}.svelte`), new Set(), css);
  return css.join('\n');
}
