/** 既定値の単一の源。契約(contracts/LineChart)と照合する(conformance)。 */
export const META = {
  props: {
    // 線の上の点。既定は出さない(第3条の抑制)。孤立した点だけは指定が無くても出る
    markers: { default: false },
    // 値が無いところの扱い。break は切る、bridge は点線の橋を架ける(橋は必ず点線)
    missingValues: { values: ['break', 'bridge'], default: 'break' },
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

export type LineChartMissingValues = (typeof META.props.missingValues.values)[number];
