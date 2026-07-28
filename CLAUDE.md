# CLAUDE.md

このリポジトリで作業するときの前提。

## これは何か

`@stemcell/svelte-charts` は stemcell の図の Svelte 実装である。SVG で描く。決め事は
`@stemcell/charts-core`（隣の `../charts-core`）が持ち、ここで数を決めない。決めたくなったら
core へ、規範なら仕様リポ（`../component-prompts` の `foundations/dataviz.md` と `charts/*.md`）へ戻す。
その記録が `HOLES.md`。

描画のエンジンには依存しない。

## 走らせ方

```sh
bun install
bun run test        # vitest + jsdom
bun run check       # svelte-check
bun run playground  # vite(既定 5173。実物を触る場)
bun run package     # svelte-package
```

jsdom には ResizeObserver が無いので `src/test-setup.ts` が口だけ埋める。jsdom は配置を計算しない
ため、寸法の検査はここではできない。実物は playground と Chromium（`experiments/shot.ts`）で測る。

WSL の Chromium は libnspr4 / libnss3 / libasound2t64 が無いと起動しない。`apt-get download` +
`dpkg -x` で展開して `LD_LIBRARY_PATH` に足す（root 不要）。

## 書くときの線

姿の方針は「シャープでスリム」（オーナー裁定 2026-07-29）。線は髪の毛一本、面は塗らない、角は
丸めない、札は小さく控える。

測るのは空いている場所であって、絵そのものではない（HOLES #3）。絵は溢れると場所より大きくなるので、
絵を測ると堂々巡りになる。

焦点を受けるのは図ではなく点である。鍵盤はデータの構造に対応づき、図の向きで入れ替えない。

表は常に在り、畳んで置く。図が描けなくても情報が残る。

## 公開

ローカルの Verdaccio（`http://localhost:4873`）へ `npm publish --tag alpha` で出す。マージしてから
publish する（順序を逆にしない）。
