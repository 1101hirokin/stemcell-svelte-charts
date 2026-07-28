<script lang="ts">
  import './BarChart.css';
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
  import { Disclosure, Table } from '@stemcell/svelte';
  import { tick } from 'svelte';

  // 長さで量を比べる図(charts/BarChart.md)。決め事(刻み・配置・最小の長さ・送るかどうか)は
  // @stemcell/charts-core が持ち、ここは受け取って描くだけである(dataviz §6)。
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

  const uid = $props.id();
  const labelId = `${uid}-label`;
  const descriptionId = `${uid}-description`;

  // 置かれた場所の大きさ。高さは場所に従う(比を渡したときだけ形が決まる)。
  //
  // 測るのは「空いている場所」(送れる領域)であって、絵そのものではない。絵は溢れると場所より
  // 大きくなるので、絵を測ると「広がった絵 -> 溢れていない -> 縮む」の堂々巡りになり、下限も
  // 送りも効かなくなる(実測で判明。HOLES #3)。
  let boxWidth = $state(0);
  let boxHeight = $state(0);
  /** カテゴリの名前を並べる帯の厚み。量の軸の札は、このぶん下がって始まりを揃える。 */
  let stripBlock = $state(0);
  let stripInline = $state(0);
  let plotEl: HTMLElement | undefined = $state();
  let tableOpen = $state(false);
  let cursor = $state<Cursor>({ series: 0, point: 0 });
  let active = $state<Bar | null>(null);

  const vertical = $derived(orientation === 'vertical');
  const along = $derived(vertical ? boxHeight - stripBlock : boxWidth - stripInline);
  const across = $derived(vertical ? boxWidth : boxHeight);

  const layout = $derived(
    barLayout({
      rows: data,
      encoding,
      orientation,
      stacking,
      plot: { along: Math.max(along, 1), across: Math.max(across, 1) },
      hidden,
    }),
  );

  const tickLabels = $derived(
    formatTicks(
      layout.ticks.map((tick) => tick.value),
      Math.abs((layout.ticks[1]?.value ?? 1) - (layout.ticks[0]?.value ?? 0)) || 1,
      { locale, percent: layout.valueKind === 'share', compact: layout.valueKind === 'value' },
    ),
  );

  const longestTickLabel = $derived(
    tickLabels.reduce((longest, current) => (current.length > longest.length ? current : longest), ''),
  );

  // 描く場所そのものの大きさ。溢れたぶんは横へ送るので、絵は器より大きくなりうる。
  const canvas = $derived(
    vertical
      ? { width: layout.content.across, height: Math.max(along, 1) }
      : { width: Math.max(along, 1), height: layout.content.across },
  );

  // RTL では横棒の基線が行の始まり側(右)へ移る。読みの向きは環境が持つので、そこから取る
  // (第6条: 文脈は環境から)。
  const rtl = $derived.by(() => {
    void boxWidth; // 置き場所が変わったら読み直す
    if (!plotEl || typeof getComputedStyle !== 'function') return false;
    return getComputedStyle(plotEl).direction === 'rtl';
  });

  /** 計算層の距離(軸の始まりから)を、画面の矩形へ倒す。ここだけが向きを知っている。 */
  function rect(bar: Bar): { x: number; y: number; width: number; height: number } {
    const length = bar.to - bar.from;
    if (vertical) {
      // 量の軸は下から上。0 が下端になる。
      return { x: bar.offset, y: canvas.height - bar.to, width: bar.thickness, height: length };
    }
    return {
      x: rtl ? canvas.width - bar.to : bar.from,
      y: bar.offset,
      width: length,
      height: bar.thickness,
    };
  }

  /** 目盛りの線と札の位置(量の軸)。 */
  function tickAt(at: number): number {
    if (vertical) return canvas.height - at;
    return rtl ? canvas.width - at : at;
  }

  const empty = $derived(layout.bars.length === 0);

  // 同じカテゴリと同じ系列に二行来たら、後の行を採ったことを知らせる(BarChart.md §2)。
  // 黙って上書きすると、渡したはずの棒が一本足りないことに気づけない。
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

  const describe = (bar: Bar): string => {
    const value = formatValue(bar.value, { locale });
    const share = bar.share == null ? '' : ` ${formatValue(bar.share, { locale, percent: true })}`;
    return bar.series ? `${bar.category} ${bar.series} ${value}${share}` : `${bar.category} ${value}${share}`;
  };

  // 辿るのは構造であって画面ではない。左右で系列の中を進み、上下で系列を移る(RFC 0024)。
  // 向きで入れ替えない(BarChart.md §2)。
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
    const next = move(cursor, action, { series: layout.series.length, points: layout.categories.length });
    // 行が無いところには印が無い。空の場所へは止まらず、同じ向きへ進み続ける。
    let candidate = next;
    for (let i = 0; i < layout.categories.length && !barAt(candidate); i++) {
      const forward = move(candidate, action, {
        series: layout.series.length,
        points: layout.categories.length,
      });
      if (forward.series === candidate.series && forward.point === candidate.point) break;
      candidate = forward;
    }
    if (!barAt(candidate)) return;
    event.preventDefault();
    cursor = candidate;
    active = barAt(candidate) ?? null;
    // 焦点は新しい棒へ移す。DOM が入れ替わってからでないと、動く前の棒を掴む。
    void tick().then(() => plotEl?.querySelector<SVGElement>('[data-cursor="true"]')?.focus?.());
  }

  function toggleSeries(name: string | null) {
    if (name == null) return;
    const now = new Set(hidden ?? []);
    if (now.has(name)) now.delete(name);
    else now.add(name);
    onhiddenchange?.([...now]);
  }

  // 表は常に在り、畳んで置く(dataviz §4-2)。描けない環境でも情報が残る(第7条)。
  const table = $derived(tableModel({ rows: data, encoding, orientation }));
  const tableColumns = $derived(
    table.columns.map((column, index) => ({ id: column, align: index === 0 ? ('start' as const) : ('end' as const) })),
  );
  const tableRows = $derived(
    table.rows.map((row, index) => ({
      id: `${index}`,
      cells: Object.fromEntries(table.columns.map((column, i) => [column, row[i] ?? null])),
    })),
  );
</script>

<!-- 図はまとまりであって、焦点を受けるのは中の棒である(DropArea と同じ形。契約 a11y)。 -->
<div
  class="sc-barchart"
  data-orientation={orientation}
  data-stacking={stacking}
  role="group"
  aria-labelledby={labelId}
  aria-describedby={description ? descriptionId : undefined}
  style={ratio ? `--sc-barchart-ratio: ${ratio.replace(':', ' / ')}` : undefined}
>
  <div class="sc-barchart-label" id={labelId}>{label}</div>
  {#if description}
    <!-- 長い説明は読み上げへ渡す。図の隣に文章を置くかはアプリの画面の判断なので、部品は場所を取らない -->
    <div class="sc-barchart-description" id={descriptionId}>{description}</div>
  {/if}

  {#if legend}
    <ul class="sc-barchart-legend">
      {#each layout.series as name, index (name ?? index)}
        <li>
          <button
            type="button"
            class="sc-barchart-legend-item"
            aria-pressed={(hidden ?? []).includes(name ?? '') ? 'true' : 'false'}
            onclick={() => toggleSeries(name)}
          >
            <span
              class="sc-barchart-swatch"
              style={`background: var(--color-dataviz-categorical-${(index % WEB.categoricalRungs) + 1})`}
            ></span>
            {name ?? label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if empty}
    <p class="sc-barchart-empty">{emptyLabel ?? ''}</p>
  {:else}
    <div
      class="sc-barchart-frame"
      style={`--sc-barchart-category-strip: ${vertical ? stripBlock : stripInline}px`}
    >
      <!-- 量の軸の札。送っても動かない(送るのはカテゴリの側だけ) -->
      <div class="sc-barchart-values" aria-hidden="true">
        <!-- 札は絶対配置なので、そのままだと列に幅が生まれず、数字が切れる(実測)。
             いちばん長い札を見えない字で一つ置いて、列の幅をそこから決める。 -->
        <span class="sc-barchart-value-gauge">{longestTickLabel}</span>
        {#each layout.ticks as tick, index (tick.value)}
          <span class="sc-barchart-value-label" style={`--sc-at: ${tickAt(tick.at)}px`}>{tickLabels[index]}</span>
        {/each}
      </div>

      <!--
        送れる領域はキーボードでも操作できる(WCAG 2.2 SC 2.1.1)。溢れていないときは焦点を置かない
        (押せもしない停留を増やさない。CodeBlock と同じ形)。名前は持たせない: 図そのものが名前を
        持つまとまりなので、同じ名前をもう一度名乗ると読み上げが重なる(HOLES #2)。
      -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="sc-barchart-scroll"
        tabindex={layout.scrolls ? 0 : undefined}
        bind:clientWidth={boxWidth}
        bind:clientHeight={boxHeight}
      >
        <div class="sc-barchart-track" style={`--sc-across: ${layout.content.across}px`}>
          <div class="sc-barchart-plot" bind:this={plotEl}>
            <svg
              class="sc-barchart-svg"
              width={canvas.width}
              height={canvas.height}
              viewBox={`0 0 ${canvas.width} ${canvas.height}`}
              role="presentation"
              onkeydown={handleKey}
            >
              <!-- グリッドは量の軸にだけ引く。枠では囲まない(dataviz §4-2) -->
              <g class="sc-barchart-grid">
                {#each layout.ticks as tick (tick.value)}
                  {#if vertical}
                    <line x1="0" x2={canvas.width} y1={tickAt(tick.at)} y2={tickAt(tick.at)} />
                  {:else}
                    <line y1="0" y2={canvas.height} x1={tickAt(tick.at)} x2={tickAt(tick.at)} />
                  {/if}
                {/each}
              </g>

              {#if crosshair && active}
                <g class="sc-barchart-crosshair">
                  {#if vertical}
                    <line x1="0" x2={canvas.width} y1={tickAt(active.to)} y2={tickAt(active.to)} />
                  {:else}
                    <line y1="0" y2={canvas.height} x1={tickAt(active.to)} x2={tickAt(active.to)} />
                  {/if}
                </g>
              {/if}

              <!-- 基線。0 の位置で、負の値があると軸の中に来る -->
              <g class="sc-barchart-baseline">
                {#if vertical}
                  <line x1="0" x2={canvas.width} y1={tickAt(layout.baseline)} y2={tickAt(layout.baseline)} />
                {:else}
                  <line y1="0" y2={canvas.height} x1={tickAt(layout.baseline)} x2={tickAt(layout.baseline)} />
                {/if}
              </g>

              {#each layout.bars as bar (`${bar.category} ${bar.series ?? ''}`)}
                {@const box = rect(bar)}
                {@const focused = bar.seriesIndex === cursor.series && bar.categoryIndex === cursor.point}
                <!-- 棒の角は丸めない(端をぼかすと長さの読みが鈍る。BarChart.md §2)。
                     焦点を受けるのは図ではなく点である(契約 a11y。DropArea と同じ形)。棒は押せる
                     ものではなく「名前と値を持つ印」なので role は img で、活性化は任意の追加である
                     (押さなくても、辿れば読み上げられる)。鍵盤は svg で受けて構造どおりに動かす。 -->
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <rect
                  class="sc-barchart-bar"
                  class:sc-barchart-bar-appear={animateOnAppear}
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
                  onclick={() =>
                    onpointactivate?.({ category: bar.category, series: bar.series, value: bar.value })}
                />
              {/each}

              {#if valueLabels}
                <g class="sc-barchart-value-marks" aria-hidden="true">
                  {#each layout.bars as bar (`${bar.category} ${bar.series ?? ''}`)}
                    {@const box = rect(bar)}
                    <!-- 札は棒の外側、伸びた先に置く。負の値では反対側になる -->
                    {@const negative = bar.value < 0}
                    <text
                      x={vertical
                        ? box.x + box.width / 2
                        : negative
                          ? box.x - 4
                          : box.x + box.width + 4}
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
          </div>

          <!-- カテゴリの名前。入らなければ切り詰める(斜めに倒さない、間引かない。BarChart.md §2) -->
          <div
            class="sc-barchart-categories"
            aria-hidden="true"
            bind:clientHeight={stripBlock}
            bind:clientWidth={stripInline}
          >
            {#each layout.categories as category, index (category)}
              {@const band = layout.categoryBands[index]}
              <span
                class="sc-barchart-category"
                title={category}
                style={`--sc-start: ${band?.start ?? 0}px; --sc-size: ${band?.size ?? 0}px`}>{category}</span
              >
            {/each}
          </div>
        </div>
      </div>

      {#if tooltip && active}
        {@const box = rect(active)}
        <div
          class="sc-barchart-tooltip"
          role="status"
          style={`--sc-x: ${box.x + box.width / 2}px; --sc-y: ${box.y}px`}
        >
          {describe(active)}
        </div>
      {/if}
    </div>
  {/if}

  <!-- 同じデータの表。畳んで置く(常に開くと場所を食い、別の画面へ送ると到達が遠い) -->
  <div class="sc-barchart-table">
    <Disclosure bind:open={tableOpen} summary={tableSummary} content={tableContent} />
  </div>
</div>

{#snippet tableSummary()}{tableLabel}{/snippet}
{#snippet tableContent()}
  <Table
    columns={tableColumns}
    rows={tableRows}
    caption={tableCaption}
    header={tableHeader}
    cell={tableCell}
    empty={tableEmpty}
  />
{/snippet}
{#snippet tableCaption()}{label}{/snippet}
{#snippet tableHeader(column: { id: string })}{column.id}{/snippet}
{#snippet tableCell(row: { cells: Record<string, string | number | null> }, column: { id: string })}
  {@const value = row.cells[column.id]}
  {typeof value === 'number' ? formatValue(value, { locale }) : (value ?? '')}
{/snippet}
{#snippet tableEmpty()}{emptyLabel ?? ''}{/snippet}
