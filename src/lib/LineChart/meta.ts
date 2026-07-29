/** 既定値の単一の源。契約(contracts/LineChart)と照合する。 */
export const META = {
  props: {
    // 線の上の点。既定は出さない(第3条の抑制)。孤立した点だけは指定が無くても出る
    markers: { default: false },
    // 値が無いところの扱い。break は切る、bridge は点線の橋を架ける(橋は必ず点線)
    gaps: { values: ['break', 'bridge'], default: 'break' },
    legend: { default: false },
    tooltip: { default: true },
    crosshair: { default: false },
    animateOnAppear: { default: false },
  },
} as const;

export type LineChartGaps = (typeof META.props.gaps.values)[number];
