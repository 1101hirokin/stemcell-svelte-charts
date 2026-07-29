/**
 * 読みの向き。環境から取る（第6条: 文脈は環境から）。
 *
 * SVG の座標は物理である（x は常に左から右へ増える）。一方、札は HTML の論理プロパティで置くので、
 * RTL では自動で右から始まる。両方を放っておくと、絵と札が逆を向く。だから RTL では絵の x を鏡にして、
 * 札の自動反転と揃える。
 */
export function isRtl(element: Element | undefined | null): boolean {
  if (!element || typeof getComputedStyle !== 'function') return false;
  return getComputedStyle(element).direction === 'rtl';
}

/** 鏡にした x。RTL では読みの始まりが右になる。 */
export const mirror = (x: number, width: number, rtl: boolean): number => (rtl ? width - x : x);

/**
 * 向きを見張る。一度読んで終わりにしないのは、アプリが後から向きを変えることがあるからである
 * （地域の切り替え、文書の一部だけ RTL）。dir は祖先のどこにでも付きうるので、文書の根と、
 * 図が置かれた枝の両方を見る。
 */
export function observeDirection(element: Element | undefined | null, onChange: () => void): () => void {
  if (!element || typeof MutationObserver !== 'function') return () => {};
  const observer = new MutationObserver(onChange);
  const options = { attributes: true, attributeFilter: ['dir', 'lang'] };
  const roots: Element[] = [];
  if (element.ownerDocument?.documentElement) roots.push(element.ownerDocument.documentElement);
  for (let node = element.parentElement; node; node = node.parentElement) roots.push(node);
  for (const root of roots) observer.observe(root, options);
  return () => observer.disconnect();
}
