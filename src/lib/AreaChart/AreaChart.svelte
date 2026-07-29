<script lang="ts">
  import LineArea from '../internal/LineArea.svelte';
  import { META, type AreaChartStacking } from './meta';
  import type { AxisKind, Encoding, Row } from '@stemcell/charts-core';

  // 折れ線の下を塗る図(charts/AreaChart.md)。積み重なりと取り分を見る。
  // ゼロ基線は省かない(塗った広さが量に見えるので、基線を切ると広さが嘘になる)。
  interface Props {
    data: Row[];
    encoding: Encoding;
    scale?: { x?: AxisKind };
    /** 面の重ね方。既定は積む(重ねただけの面は互いを隠す)。 */
    stacking?: AreaChartStacking;
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
  }

  let {
    stacking = META.props.stacking.default,
    markers = META.props.markers.default,
    gaps = META.props.gaps.default,
    legend = META.props.legend.default,
    tooltip = META.props.tooltip.default,
    crosshair = META.props.crosshair.default,
    animateOnAppear = META.props.animateOnAppear.default,
    ...rest
  }: Props = $props();
</script>

<LineArea
  {...rest}
  {stacking}
  {markers}
  {gaps}
  {legend}
  {tooltip}
  {crosshair}
  {animateOnAppear}
  includeZero={true}
  fill={true}
/>
