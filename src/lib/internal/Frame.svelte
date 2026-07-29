<script lang="ts">
  import './frame.css';
  import { Disclosure, Table } from '@stemcell/svelte';
  import { formatValue, type TableModel } from '@stemcell/charts-core';
  import type { Snippet } from 'svelte';

  // 図の外枠。名前・説明・凡例・軸の札・送れる領域・表を持ち、絵は各図が snippet で描く。
  // 図ごとに違うのは絵の中身だけなので、ここを共有しないと同じ骨組みが図の数だけ増える。
  interface Props {
    label: string;
    description?: string;
    tableLabel: string;
    emptyLabel?: string;
    locale?: string;
    /** 凡例を出すか。既定は出さない(系列の名前は印の近くへ置く)。 */
    legend?: boolean;
    /** 系列の名前。凡例と、隠す操作に使う。 */
    series: (string | null)[];
    hidden?: string[];
    onhiddenchange?: (hidden: string[]) => void;
    /** 系列の色(分類スケールから引いた CSS の値)。 */
    color: (index: number) => string;
    /** 描くものが無いか。 */
    empty: boolean;
    /** 縦横比。「横/縦」の整数比の文字列(16/9・1/1・4/3 等)。契約 Chart alpha.7 で Frame と揃えた。 */
    ratio?: string;
    /** 棒が伸びる向き。量の軸を縦に取るか横に取るか(BarChart だけが横を使う)。 */
    orientation?: 'vertical' | 'horizontal';
    /** 軸の帯を出すか。円は軸を持たないので false(PieChart.md §1)。 */
    axes?: boolean;
    /** 量の軸の札。at は札を置く位置(画面の座標)。 */
    valueTicks: { at: number; label: string }[];
    /** もう一方の軸の札。at は中心の位置、size は札の幅(切り詰める幅)。 */
    categoryTicks: { at: number; size: number; label: string }[];
    /** 絵に要る大きさ。場所より広ければ送る。 */
    content: number;
    scrolls: boolean;
    /** 同じデータの表。 */
    table: TableModel;
    /** 測った場所の大きさ(画面の箱)。軸へ倒すのは各図の仕事である。 */
    size?: { inline: number; block: number };
    /** 絵。measured の大きさで描く。 */
    plot: Snippet;
    /** 指したものの値(位置は各図が --sc-x / --sc-y で渡す)。 */
    tooltip?: Snippet;
  }

  let {
    label,
    description,
    tableLabel,
    emptyLabel,
    locale,
    legend = false,
    series,
    hidden,
    onhiddenchange,
    color,
    empty,
    ratio,
    orientation = 'vertical',
    axes = true,
    valueTicks,
    categoryTicks,
    content,
    scrolls,
    table,
    size = $bindable({ inline: 0, block: 0 }),
    plot,
    tooltip,
  }: Props = $props();

  const uid = $props.id();
  const labelId = `${uid}-label`;
  const descriptionId = `${uid}-description`;

  // 測るのは「空いている場所」であって絵そのものではない。絵を測ると、溢れた絵が場所を広げ、
  // 次の計算で溢れなくなる堂々巡りになる(HOLES #3)
  let boxWidth = $state(0);
  let boxHeight = $state(0);
  /** カテゴリの札の帯の厚み。縦棒では高さ、横棒では幅。 */
  let stripBlock = $state(0);
  let stripInline = $state(0);
  const vertical = $derived(orientation === 'vertical');
  $effect(() => {
    size = {
      inline: Math.max(vertical ? boxWidth : boxWidth - stripInline, 1),
      block: Math.max(vertical ? boxHeight - stripBlock : boxHeight, 1),
    };
  });

  let tableOpen = $state(false);

  const longestTick = $derived(
    valueTicks.reduce((longest, tick) => (tick.label.length > longest.length ? tick.label : longest), ''),
  );

  function toggleSeries(name: string | null) {
    if (name == null) return;
    const now = new Set(hidden ?? []);
    if (now.has(name)) now.delete(name);
    else now.add(name);
    onhiddenchange?.([...now]);
  }

  const tableColumns = $derived(
    table.columns.map((column, index) => ({ id: column, align: index === 0 ? ('start' as const) : ('end' as const) })),
  );
  const tableRows = $derived(
    table.rows.map((row, index) => ({
      id: `${index}`,
      cells: Object.fromEntries(table.columns.map((column, i) => [column, row[i] ?? null])),
    })),
  );
  // 比の検証は @stemcell/svelte の Frame と同じ規則である(契約が同じ prop 名で同じ書式を要求する)。
  // 以前ここはコロンを斜線へ置き換えていて、Frame は斜線でないと既定へ退避していた。同じ名前の
  // prop に二つの書式が通る状態だったので、契約を斜線へ揃えて実装も合わせた(RFC 0025)。
  const isRatio = (v: string): boolean => {
    const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(v);
    return m !== null && Number(m[1]) > 0 && Number(m[2]) > 0;
  };
  const ratioValue = $derived.by(() => {
    if (!ratio) return undefined;
    if (isRatio(ratio)) return ratio;
    console.warn(`[stemcell] Chart: ratio="${ratio}" は「横/縦」の正の整数比ではない(契約)。比を無視して置かれた場所の高さに従う。`);
    return undefined;
  });
</script>

<!-- 図はまとまりであって、焦点を受けるのは中の点である(DropArea と同じ形。契約 a11y) -->
<div
  class="sc-chart"
  role="group"
  aria-labelledby={labelId}
  aria-describedby={description ? descriptionId : undefined}
  data-orientation={orientation}
  data-scrolls={scrolls ? 'true' : undefined}
  style={ratioValue ? `--sc-chart-ratio: ${ratioValue}` : undefined}
>
  <div class="sc-chart-label" id={labelId}>{label}</div>
  {#if description}
    <div class="sc-chart-description" id={descriptionId}>{description}</div>
  {/if}

  {#if legend}
    <ul class="sc-chart-legend">
      {#each series as name, index (name ?? index)}
        <li>
          <button
            type="button"
            class="sc-chart-legend-item"
            aria-pressed={(hidden ?? []).includes(name ?? '') ? 'true' : 'false'}
            onclick={() => toggleSeries(name)}
          >
            <span class="sc-chart-swatch" style={`background: ${color(index)}`}></span>
            {name ?? label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if empty}
    <p class="sc-chart-empty">{emptyLabel ?? ''}</p>
  {:else}
    <div class="sc-chart-frame" style={`--sc-chart-strip: ${vertical ? stripBlock : stripInline}px`}>
      {#if axes}
      <div class="sc-chart-values" aria-hidden="true">
        <span class="sc-chart-value-gauge">{longestTick}</span>
        <!-- 位置ではなく順番で鍵を作る。場所がまだ測れていないと位置が全部同じになる(jsdom) -->
        {#each valueTicks as tick, index (index)}
          <span class="sc-chart-value-label" style={`--sc-at: ${tick.at}px`}>{tick.label}</span>
        {/each}
      </div>
      {/if}

      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="sc-chart-scroll"
        tabindex={scrolls ? 0 : undefined}
        bind:clientWidth={boxWidth}
        bind:clientHeight={boxHeight}
      >
        <div class="sc-chart-track" style={`--sc-across: ${content}px`}>
          <div class="sc-chart-plot">{@render plot()}</div>
          {#if axes}
          <div
            class="sc-chart-categories"
            aria-hidden="true"
            bind:clientHeight={stripBlock}
            bind:clientWidth={stripInline}
          >
            <!-- 端の札は場所の中へ寄せる。中心に揃えたままだと、両端で半分はみ出して切れる -->
            {#each categoryTicks as tick, index (`${tick.label}-${index}`)}
              {@const limit = Math.max((vertical ? content : size.block) - tick.size, 0)}
              {@const start = Math.min(Math.max(tick.at - tick.size / 2, 0), limit)}
              <span
                class="sc-chart-category"
                title={tick.label}
                style={`--sc-start: ${start}px; --sc-size: ${tick.size}px`}>{tick.label}</span
              >
            {/each}
          </div>
          {/if}
        </div>
      </div>

      {#if tooltip}{@render tooltip()}{/if}
    </div>
  {/if}

  <div class="sc-chart-table">
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
