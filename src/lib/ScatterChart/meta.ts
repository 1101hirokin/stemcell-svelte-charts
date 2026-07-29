/** 既定値の単一の源。契約(contracts/ScatterChart)と照合する(conformance)。 */
export const META = {
  props: {
    // いちばん大きい点の直径(px)。省くと図が決める
    pointSize: {},
    // 軸の種類。散布は両方とも量か時間である
    scale: {},
    crosshair: { default: false },
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
