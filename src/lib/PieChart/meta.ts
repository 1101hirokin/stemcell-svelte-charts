/** 既定値の単一の源。契約(contracts/PieChart)と照合する(conformance)。 */
export const META = {
  props: {
    // 中心の穴。none は円、donut は輪
    hole: { values: ['none', 'donut'], default: 'none' },
    data: {},
    encoding: {},
    legend: { default: false },
    tooltip: { default: true },
    hidden: {},
    animateOnAppear: { default: false },
    ratio: {},
    label: {},
    description: {},
    tableLabel: {},
    emptyLabel: {},
  },
} as const;

export type PieChartHole = (typeof META.props.hole.values)[number];
