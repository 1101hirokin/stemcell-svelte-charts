/** 既定値の単一の源。契約(contracts/BarChart)と照合する。 */
export const META = {
  props: {
    // 棒が伸びる向き。カテゴリが並ぶ軸ではなく棒の向きで名付ける(BarChart.md §2)
    orientation: { values: ['vertical', 'horizontal'], default: 'vertical' },
    // 系列の重ね方
    stacking: { values: ['group', 'stacked', 'normalized'], default: 'group' },
    // 棒の先に値を出す。既定は出さない(第3条の抑制)
    valueLabels: { default: false },
    // 凡例。既定は出さず、系列の数で自動的に切り替えない
    legend: { default: false },
    // 指したものの値を見せる
    tooltip: { default: true },
    // 指した位置に線を引く
    crosshair: { default: false },
    // 初めて描くときの動き
    animateOnAppear: { default: false },
  },
} as const;

export type BarChartOrientation = (typeof META.props.orientation.values)[number];
export type BarChartStacking = (typeof META.props.stacking.values)[number];

/**
 * Web の方言。中立の契約には無い。
 *
 * - 分類の色は 6 段で、7 系列目からは回して使う(dataviz §3 の TODO は「回すか拒むか」を
 *   各図に残している。拒むと図が出ないので回す。同じ色が二度出るぶんは直接ラベルと凡例で
 *   区別が付く)。
 */
export const WEB = {
  categoricalRungs: 6,
} as const;
