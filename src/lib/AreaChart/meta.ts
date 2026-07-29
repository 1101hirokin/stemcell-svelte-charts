/** 既定値の単一の源。契約(contracts/AreaChart)と照合する。 */
export const META = {
  props: {
    // 面の重ね方。既定は積む(重ねただけの面は互いを隠す。棒とはここだけ既定が違う)
    stacking: { values: ['group', 'stacked', 'normalized'], default: 'stacked' },
    markers: { default: false },
    gaps: { values: ['break', 'bridge'], default: 'break' },
    legend: { default: false },
    tooltip: { default: true },
    crosshair: { default: false },
    animateOnAppear: { default: false },
  },
} as const;

export type AreaChartStacking = (typeof META.props.stacking.values)[number];
