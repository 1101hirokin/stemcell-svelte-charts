<script lang="ts">
  import LineArea from '../internal/LineArea.svelte';
  import { META, type LineChartMissingValues } from './meta';
  import type { AxisKind, Encoding, Row } from '@stemcell/charts-core';

  // 位置で量を比べる図(charts/LineChart.md)。点を順に結んで動きを見る。
  // 線の引き方は直線だけで、なめらかな曲線は持たない(測っていない中間を主張するため)。
  interface Props {
    data: Row[];
    encoding: Encoding;
    /** 軸の種類。省くと量の軸(linear)。時間なら time を渡す(等間隔に並べず実時間で置く)。 */
    scale?: { x?: AxisKind };
    /** 線の上に点の印を出す。孤立した点は指定が無くても出る。 */
    markers?: boolean;
    /** 値が無いところの扱い。break は切る、bridge は点線の橋を架ける。 */
    missingValues?: LineChartMissingValues;
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
  }

  let {
    markers = META.props.markers.default,
    missingValues = META.props.missingValues.default,
    legend = META.props.legend.default,
    tooltip = META.props.tooltip.default,
    crosshair = META.props.crosshair.default,
    animateOnAppear = META.props.animateOnAppear.default,
    ...rest
  }: Props = $props();
</script>

<!-- ゼロ基線は省いてよい(位置で比べる図であり、基線は意味を持たない。dataviz §5)。塗らない -->
<LineArea
  {...rest}
  {markers}
  {missingValues}
  {legend}
  {tooltip}
  {crosshair}
  {animateOnAppear}
  stacking="none"
  includeZero={false}
  fill={false}
/>
