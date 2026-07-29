/** 既定値の単一の源。契約(contracts/AreaChart)と照合する(conformance)。 */
export const META = {
  props: {
    // 面の重ね方。既定は積む(重ねただけの面は互いを隠す。棒とはここだけ既定が違う)
    stacking: { values: ['group', 'stacked', 'normalized'], default: 'stacked' },
    markers: { default: false },
    gaps: { values: ['break', 'bridge'], default: 'break' },
    // 描くデータと対応づけ(既定値を持たない。契約 Chart)
    data: {},
    encoding: {},
    // 軸の種類。省くと図が決める(棒はカテゴリ、折れ線と面は量か時間)
    scale: {},
    legend: { default: false },
    tooltip: { default: true },
    crosshair: { default: false },
    hidden: {},
    animateOnAppear: { default: false },
    ratio: {},
    label: {},
    description: {},
    tableLabel: {},
    emptyLabel: {},
  },
} as const;

export type AreaChartStacking = (typeof META.props.stacking.values)[number];
