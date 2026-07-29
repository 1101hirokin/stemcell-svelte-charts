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
    /** 縦横比(「16:9」)。 */
    ratio?: string;
    /** 量の軸の札。at は軸の始まりからの距離。 */
    valueTicks: { at: number; label: string }[];
    /** x 軸の札。at は位置、size は札の幅(切り詰める幅)。 */
    xTicks: { at: number; size: number; label: string }[];
    /** 絵に要る幅。場所より広ければ横へ送る。 */
    contentX: number;
    scrolls: boolean;
    /** 同じデータの表。 */
    table: TableModel;
    /** 測った場所の大きさ(x は横、y は量の軸)。 */
    size?: { x: number; y: number };
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
    valueTicks,
    xTicks,
    contentX,
    scrolls,
    table,
    size = $bindable({ x: 0, y: 0 }),
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
  let stripBlock = $state(0);
  $effect(() => {
    size = { x: Math.max(boxWidth, 1), y: Math.max(boxHeight - stripBlock, 1) };
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
</script>

<!-- 図はまとまりであって、焦点を受けるのは中の点である(DropArea と同じ形。契約 a11y) -->
<div
  class="sc-chart"
  role="group"
  aria-labelledby={labelId}
  aria-describedby={description ? descriptionId : undefined}
  data-scrolls={scrolls ? 'true' : undefined}
  style={ratio ? `--sc-chart-ratio: ${ratio.replace(':', ' / ')}` : undefined}
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
    <div class="sc-chart-frame" style={`--sc-chart-x-strip: ${stripBlock}px`}>
      <div class="sc-chart-values" aria-hidden="true">
        <span class="sc-chart-value-gauge">{longestTick}</span>
        <!-- 位置ではなく順番で鍵を作る。場所がまだ測れていないと位置が全部同じになる(jsdom) -->
        {#each valueTicks as tick, index (index)}
          <span class="sc-chart-value-label" style={`--sc-at: ${tick.at}px`}>{tick.label}</span>
        {/each}
      </div>

      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="sc-chart-scroll"
        tabindex={scrolls ? 0 : undefined}
        bind:clientWidth={boxWidth}
        bind:clientHeight={boxHeight}
      >
        <div class="sc-chart-track" style={`--sc-across: ${contentX}px`}>
          <div class="sc-chart-plot">{@render plot()}</div>
          <div class="sc-chart-x" aria-hidden="true" bind:clientHeight={stripBlock}>
            <!-- 端の札は場所の中へ寄せる。中心に揃えたままだと、両端で半分はみ出して切れる -->
            {#each xTicks as tick, index (`${tick.label}-${index}`)}
              {@const start = Math.min(Math.max(tick.at - tick.size / 2, 0), Math.max(contentX - tick.size, 0))}
              <span class="sc-chart-x-label" title={tick.label} style={`--sc-start: ${start}px; --sc-size: ${tick.size}px`}
                >{tick.label}</span
              >
            {/each}
          </div>
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
