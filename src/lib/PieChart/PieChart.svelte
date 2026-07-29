<script lang="ts">
  import Frame from '../internal/Frame.svelte';
  import '../internal/pie.css';
  import { META, type PieChartHole } from './meta';
  import {
    formatValue,
    move,
    pieLayout,
    pointOnCircle,
    tableModel,
    type Cursor,
    type Encoding,
    type Move,
    type PieSlice,
    type Row,
  } from '@stemcell/charts-core';
  import { tick } from 'svelte';
  import { isRtl, observeDirection } from '../internal/direction';

  // 全体に対する取り分を角度で見る図(charts/PieChart.md)。軸を持たない唯一の図である。
  interface Props {
    data: Row[];
    /** 角度に割り当てる量(theta)と、区分(color)。 */
    encoding: Encoding;
    /** 中心の穴。none は円、donut は輪。 */
    hole?: PieChartHole;
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
    onpointactivate?: (point: { name: string | null; value: number; share: number }) => void;
  }

  let {
    data,
    encoding,
    hole = META.props.hole.default,
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
  /** 名前を引き出す余地と、一行の高さ。札が入るかの判定に使う。 */
  const LABEL_GAP = 12;
  const LINE = 16;

  let size = $state({ inline: 0, block: 0 });
  let cursor = $state<Cursor>({ series: 0, point: 0 });
  let active = $state<PieSlice | null>(null);
  let plotEl: SVGSVGElement | undefined = $state();

  // 読みの向き。RTL では円を鏡にする(扇が反時計回りに並び、描き込みも逆へ掃く)。
  // 他の図で x を鏡にしているのと同じ理由で、読みの始まりを右側に置く
  let rtl = $state(false);
  $effect(() => {
    void size.inline;
    const read = () => (rtl = isRtl(plotEl));
    read();
    return observeDirection(plotEl, read);
  });

  const layout = $derived(
    pieLayout({
      rows: data,
      encoding,
      // 札を外へ引くぶん、円は場所より小さくする
      plot: { x: Math.max(size.inline - LABEL_GAP * 6, 8), y: Math.max(size.block - LINE * 2, 8) },
      hidden,
      hole,
      labelGap: LABEL_GAP,
    }),
  );

  /** 場所の中心へ寄せる(計算層は与えた箱の中心を返す)。 */
  const center = $derived({ x: size.inline / 2, y: size.block / 2 });

  const empty = $derived(layout.slices.length === 0);
  const table = $derived(tableModel({ rows: data, encoding: { x: encoding.color ?? '', y: encoding.theta ?? '' } }));

  $effect(() => {
    for (const duplicate of layout.duplicates) {
      console.warn(
        `[stemcell] PieChart: ${duplicate.name ?? '(区分なし)'} の行が二つ以上あります。` +
          '足さずに後の行を描きました(図は集計しない。dataviz §2)。',
      );
    }
  });

  const describe = (slice: PieSlice): string => {
    const value = formatValue(slice.value, { locale });
    const share = formatValue(slice.share, { locale, percent: true });
    return slice.name ? `${slice.name} ${value} ${share}` : `${value} ${share}`;
  };

  /** RTL では図を鏡にするので、札の位置も鏡にする(文字そのものは反転させない)。 */
  const mirrorPoint = (p: { x: number; y: number }) => (rtl ? { x: size.inline - p.x, y: p.y } : p);

  /** 扇の形。真上から時計回り(計算層が角を持ち、形はここで組む)。 */
  function slicePath(slice: PieSlice): string {
    const outer = layout.radius;
    const inner = layout.innerRadius;
    const start = pointOnCircle(center, outer, slice.start);
    const end = pointOnCircle(center, outer, slice.end);
    const large = slice.end - slice.start > Math.PI ? 1 : 0;
    if (inner <= 0) {
      return `M${center.x},${center.y} L${start.x},${start.y} A${outer},${outer} 0 ${large} 1 ${end.x},${end.y} Z`;
    }
    const innerEnd = pointOnCircle(center, inner, slice.end);
    const innerStart = pointOnCircle(center, inner, slice.start);
    return (
      `M${start.x},${start.y} A${outer},${outer} 0 ${large} 1 ${end.x},${end.y} ` +
      `L${innerEnd.x},${innerEnd.y} A${inner},${inner} 0 ${large} 0 ${innerStart.x},${innerStart.y} Z`
    );
  }

  /**
   * 名前を置けるか。札は扇の外へ引くので、その半径での弧の長さが一行に足りるかで決める。
   * 足りない扇には出さない(値は表と、指したときの表示で届く。PieChart.md §2)。
   */
  const fitsLabel = (slice: PieSlice): boolean => slice.share * 2 * Math.PI * slice.labelRadius >= LINE;

  const KEYS: Record<string, Move> = {
    ArrowRight: 'next',
    ArrowLeft: 'prev',
    Home: 'first',
    End: 'last',
  };
  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      const slice = layout.slices[cursor.point];
      if (!slice) return;
      event.preventDefault();
      onpointactivate?.({ name: slice.name, value: slice.value, share: slice.share });
      return;
    }
    const action = KEYS[event.key];
    if (!action) return;
    // 系列の軸が無いので上下は効かない(扇のあいだを左右で進む)
    const next = move(cursor, action, { series: 1, points: layout.slices.length });
    if (!layout.slices[next.point]) return;
    event.preventDefault();
    cursor = next;
    active = layout.slices[next.point] ?? null;
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
  axes={false}
  series={layout.slices.map((s) => s.name)}
  {hidden}
  {onhiddenchange}
  {color}
  {empty}
  valueTicks={[]}
  categoryTicks={[]}
  content={size.inline}
  scrolls={false}
  {table}
  bind:size
  {plot}
  tooltip={tooltip && active ? tooltipSnippet : undefined}
/>

{#snippet plot()}
  <!-- 掃きは HTML の器に掛ける。SVG の g へ CSS の mask を当てても効かなかった(実測。
       clip-path: inset() のときと同じ罠) -->
  <div class="sc-pie-frame" class:sc-pie-appear={animateOnAppear}>
  <svg
    class="sc-chart-svg"
    width={size.inline}
    height={size.block}
    viewBox={`0 0 ${size.inline} ${size.block}`}
    role="presentation"
    bind:this={plotEl}
    onkeydown={handleKey}
  >
    <!-- 描き込みは 0(真上)から時計回りに掃く。RTL では図ごと鏡にするので、掃きも反時計回りになる -->
    <g class="sc-pie" transform={rtl ? `translate(${size.inline} 0) scale(-1 1)` : undefined}>
      {#each layout.slices as slice, index (slice.name ?? index)}
        {@const focused = cursor.point === index}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <path
          class="sc-pie-slice"
          data-cursor={focused ? 'true' : undefined}
          d={slicePath(slice)}
          fill={color(index)}
          role="img"
          aria-label={describe(slice)}
          tabindex={focused ? 0 : -1}
          onfocus={() => {
            cursor = { series: 0, point: index };
            active = slice;
          }}
          onblur={() => (active = null)}
          onpointerenter={() => (active = slice)}
          onpointerleave={() => (active = null)}
          onclick={() => onpointactivate?.({ name: slice.name, value: slice.value, share: slice.share })}
        />
      {/each}
    </g>

    <!-- 名前は扇の外へ引いて置く。入らない扇には出さない -->
    <g class="sc-pie-labels" aria-hidden="true">
      {#each layout.slices as slice, index (slice.name ?? index)}
        {#if fitsLabel(slice) && slice.name}
          {@const anchor = mirrorPoint(pointOnCircle(center, layout.radius, slice.middle))}
          {@const at = mirrorPoint(pointOnCircle(center, slice.labelRadius, slice.middle))}
          {@const right = at.x >= center.x}
          <line x1={anchor.x} y1={anchor.y} x2={at.x} y2={at.y} />
          <text x={at.x + (right ? 4 : -4)} y={at.y} text-anchor={right ? 'start' : 'end'} dominant-baseline="middle">
            {slice.name}
          </text>
        {/if}
      {/each}
    </g>
  </svg>
  </div>
{/snippet}

{#snippet tooltipSnippet()}
  {#if active}
    {@const at = mirrorPoint(pointOnCircle(center, layout.radius * 0.7, active.middle))}
    <div class="sc-chart-tooltip" role="status" style={`--sc-x: ${at.x}px; --sc-y: ${at.y}px`}>
      {describe(active)}
    </div>
  {/if}
{/snippet}
