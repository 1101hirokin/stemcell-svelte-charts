# @stemcell/svelte-charts

Stemcell の図の Svelte 実装。SVG で描く。v1 の六図（棒・折れ線・面・散布・円/輪・小さな線）が揃っている。

決め事（刻み、配置、最小の長さ、太さの上下限、送るかどうか、表の組み立て）は
[`@stemcell/charts-core`](https://github.com/1101hirokin/stemcell-charts-core) が持つ。ここはそれを
受け取って描くだけである。規範は仕様リポの `foundations/dataviz.md` と `charts/BarChart.md`。

描画のエンジン（ECharts、Observable Plot、Chart.js など）には依存しない。棒は矩形と直線で足りる。

## 使い方

| 部品 | 何を読む図か |
|---|---|
| `BarChart` | 長さで量を比べる。縦棒と横棒、並置と積み上げと 100% |
| `LineChart` | 位置で量を比べる。時間の軸、欠けたところの橋 |
| `AreaChart` | 積み重なりと取り分。既定は積む |
| `ScatterChart` | 二つの量の関係。大きさは面積で符号化 |
| `PieChart` | 全体に対する取り分。円と輪 |
| `Sparkline` | 文や表のセルの中の小さな線。軸も表も持たない |

```svelte
<script>
  import { BarChart } from '@stemcell/svelte-charts';
  import '@stemcell/tokens/standard.css';

  const data = [
    { 月: '1月', 売上: 1200, 区分: '実績' },
    { 月: '1月', 売上: 1000, 区分: '予算' },
  ];
  let hidden = $state([]);
</script>

<div style="block-size: 16rem">
  <BarChart
    {data}
    encoding={{ x: '月', y: '売上', color: '区分' }}
    label="月別の売上"
    tableLabel="表で見る"
    legend
    {hidden}
    onhiddenchange={(next) => (hidden = next)}
  />
</div>
```

## 高さの与え方

絵の高さは置かれた場所に従う。置き場所に高さが無いと絵も高さを持たないので、`ratio`（「16:9」）を渡すか、
高さのある場所へ置く。

表を開いても絵は縮まない。開いたぶんは下へ伸びる（同じデータの絵が、操作のたびに別の形になるのを避ける）。
そのため、置き場所に固定の高さを与えると、開いたぶんはその外へ出る。図を置く場所は `ratio` か成り行きの
高さにする。

## 依存

| | |
|---|---|
| `@stemcell/charts-core` | 決め事。依存として持つ |
| `@stemcell/tokens` | 色と文字と間隔。CSS 変数として読むので、消費者がテーマの CSS を当てる |
| `@stemcell/svelte` | 表（`Table`）と、畳んで開く形（`Disclosure`）。peer dependency |

同じデータの表は常に在り、畳んで置く。図が描けない環境でも情報が残る（第7条）。

## 開発

```sh
bun install
bun run test        # 適合(契約との照合)＋ jsdom(構造・読み上げ・鍵盤)
bun run conformance # 適合だけ
bun run check       # 型
bun run playground  # 実物を触る
bun run package     # dist
```

適合テストは隣の仕様リポ（`../stemcell-component-prompts/contracts`）から生成する。契約の props 名・enum 値・
既定値が実装の `meta.ts` と一致するか、必須トークンが CSS に現れるか、実装が引く字の役を契約が宣言して
いるかを見る。契約が変わる PR は、仕様側を先にマージしてから実装側を出す。

jsdom は配置を計算しないので、寸法は playground と Chromium で測る（`experiments/shot.ts`）。

穴（仕様に書かれていないことを実装が決めた箇所）は [HOLES.md](./HOLES.md) に記録し、仕様へ還す。
