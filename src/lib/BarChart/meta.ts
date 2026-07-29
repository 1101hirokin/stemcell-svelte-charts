/** 既定値の単一の源。契約(contracts/BarChart)と照合する(conformance)。 */
export const META = {
  props: {
    // 棒が伸びる向き。カテゴリが並ぶ軸ではなく棒の向きで名付ける(BarChart.md §2)
    orientation: { values: ['vertical', 'horizontal'], default: 'vertical' },
    // 系列の重ね方
    stacking: { values: ['group', 'stacked', 'normalized'], default: 'group' },
    // 棒の先に値を出す。既定は出さない(第3条の抑制)
    valueLabels: { default: false },
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

export type BarChartOrientation = (typeof META.props.orientation.values)[number];
export type BarChartStacking = (typeof META.props.stacking.values)[number];

/**
 * Web の方言。中立の契約には無い。
 *
 * - 分類の色は 6 段で、7 系列目からは回して使う(dataviz §3 の TODO は「回すか拒むか」を各図に
 *   残している。拒むと図が出ないので回す。同じ色が二度出るぶんは直接ラベルと凡例で区別が付く)。
 */
export const WEB = {
  categoricalRungs: 6,
} as const;
