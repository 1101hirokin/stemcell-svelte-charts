<script lang="ts">
  import Frame from '../internal/Frame.svelte';
  import '../internal/bar.css';
  import { META, WEB, type BarChartOrientation, type BarChartStacking } from './meta';
  import {
    barLayout,
    formatTicks,
    formatValue,
    move,
    tableModel,
    type Bar,
    type Cursor,
    type Encoding,
    type Move,
    type Row,
  } from '@stemcell/charts-core';
  import { tick } from 'svelte';

  // 長さで量を比べる図(charts/BarChart.md)。決め事(刻み・配置・最小の長さ・送るかどうか)は
  // @stemcell/charts-core が持ち、外枠(名前・凡例・軸の札・送れる領域・表)は Frame が持つ。
  // ここに残るのは、棒そのものを描くことと、向きを画面へ倒すことである。
  interface Props {
    /** 描くデータ。行がひとつの印になる。集計済みを渡す(部品は合計も平均も出さない)。 */
    data: Row[];
    /** 列をチャンネルへ割り当てる。棒は x / y / color を使う。 */
    encoding: Encoding;
    /** 棒が伸びる向き。 */
    orientation?: BarChartOrientation;
    /** 系列の重ね方。 */
    stacking?: BarChartStacking;
    /** 棒の先に値を出す。 */
    valueLabels?: boolean;
    /** 凡例を出す。既定は出さない(系列の名前は印の近くに置く)。積み上げるときは指定する。 */
    legend?: boolean;
    /** 指したものの値を見せる。 */
    tooltip?: boolean;
    /** 指した位置に線を引く。 */
    crosshair?: boolean;
    /** 隠している系列。値であってアプリが持つ。 */
    hidden?: string[];
    /** 初めて描くときに棒を伸ばす。reduced-motion では動かない。 */
    animateOnAppear?: boolean;
    /** 縦横比(「16:9」)。既定は持たず、高さは置かれた場所に従う。 */
    ratio?: string;
    /** 図の名前。短い説明にあたり、常に要る。 */
    label: string;
    /** 長い説明(傾向・関係・目盛りの範囲)。 */
    description?: string;
    /** 同じデータの表を開く操作の名前。表は常に在り、畳んで置く。 */
    tableLabel: string;
    /** データが無いときに出す言葉。 */
    emptyLabel?: string;
    /** 数の書式に使う地域。省くと環境の既定に従う。 */
    locale?: string;
    /** 隠す系列が変わった。列から外すのはアプリがする。 */
    onhiddenchange?: (hidden: string[]) => void;
    /** 棒が指された(押した、なぞった、鍵盤で辿った)。payload は指された行。 */
    onpointactivate?: (point: { category: string; series: string | null; value: number }) => void;
  }

  let {
    data,
    encoding,
    orientation = META.props.orientation.default,
    stacking = META.props.stacking.default,
    valueLabels = META.props.valueLabels.default,
    legend = META.props.legend.default,
    tooltip = META.props.tooltip.default,
    crosshair = META.props.crosshair.default,
    hidden,
    animateOnAppear = META.props.animateOnAppear.default,
    ratio,
    label,
    description,
    tableLabel,
    emptyLabel,
    locale,
    onhiddenchange,
    onpointactivate,
  }: Props = $props();

  let size = $state({ inline: 0, block: 0 });
  let cursor = $state<Cursor>({ series: 0, point: 0 });
  let active = $state<Bar | null>(null);
  let plotEl: SVGSVGElement | undefined = $state();

  const vertical = $derived(orientation === 'vertical');
  const layout = $derived(
    barLayout({
      rows: data,
      encoding,
      orientation,
      stacking,
      // 計算層は向きを持たない。along は量の軸、across はカテゴリが並ぶ軸である
      plot: {
        along: Math.max(vertical ? size.block : size.inline, 1),
        across: Math.max(vertical ? size.inline : size.block, 1),
      },
      hidden,
    }),
  );

  // 描く場所そのものの大きさ。溢れたぶんは送るので、絵は場所より大きくなりうる
  const canvas = $derived(
    vertical
      ? { width: layout.content.across, height: Math.max(size.block, 1) }
      : { width: Math.max(size.inline, 1), height: layout.content.across },
  );

  // RTL では横棒の基線が行の始まり側(右)へ移る。読みの向きは環境から取る(第6条)
  const rtl = $derived.by(() => {
    void size.inline;
    if (!plotEl || typeof getComputedStyle !== 'function') return false;
    return getComputedStyle(plotEl).direction === 'rtl';
  });

  /** 計算層の距離を画面の矩形へ倒す。ここだけが向きを知っている。 */
  function rect(bar: Bar): { x: number; y: number; width: number; height: number } {
    const length = bar.to - bar.from;
    if (vertical) {
      return { x: bar.offset, y: canvas.height - bar.to, width: bar.thickness, height: length };
    }
    return { x: rtl ? canvas.width - bar.to : bar.from, y: bar.offset, width: length, height: bar.thickness };
  }

  /** 量の軸の位置を画面へ。 */
  function tickAt(at: number): number {
    if (vertical) return canvas.height - at;
    return rtl ? canvas.width - at : at;
  }

  const tickLabels = $derived(
    formatTicks(
      layout.ticks.map((t) => t.value),
      Math.abs((layout.ticks[1]?.value ?? 1) - (layout.ticks[0]?.value ?? 0)) || 1,
      { locale, percent: layout.valueKind === 'share', compact: layout.valueKind === 'value' },
    ),
  );
  const valueTicks = $derived(layout.ticks.map((t, i) => ({ at: tickAt(t.at), label: tickLabels[i] ?? '' })));
  const categoryTicks = $derived(
    layout.categories.map((category, index) => {
      const band = layout.categoryBands[index];
      return { at: (band?.start ?? 0) + (band?.size ?? 0) / 2, size: band?.size ?? 0, label: category };
    }),
  );

  const empty = $derived(layout.bars.length === 0);
  const table = $derived(tableModel({ rows: data, encoding, orientation }));

  // 同じカテゴリと同じ系列に二行来たら、後の行を採ったことを知らせる(BarChart.md §2)
  $effect(() => {
    for (const duplicate of layout.duplicates) {
      console.warn(
        `[stemcell] BarChart: ${duplicate.category} / ${duplicate.series ?? '(系列なし)'} に行が二つ以上あります。` +
          '足さずに後の行を描きました(図は集計しない。BarChart.md §2)。',
      );
    }
  });

  const color = (bar: Bar): string =>
    `var(--color-dataviz-categorical-${(bar.seriesIndex % WEB.categoricalRungs) + 1})`;
  const seriesColor = (index: number): string =>
    `var(--color-dataviz-categorical-${(index % WEB.categoricalRungs) + 1})`;

  const describe = (bar: Bar): string => {
    const value = formatValue(bar.value, { locale });
    const share = bar.share == null ? '' : ` ${formatValue(bar.share, { locale, percent: true })}`;
    return bar.series ? `${bar.category} ${bar.series} ${value}${share}` : `${bar.category} ${value}${share}`;
  };

  // 辿るのは構造であって画面ではない。左右で系列の中を進み、上下で系列を移る(RFC 0024)
  const KEYS: Record<string, Move> = {
    ArrowRight: 'next',
    ArrowLeft: 'prev',
    ArrowDown: 'nextSeries',
    ArrowUp: 'prevSeries',
    Home: 'first',
    End: 'last',
  };
  const barAt = (position: Cursor): Bar | undefined =>
    layout.bars.find((bar) => bar.seriesIndex === position.series && bar.categoryIndex === position.point);

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      const bar = barAt(cursor);
      if (bar) {
        event.preventDefault();
        onpointactivate?.({ category: bar.category, series: bar.series, value: bar.value });
      }
      return;
    }
    const action = KEYS[event.key];
    if (!action) return;
    const shape = { series: layout.series.length, points: layout.categories.length };
    let candidate = move(cursor, action, shape);
    // 行が無いところには印が無い。空の場所へは止まらず、同じ向きへ進み続ける
    for (let i = 0; i < layout.categories.length && !barAt(candidate); i++) {
      const forward = move(candidate, action, shape);
      if (forward.series === candidate.series && forward.point === candidate.point) break;
      candidate = forward;
    }
    if (!barAt(candidate)) return;
    event.preventDefault();
    cursor = candidate;
    active = barAt(candidate) ?? null;
    // 焦点は新しい棒へ移す。DOM が入れ替わってからでないと、動く前の棒を掴む
    void tick().then(() => plotEl?.querySelector<SVGElement>('[data-cursor="true"]')?.focus?.());
  }
</script>

<Frame
  {label}
  {description}
  {tableLabel}
  {emptyLabel}
  {locale}
  {legend}
  {ratio}
  {orientation}
  series={layout.series}
  {hidden}
  {onhiddenchange}
  color={seriesColor}
  {empty}
  {valueTicks}
  {categoryTicks}
  content={layout.content.across}
  scrolls={layout.scrolls}
  {table}
  bind:size
  {plot}
  tooltip={tooltip && active ? tooltipSnippet : undefined}
/>

{#snippet plot()}
  <svg
    class="sc-chart-svg"
    width={canvas.width}
    height={canvas.height}
    viewBox={`0 0 ${canvas.width} ${canvas.height}`}
    role="presentation"
    bind:this={plotEl}
    onkeydown={handleKey}
  >
    <!-- グリッドは量の軸にだけ引く。枠では囲まない(dataviz §4-2) -->
    <g class="sc-chart-grid">
      {#each layout.ticks as t (t.value)}
        {#if vertical}
          <line x1="0" x2={canvas.width} y1={tickAt(t.at)} y2={tickAt(t.at)} />
        {:else}
          <line y1="0" y2={canvas.height} x1={tickAt(t.at)} x2={tickAt(t.at)} />
        {/if}
      {/each}
    </g>

    {#if crosshair && active}
      <g class="sc-chart-crosshair">
        {#if vertical}
          <line x1="0" x2={canvas.width} y1={tickAt(active.to)} y2={tickAt(active.to)} />
        {:else}
          <line y1="0" y2={canvas.height} x1={tickAt(active.to)} x2={tickAt(active.to)} />
        {/if}
      </g>
    {/if}

    <!-- 基線。0 の位置で、負の値があると軸の中に来る -->
    <g class="sc-chart-baseline">
      {#if vertical}
        <line x1="0" x2={canvas.width} y1={tickAt(layout.baseline)} y2={tickAt(layout.baseline)} />
      {:else}
        <line y1="0" y2={canvas.height} x1={tickAt(layout.baseline)} x2={tickAt(layout.baseline)} />
      {/if}
    </g>

    {#each layout.bars as bar (`${bar.category} ${bar.series ?? ''}`)}
      {@const box = rect(bar)}
      {@const focused = bar.seriesIndex === cursor.series && bar.categoryIndex === cursor.point}
      <!-- 棒の角は丸めない(端をぼかすと長さの読みが鈍る)。焦点を受けるのは図ではなく点である
           (契約 a11y)。棒は押せるものではなく「名前と値を持つ印」なので role は img。 -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <rect
        class="sc-bar"
        class:sc-bar-appear={animateOnAppear}
        data-minimum={bar.atMinimum ? 'true' : undefined}
        data-cursor={focused ? 'true' : undefined}
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        fill={color(bar)}
        style={animateOnAppear
          ? `--sc-origin-x: ${vertical ? box.x + box.width / 2 : tickAt(layout.baseline)}px; ` +
            `--sc-origin-y: ${vertical ? tickAt(layout.baseline) : box.y + box.height / 2}px`
          : undefined}
        role="img"
        aria-label={describe(bar)}
        tabindex={focused ? 0 : -1}
        onfocus={() => {
          cursor = { series: bar.seriesIndex, point: bar.categoryIndex };
          active = bar;
        }}
        onblur={() => (active = null)}
        onpointerenter={() => (active = bar)}
        onpointerleave={() => (active = null)}
        onclick={() => onpointactivate?.({ category: bar.category, series: bar.series, value: bar.value })}
      />
    {/each}

    {#if valueLabels}
      <g class="sc-bar-values" aria-hidden="true">
        {#each layout.bars as bar (`${bar.category} ${bar.series ?? ''}`)}
          {@const box = rect(bar)}
          {@const negative = bar.value < 0}
          <!-- 札は棒の外側、伸びた先に置く。負の値では反対側になる -->
          <text
            x={vertical ? box.x + box.width / 2 : negative ? box.x - 4 : box.x + box.width + 4}
            y={vertical ? (negative ? box.y + box.height + 12 : box.y - 4) : box.y + box.height / 2}
            text-anchor={vertical ? 'middle' : negative ? 'end' : 'start'}
            dominant-baseline={vertical ? 'auto' : 'middle'}
          >
            {formatValue(bar.value, { locale, compact: true })}
          </text>
        {/each}
      </g>
    {/if}
  </svg>
{/snippet}

{#snippet tooltipSnippet()}
  {#if active}
    {@const box = rect(active)}
    <div class="sc-chart-tooltip" role="status" style={`--sc-x: ${box.x + box.width / 2}px; --sc-y: ${box.y}px`}>
      {describe(active)}
    </div>
  {/if}
{/snippet}
