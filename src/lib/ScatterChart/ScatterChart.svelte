<script lang="ts">
  import Frame from '../internal/Frame.svelte';
  import '../internal/scatter.css';
  import { META } from './meta';
  import {
    formatTicks,
    formatTimeTicks,
    formatValue,
    move,
    scatterLayout,
    tableModel,
    type AxisKind,
    type Cursor,
    type Encoding,
    type Move,
    type Row,
    type ScatterPoint,
  } from '@stemcell/charts-core';
  import { tick } from 'svelte';
  import { isRtl, mirror, observeDirection } from '../internal/direction';

  // 二つの量の関係を点で見る図(charts/ScatterChart.md)。点は結ばない。
  interface Props {
    data: Row[];
    encoding: Encoding;
    /** 軸の種類。両方とも量か時間である(カテゴリは採らない)。 */
    scale?: { x?: Exclude<AxisKind, 'category'> };
    /** いちばん大きい点の直径(px)。encoding.size を渡したときの最大がこれになる。 */
    pointSize?: number;
    crosshair?: boolean;
    legend?: boolean;
    tooltip?: boolean;
    hidden?: string[];
    animateOnAppear?: boolean;
    ratio?: string;
    label: string;
    description?: string;
    tableLabel: string;
    emptyLabel?: string;
    locale?: string;
    onhiddenchange?: (hidden: string[]) => void;
    onpointactivate?: (point: { x: number; y: number; series: string | null }) => void;
  }

  let {
    data,
    encoding,
    scale,
    pointSize,
    crosshair = META.props.crosshair.default,
    legend = META.props.legend.default,
    tooltip = META.props.tooltip.default,
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

  const RUNGS = 6;
  const color = (index: number) => `var(--sc-chart-series-${(index % RUNGS) + 1})`;

  let size = $state({ inline: 0, block: 0 });
  let cursor = $state<Cursor>({ series: 0, point: 0 });
  let active = $state<ScatterPoint | null>(null);
  let plotEl: SVGSVGElement | undefined = $state();

  let rtl = $state(false);
  $effect(() => {
    void size.inline;
    const read = () => (rtl = isRtl(plotEl));
    read();
    return observeDirection(plotEl, read);
  });

  const layout = $derived(
    scatterLayout({
      rows: data,
      encoding,
      xKind: scale?.x ?? 'linear',
      plot: { x: size.inline, y: size.block },
      hidden,
      pointSize,
      // 端の点が場所の縁に乗ると半分切れる。いちばん大きい点の半径ぶん空ける
      xPadding: (pointSize ?? 8) / 2 + 2,
      yPadding: (pointSize ?? 8) / 2 + 2,
    }),
  );

  const sx = (x: number): number => mirror(x, size.inline, rtl);
  const sy = (y: number): number => size.block - y;

  const valueTicks = $derived.by(() => {
    const values = layout.ticks.map((t) => t.value);
    const step = Math.abs((values[1] ?? 1) - (values[0] ?? 0)) || 1;
    const labels = formatTicks(values, step, { locale, compact: true });
    return layout.ticks.map((t, i) => ({ at: sy(t.at), label: labels[i] ?? '' }));
  });

  const xTicks = $derived.by(() => {
    const labels =
      layout.xKind === 'time' && layout.time
        ? formatTimeTicks(layout.time, locale)
        : layout.xTicks.map((t) => formatValue(t.value, { locale, compact: true }));
    const width = layout.xTicks.length > 1 ? Math.abs(layout.xTicks[1]!.at - layout.xTicks[0]!.at) : size.inline;
    return layout.xTicks.map((t, i) => ({ at: t.at, size: Math.max(width, 8), label: labels[i] ?? '' }));
  });

  const empty = $derived(layout.series.every((s) => s.points.length === 0));
  const table = $derived(tableModel({ rows: data, encoding }));

  const describe = (p: ScatterPoint): string => {
    const x = formatValue(p.value.x, { locale });
    const y = formatValue(p.value.y, { locale });
    const size = p.value.size == null ? '' : ` ${formatValue(p.value.size, { locale })}`;
    return p.series ? `${p.series} ${x} ${y}${size}` : `${x} ${y}${size}`;
  };

  const KEYS: Record<string, Move> = {
    ArrowRight: 'next',
    ArrowLeft: 'prev',
    ArrowDown: 'nextSeries',
    ArrowUp: 'prevSeries',
    Home: 'first',
    End: 'last',
  };
  const pointAt = (position: Cursor): ScatterPoint | undefined =>
    layout.series[position.series]?.points[position.point];

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      const point = pointAt(cursor);
      if (!point) return;
      event.preventDefault();
      onpointactivate?.({ x: point.value.x, y: point.value.y, series: point.series });
      return;
    }
    const action = KEYS[event.key];
    if (!action) return;
    const shape = {
      series: layout.series.length,
      points: Math.max(...layout.series.map((s) => s.points.length), 1),
    };
    const next = move(cursor, action, shape);
    if (!pointAt(next)) return;
    event.preventDefault();
    cursor = next;
    active = pointAt(next) ?? null;
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
  series={layout.series.map((s) => s.series)}
  {hidden}
  {onhiddenchange}
  {color}
  {empty}
  {valueTicks}
  categoryTicks={xTicks}
  content={size.inline}
  scrolls={false}
  {table}
  bind:size
  {plot}
  tooltip={tooltip && active ? tooltipSnippet : undefined}
/>

{#snippet plot()}
  <svg
    class="sc-chart-svg"
    width={size.inline}
    height={size.block}
    viewBox={`0 0 ${size.inline} ${size.block}`}
    role="presentation"
    bind:this={plotEl}
    onkeydown={handleKey}
  >
    <g class="sc-chart-grid">
      {#each layout.ticks as t (t.value)}
        <line x1="0" x2={size.inline} y1={sy(t.at)} y2={sy(t.at)} />
      {/each}
    </g>

    {#if crosshair && active}
      <g class="sc-chart-crosshair">
        <line x1={sx(active.x)} x2={sx(active.x)} y1="0" y2={size.block} />
        <line x1="0" x2={size.inline} y1={sy(active.y)} y2={sy(active.y)} />
      </g>
    {/if}

    {#each layout.series as s (s.series ?? s.seriesIndex)}
      <g class="sc-scatter-series">
        {#each s.points as point, index (`${point.value.x}-${point.value.y}-${index}`)}
          {@const focused = cursor.series === s.seriesIndex && cursor.point === index}
          <!-- 点は結ばない(結ぶと順序があることになる)。焦点を受けるのは点である -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <circle
            class="sc-scatter-point"
            class:sc-scatter-appear={animateOnAppear}
            data-cursor={focused ? 'true' : undefined}
            cx={sx(point.x)}
            cy={sy(point.y)}
            r={point.diameter / 2}
            fill={color(s.seriesIndex)}
            stroke={color(s.seriesIndex)}
            role="img"
            aria-label={describe(point)}
            tabindex={focused ? 0 : -1}
            onfocus={() => {
              cursor = { series: s.seriesIndex, point: index };
              active = point;
            }}
            onblur={() => (active = null)}
            onpointerenter={() => (active = point)}
            onpointerleave={() => (active = null)}
            onclick={() => onpointactivate?.({ x: point.value.x, y: point.value.y, series: point.series })}
          />
        {/each}
      </g>
    {/each}
  </svg>
{/snippet}

{#snippet tooltipSnippet()}
  {#if active}
    <div
      class="sc-chart-tooltip"
      role="status"
      style={`--sc-x: ${sx(active.x)}px; --sc-y: ${sy(active.y) - active.diameter / 2}px`}
    >
      {describe(active)}
    </div>
  {/if}
{/snippet}
