<script lang="ts">
  import Frame from './Frame.svelte';
  import './line-area.css';
  import {
    formatTicks,
    formatTimeTicks,
    formatValue,
    lineLayout,
    move,
    tableModel,
    type AxisKind,
    type Cursor,
    type Encoding,
    type LinePoint,
    type Move,
    type Row,
    type Stacking,
  } from '@stemcell/charts-core';
  import { tick } from 'svelte';

  // 折れ線と面の中身。二つの部品が同じ絵を描き、違うのは既定(積むか、ゼロ基線を含むか、塗るか)
  // だけなので、描く仕事はここが持つ(charts/LineChart.md / charts/AreaChart.md)。
  interface Props {
    data: Row[];
    encoding: Encoding;
    scale?: { x?: AxisKind };
    stacking?: Stacking | 'none';
    markers?: boolean;
    gaps?: 'break' | 'bridge';
    legend?: boolean;
    tooltip?: boolean;
    crosshair?: boolean;
    hidden?: string[];
    animateOnAppear?: boolean;
    ratio?: string;
    label: string;
    description?: string;
    tableLabel: string;
    emptyLabel?: string;
    locale?: string;
    onhiddenchange?: (hidden: string[]) => void;
    onpointactivate?: (point: { category: string; series: string | null; value: number }) => void;
    /** 面として塗るか。AreaChart だけが立てる。 */
    fill?: boolean;
    /** ゼロ基線を含めるか。折れ線は含めない、面は含める。 */
    includeZero?: boolean;
  }

  let {
    data,
    encoding,
    scale,
    stacking = 'none',
    markers = false,
    gaps = 'break',
    legend = false,
    tooltip = true,
    crosshair = false,
    hidden,
    animateOnAppear = false,
    ratio,
    label,
    description,
    tableLabel,
    emptyLabel,
    locale,
    onhiddenchange,
    onpointactivate,
    fill = false,
    includeZero = false,
  }: Props = $props();

  const RUNGS = 6;
  const color = (index: number) => `var(--color-dataviz-categorical-${(index % RUNGS) + 1})`;

  let size = $state({ inline: 0, block: 0 });
  let cursor = $state<Cursor>({ series: 0, point: 0 });
  let active = $state<number | null>(null); // 指している列の順番
  let plotEl: SVGSVGElement | undefined = $state();

  const xKind = $derived(scale?.x ?? 'linear');
  const layout = $derived(
    lineLayout({
      rows: data,
      encoding,
      xKind,
      stacking,
      includeZero,
      // 画面の箱を軸へ倒す。折れ線は向きを持たないので、x は横、y は量の軸
      plot: { x: size.inline, y: size.block },
      hidden,
      // TODO: 端の点の印が場所の縁で切れる。charts-core#2(xPadding)がマージされたら 6px 渡す
    }),
  );

  const valueTicks = $derived.by(() => {
    const values = layout.ticks.map((t) => t.value);
    const step = Math.abs((values[1] ?? 1) - (values[0] ?? 0)) || 1;
    const labels = formatTicks(values, step, {
      locale,
      percent: layout.valueKind === 'share',
      compact: layout.valueKind === 'value',
    });
    return layout.ticks.map((t, i) => ({ at: size.block - t.at, label: labels[i] ?? '' }));
  });

  const xTicks = $derived.by(() => {
    const labels =
      layout.xKind === 'time' && layout.time
        ? formatTimeTicks(layout.time, locale)
        : layout.xTicks.map((t) => (t.label ? t.label : formatValue(t.value, { locale, compact: true })));
    const width = layout.xTicks.length > 1 ? Math.abs(layout.xTicks[1]!.at - layout.xTicks[0]!.at) : size.inline;
    return layout.xTicks.map((t, i) => ({ at: t.at, size: Math.max(width, 8), label: labels[i] ?? '' }));
  });

  // 画面へ倒す。量の軸は下から上なので上下を返す(計算層は向きを持たない)
  const sy = (y: number): number => size.block - y;

  const path = (points: LinePoint[]): string =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ');

  const areaPath = (points: LinePoint[]): string => {
    const top = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ');
    const bottom = [...points]
      .reverse()
      .map((p) => `L${p.x.toFixed(2)},${sy(p.yBase).toFixed(2)}`)
      .join(' ');
    return `${top} ${bottom} Z`;
  };

  const empty = $derived(layout.series.every((s) => s.points.length === 0));

  $effect(() => {
    for (const duplicate of layout.duplicates) {
      console.warn(
        `[stemcell] ${fill ? 'AreaChart' : 'LineChart'}: ${duplicate.category} / ${duplicate.series ?? '(系列なし)'} に行が二つ以上あります。` +
          '足さずに後の行を描きました(図は集計しない。dataviz §2)。',
      );
    }
  });

  const table = $derived(tableModel({ rows: data, encoding }));

  const describePoint = (p: LinePoint): string => {
    const value = formatValue(p.value, { locale });
    return p.series ? `${p.category} ${p.series} ${value}` : `${p.category} ${value}`;
  };

  // 指したときは、その位置の全系列を返す(折れ線を読む仕事の多くは系列の比較。LineChart.md §2)
  const columnAt = (order: number) => layout.categories[order];
  const atColumn = $derived.by(() => {
    if (active == null) return null;
    const category = columnAt(active);
    if (category == null) return null;
    const points = layout.series
      .map((s) => s.points.find((p) => p.category === category))
      .filter((p): p is LinePoint => !!p);
    if (points.length === 0) return null;
    return { category, points, x: points[0]!.x, y: Math.min(...points.map((p) => sy(p.y))) };
  });

  function handlePointer(event: PointerEvent) {
    if (!plotEl || layout.categories.length === 0) return;
    const box = plotEl.getBoundingClientRect();
    const x = event.clientX - box.left;
    let best = 0;
    let bestDistance = Infinity;
    layout.categories.forEach((category, order) => {
      const point = layout.series.flatMap((s) => s.points).find((p) => p.category === category);
      if (!point) return;
      const distance = Math.abs(point.x - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = order;
      }
    });
    active = best;
  }

  const KEYS: Record<string, Move> = {
    ArrowRight: 'next',
    ArrowLeft: 'prev',
    ArrowDown: 'nextSeries',
    ArrowUp: 'prevSeries',
    Home: 'first',
    End: 'last',
  };
  const pointAt = (position: Cursor): LinePoint | undefined =>
    layout.series[position.series]?.points[position.point];

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      const point = pointAt(cursor);
      if (!point) return;
      event.preventDefault();
      onpointactivate?.({ category: point.category, series: point.series, value: point.value });
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
    const point = pointAt(next);
    active = point ? layout.categories.indexOf(point.category) : null;
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
  tooltip={tooltip && atColumn ? tooltipSnippet : undefined}
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
    onpointermove={handlePointer}
    onpointerleave={() => (active = null)}
  >
    <!-- グリッドは量の軸にだけ引く。枠では囲まない(dataviz §4-2) -->
    <g class="sc-chart-grid">
      {#each layout.ticks as t (t.value)}
        <line x1="0" x2={size.inline} y1={sy(t.at)} y2={sy(t.at)} />
      {/each}
    </g>

    {#if crosshair && atColumn}
      <g class="sc-chart-crosshair"><line x1={atColumn.x} x2={atColumn.x} y1="0" y2={size.block} /></g>
    {/if}

    <g class="sc-chart-baseline"><line x1="0" x2={size.inline} y1={sy(layout.baseline)} y2={sy(layout.baseline)} /></g>

    {#each layout.series as s (s.series ?? s.seriesIndex)}
      <g class="sc-linearea-series" class:sc-linearea-appear={animateOnAppear}>
        {#if fill}
          {#each s.segments as segment, index (index)}
            {#if segment.length > 1}
              <path class="sc-linearea-fill" d={areaPath(segment)} fill={color(s.seriesIndex)} />
            {/if}
          {/each}
        {/if}
        {#each s.segments as segment, index (index)}
          {#if segment.length > 1}
            <path class="sc-linearea-line" d={path(segment)} stroke={color(s.seriesIndex)} fill="none" />
          {/if}
        {/each}
        {#if gaps === 'bridge'}
          <!-- 橋は必ず点線。実線にすると観測と非観測の区別が消える(LineChart.md §2) -->
          {#each s.bridges as bridge, index (index)}
            <path class="sc-linearea-bridge" d={path(bridge)} stroke={color(s.seriesIndex)} fill="none" />
          {/each}
        {/if}
        {#each s.points as point (point.category)}
          {@const focused = cursor.series === s.seriesIndex && layout.series[s.seriesIndex]?.points[cursor.point] === point}
          <!-- 印は指定で出す。ただし孤立した点は必ず出す(出さないと観測が図から消える) -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <circle
            class="sc-linearea-point"
            data-visible={markers || point.isolated ? 'true' : undefined}
            data-cursor={focused ? 'true' : undefined}
            cx={point.x}
            cy={sy(point.y)}
            r="4"
            fill={color(s.seriesIndex)}
            role="img"
            aria-label={describePoint(point)}
            tabindex={focused ? 0 : -1}
            onfocus={() => {
              cursor = { series: s.seriesIndex, point: s.points.indexOf(point) };
              active = layout.categories.indexOf(point.category);
            }}
            onclick={() => onpointactivate?.({ category: point.category, series: point.series, value: point.value })}
          />
        {/each}
      </g>
    {/each}
  </svg>
{/snippet}

{#snippet tooltipSnippet()}
  {#if atColumn}
    <div class="sc-chart-tooltip" role="status" style={`--sc-x: ${atColumn.x}px; --sc-y: ${atColumn.y}px`}>
      <dl>
        <dt>{atColumn.category}</dt>
        <dd></dd>
        {#each atColumn.points as point (point.series ?? point.seriesIndex)}
          <dt>{point.series ?? label}</dt>
          <dd>{formatValue(point.value, { locale })}</dd>
        {/each}
      </dl>
    </div>
  {/if}
{/snippet}
