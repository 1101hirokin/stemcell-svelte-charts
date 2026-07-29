<script lang="ts">
  import './Sparkline.css';
  import {
    formatValue,
    lineLayout,
    summarize,
    type AxisKind,
    type Encoding,
    type Row,
  } from '@stemcell/charts-core';
  import { isRtl, mirror, observeDirection } from '../internal/direction';

  // 文や表のセルの中に置く、軸も凡例も持たない小さな線(charts/Sparkline.md)。
  // Chart を継がない: 表・凡例・長い説明の口を持たず、表の代わりに要約を読み上げへ渡す。
  interface Props {
    data: Row[];
    encoding: Encoding;
    scale?: { x?: AxisKind };
    /** 図の名前。読み上げの要約の頭に置く。 */
    label: string;
    /** 要約で値を言うときの単位や言い回し(「件」「円」)。DS は文言を持たない。 */
    unit?: string;
    locale?: string;
  }

  let { data, encoding, scale, label, unit, locale }: Props = $props();

  let size = $state({ inline: 0, block: 0 });
  let rootEl: HTMLElement | undefined = $state();
  let rtl = $state(false);
  $effect(() => {
    void size.inline;
    const read = () => (rtl = isRtl(rootEl));
    read();
    return observeDirection(rootEl, read);
  });

  const layout = $derived(
    lineLayout({
      rows: data,
      encoding,
      xKind: scale?.x ?? 'category',
      plot: { x: Math.max(size.inline, 1), y: Math.max(size.block, 1) },
      xPadding: 1,
    }),
  );

  const sx = (x: number): number => mirror(x, Math.max(size.inline, 1), rtl);
  const sy = (y: number): number => Math.max(size.block, 1) - y;
  const path = $derived(
    layout.series[0]?.segments
      .filter((segment) => segment.length > 1)
      .map((segment) => segment.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' '))
      .join(' ') ?? '',
  );
  /** 前後がどちらも欠けている点は、線を引く相手が無いので印を出す(LineChart と同じ)。 */
  const isolated = $derived(layout.series[0]?.points.filter((p) => p.isolated) ?? []);

  // 表を持たない代わりに、形の要点を読み上げへ渡す(dataviz §4 の唯一の例外)
  const summary = $derived(summarize(data, encoding.y ?? ''));
  /** 読み上げの中で数のうしろに付ける。単位が無ければ何も付けない。 */
  const suffix = $derived(unit ? ` ${unit}` : '');
  const description = $derived(
    summary.count === 0
      ? label
      : `${label}: ${summary.count}、` +
        `最小 ${formatValue(summary.min ?? 0, { locale })}${suffix}、` +
        `最大 ${formatValue(summary.max ?? 0, { locale })}${suffix}、` +
        `最後 ${formatValue(summary.last ?? 0, { locale })}${suffix}`,
  );
</script>

<!-- 一枚の絵として届く(role=img)。中の点は焦点を受けない: 文の中の図に停留所を作らない -->
<span
  class="sc-sparkline"
  role="img"
  aria-label={description}
  bind:this={rootEl}
  bind:clientWidth={size.inline}
  bind:clientHeight={size.block}
>
  <svg width={Math.max(size.inline, 1)} height={Math.max(size.block, 1)} aria-hidden="true">
    {#if path}<path class="sc-sparkline-line" d={path} fill="none" />{/if}
    {#each isolated as point (point.category)}
      <circle class="sc-sparkline-point" cx={sx(point.x)} cy={sy(point.y)} r="1.5" />
    {/each}
  </svg>
</span>
