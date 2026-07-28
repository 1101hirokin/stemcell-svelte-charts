import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BarChart from './BarChart.svelte';

const data = [
  { 月: '1月', 売上: 120, 区分: '実績' },
  { 月: '1月', 売上: 100, 区分: '予算' },
  { 月: '2月', 売上: 150, 区分: '実績' },
  { 月: '2月', 売上: 140, 区分: '予算' },
];
const base = {
  data,
  encoding: { x: '月', y: '売上', color: '区分' },
  label: '月別の売上',
  tableLabel: '表で見る',
  locale: 'ja-JP',
};

const bars = (container: HTMLElement) => [...container.querySelectorAll('.sc-barchart-bar')];

describe('BarChart', () => {
  test('図はまとまりで、名前を持つ', () => {
    render(BarChart, { props: base });
    const group = screen.getByRole('group', { name: '月別の売上' });
    expect(group).toBeTruthy();
  });

  test('棒は行の数だけ出る', () => {
    const { container } = render(BarChart, { props: base });
    expect(bars(container)).toHaveLength(4);
  });

  test('棒は名前と値を読み上げる', () => {
    const { container } = render(BarChart, { props: base });
    expect(bars(container)[0]!.getAttribute('aria-label')).toBe('1月 実績 120');
  });

  test('系列は分類の色を順に引く(図が自分で色を決めない)', () => {
    const { container } = render(BarChart, { props: base });
    const fills = bars(container).map((bar) => bar.getAttribute('fill'));
    expect(fills[0]).toBe('var(--color-dataviz-categorical-1)');
    expect(fills[1]).toBe('var(--color-dataviz-categorical-2)');
  });

  test('表は常に在り、畳んで置く', () => {
    render(BarChart, { props: base });
    const summary = screen.getByText('表で見る');
    expect(summary).toBeTruthy();
    expect(summary.closest('details')?.open).toBe(false);
  });

  test('表には隠した系列も含む生の値が並ぶ', async () => {
    render(BarChart, { props: { ...base, hidden: ['予算'] } });
    await fireEvent.click(screen.getByText('表で見る'));
    expect(screen.getByRole('columnheader', { name: '予算' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '140' })).toBeTruthy();
  });

  test('凡例は既定で出ない(系列の数で自動的に切り替えない)', () => {
    const { container } = render(BarChart, { props: base });
    expect(container.querySelector('.sc-barchart-legend')).toBeNull();
  });

  test('凡例を指定すると系列を切り替えられる。値はアプリが持つ', async () => {
    const onhiddenchange = vi.fn();
    const { container } = render(BarChart, { props: { ...base, legend: true, onhiddenchange } });
    const buttons = container.querySelectorAll('.sc-barchart-legend-item');
    expect(buttons).toHaveLength(2);
    await fireEvent.click(buttons[1]!);
    expect(onhiddenchange).toHaveBeenCalledWith(['予算']);
    // 部品は自分では隠さない(値を持たない)
    expect(bars(container)).toHaveLength(4);
  });

  test('隠した系列は描かない', () => {
    const { container } = render(BarChart, { props: { ...base, hidden: ['予算'] } });
    expect(bars(container)).toHaveLength(2);
  });

  test('鍵盤は構造どおりに動く。向きで入れ替えない', async () => {
    const { container } = render(BarChart, { props: base });
    const svg = container.querySelector('svg')!;
    const cursor = () => container.querySelector('[data-cursor="true"]')!.getAttribute('aria-label');
    expect(cursor()).toBe('1月 実績 120');
    await fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(cursor()).toBe('2月 実績 150');
    await fireEvent.keyDown(svg, { key: 'ArrowDown' });
    expect(cursor()).toBe('2月 予算 140');
    await fireEvent.keyDown(svg, { key: 'Home' });
    expect(cursor()).toBe('1月 予算 100');
  });

  test('横棒でも鍵盤の軸は同じ', async () => {
    const { container } = render(BarChart, {
      props: { ...base, orientation: 'horizontal' as const, encoding: { y: '月', x: '売上', color: '区分' } },
    });
    const svg = container.querySelector('svg')!;
    await fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(container.querySelector('[data-cursor="true"]')!.getAttribute('aria-label')).toBe('2月 実績 150');
  });

  test('端では止まる', async () => {
    const { container } = render(BarChart, { props: base });
    const svg = container.querySelector('svg')!;
    await fireEvent.keyDown(svg, { key: 'ArrowLeft' });
    expect(container.querySelector('[data-cursor="true"]')!.getAttribute('aria-label')).toBe('1月 実績 120');
  });

  test('押すと指した点をアプリへ渡す', async () => {
    const onpointactivate = vi.fn();
    const { container } = render(BarChart, { props: { ...base, onpointactivate } });
    await fireEvent.click(bars(container)[0]!);
    expect(onpointactivate).toHaveBeenCalledWith({ category: '1月', series: '実績', value: 120 });
  });

  test('鍵盤でも活性化できる', async () => {
    const onpointactivate = vi.fn();
    const { container } = render(BarChart, { props: { ...base, onpointactivate } });
    await fireEvent.keyDown(container.querySelector('svg')!, { key: 'Enter' });
    expect(onpointactivate).toHaveBeenCalledWith({ category: '1月', series: '実績', value: 120 });
  });

  test('カテゴリの名前は出るが、切り詰めても全文が残る', () => {
    const { container } = render(BarChart, { props: base });
    const label = container.querySelector('.sc-barchart-category')!;
    expect(label.textContent).toBe('1月');
    expect(label.getAttribute('title')).toBe('1月');
  });

  test('値のラベルは指定したときだけ出る', () => {
    const { container } = render(BarChart, { props: base });
    expect(container.querySelector('.sc-barchart-value-marks')).toBeNull();
    const { container: withLabels } = render(BarChart, { props: { ...base, valueLabels: true } });
    expect(withLabels.querySelector('.sc-barchart-value-marks')).not.toBeNull();
  });

  test('データが空なら言葉を出す', () => {
    const { container } = render(BarChart, { props: { ...base, data: [], emptyLabel: 'データがありません' } });
    expect(container.querySelector('.sc-barchart-empty')!.textContent).toBe('データがありません');
  });

  test('同じ棒に二つの行が来たら開発時に知らせる', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(BarChart, {
      props: { ...base, data: [{ 月: '1月', 売上: 1 }, { 月: '1月', 売上: 2 }], encoding: { x: '月', y: '売上' } },
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('行が二つ以上あります'));
    warn.mockRestore();
  });

  test('長い説明は読み上げへ渡す', () => {
    const { container } = render(BarChart, { props: { ...base, description: '1月から2月へ増えている' } });
    const group = container.querySelector('.sc-barchart')!;
    const id = group.getAttribute('aria-describedby')!;
    expect(container.querySelector(`#${id}`)!.textContent).toBe('1月から2月へ増えている');
  });

  test('100% 積み上げでは割合も読み上げる', () => {
    const { container } = render(BarChart, { props: { ...base, stacking: 'normalized' as const } });
    expect(bars(container)[0]!.getAttribute('aria-label')).toBe('1月 実績 120 55%');
  });
});
