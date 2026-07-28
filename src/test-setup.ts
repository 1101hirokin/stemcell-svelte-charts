/**
 * jsdom には ResizeObserver が無い。図は置かれた場所の大きさを読むので(高さは場所に従う)、
 * 観測の口だけ埋める。jsdom は配置を計算しないため、どのみち大きさは 0 で返る: ここで測れるのは
 * 構造と読み上げと鍵盤であって、寸法は実物(playground + Chromium)で測る。
 */
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = NoopResizeObserver;
}
