import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LineChart from './LineChart.svelte';
import AreaChart from '../AreaChart/AreaChart.svelte';

const monthly = [
  { 月: '1月', 件数: 120, 区分: '甲' },
  { 月: '2月', 件数: 150, 区分: '甲' },
  { 月: '3月', 件数: 90, 区分: '甲' },
  { 月: '1月', 件数: 80, 区分: '乙' },
  { 月: '2月', 件数: 110, 区分: '乙' },
  { 月: '3月', 件数: 130, 区分: '乙' },
];
const base = {
  data: monthly,
  encoding: { x: '月', y: '件数', color: '区分' },
  scale: { x: 'category' as const },
  label: '月別の件数',
  tableLabel: '表で見る',
  locale: 'ja-JP',
};

const points = (container: HTMLElement) => [...container.querySelectorAll('.sc-linearea-point')];
const lines = (container: HTMLElement) => [...container.querySelectorAll('.sc-linearea-line')];

describe('LineChart', () => {
  test('図はまとまりで、名前を持つ', () => {
    render(LineChart, { props: base });
    expect(screen.getByRole('group', { name: '月別の件数' })).toBeTruthy();
  });

  test('系列ごとに線を引く', () => {
    const { container } = render(LineChart, { props: base });
    expect(lines(container)).toHaveLength(2);
  });

  test('点は名前と値を読み上げる', () => {
    const { container } = render(LineChart, { props: base });
    expect(points(container)[0]!.getAttribute('aria-label')).toBe('1月 甲 120');
  });

  test('印は既定で出ない（属性で見分ける）', () => {
    const { container } = render(LineChart, { props: base });
    expect(points(container).every((p) => p.getAttribute('data-visible') == null)).toBe(true);
  });

  test('印を指定すると出る', () => {
    const { container } = render(LineChart, { props: { ...base, markers: true } });
    expect(points(container).every((p) => p.getAttribute('data-visible') === 'true')).toBe(true);
  });

  test('前後が欠けた点は指定が無くても印を出す', () => {
    const { container } = render(LineChart, {
      props: {
        ...base,
        data: [{ 月: '1月' }, { 月: '2月', 件数: 5 }, { 月: '3月' }, { 月: '4月', 件数: 7 }, { 月: '5月', 件数: 9 }],
        encoding: { x: '月', y: '件数' },
      },
    });
    const visible = points(container).filter((p) => p.getAttribute('data-visible') === 'true');
    expect(visible).toHaveLength(1);
    expect(visible[0]!.getAttribute('aria-label')).toBe('2月 5');
  });

  test('値が無いところで線が切れる', () => {
    const { container } = render(LineChart, {
      props: {
        ...base,
        data: [{ 月: '1月', 件数: 1 }, { 月: '2月', 件数: 2 }, { 月: '3月' }, { 月: '4月', 件数: 4 }, { 月: '5月', 件数: 5 }],
        encoding: { x: '月', y: '件数' },
      },
    });
    expect(lines(container)).toHaveLength(2);
    expect(container.querySelectorAll('.sc-linearea-bridge')).toHaveLength(0);
  });

  test('橋を指定すると点線で繋ぐ（実線にはしない）', () => {
    const { container } = render(LineChart, {
      props: {
        ...base,
        gaps: 'bridge' as const,
        data: [{ 月: '1月', 件数: 1 }, { 月: '2月' }, { 月: '3月', 件数: 3 }],
        encoding: { x: '月', y: '件数' },
      },
    });
    const bridge = container.querySelector('.sc-linearea-bridge');
    expect(bridge).not.toBeNull();
    expect(bridge!.classList.contains('sc-linearea-line')).toBe(false);
  });

  test('鍵盤は構造どおりに動く', async () => {
    const { container } = render(LineChart, { props: base });
    const svg = container.querySelector('svg')!;
    const at = () => container.querySelector('[data-cursor="true"]')!.getAttribute('aria-label');
    expect(at()).toBe('1月 甲 120');
    await fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(at()).toBe('2月 甲 150');
    await fireEvent.keyDown(svg, { key: 'ArrowDown' });
    expect(at()).toBe('2月 乙 110');
  });

  test('押すと指した点をアプリへ渡す', async () => {
    const onpointactivate = vi.fn();
    const { container } = render(LineChart, { props: { ...base, onpointactivate } });
    await fireEvent.click(points(container)[0]!);
    expect(onpointactivate).toHaveBeenCalledWith({ category: '1月', series: '甲', value: 120 });
  });

  test('表は常に在り、畳んで置く', () => {
    render(LineChart, { props: base });
    const summary = screen.getByText('表で見る');
    expect(summary.closest('details')?.open).toBe(false);
  });

  test('データが空なら言葉を出す', () => {
    const { container } = render(LineChart, {
      props: { ...base, data: [], emptyLabel: 'データがありません' },
    });
    expect(container.querySelector('.sc-chart-empty')!.textContent).toBe('データがありません');
  });

  test('凡例を指定すると系列を切り替えられる', async () => {
    const onhiddenchange = vi.fn();
    const { container } = render(LineChart, { props: { ...base, legend: true, onhiddenchange } });
    const buttons = container.querySelectorAll('.sc-chart-legend-item');
    expect(buttons).toHaveLength(2);
    await fireEvent.click(buttons[1]!);
    expect(onhiddenchange).toHaveBeenCalledWith(['乙']);
  });

  test('隠した系列は描かない', () => {
    const { container } = render(LineChart, { props: { ...base, hidden: ['乙'] } });
    expect(lines(container)).toHaveLength(1);
  });

  test('同じ点に二つの行が来たら開発時に知らせる', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(LineChart, {
      props: { ...base, data: [{ 月: '1月', 件数: 1 }, { 月: '1月', 件数: 2 }], encoding: { x: '月', y: '件数' } },
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('行が二つ以上あります'));
    warn.mockRestore();
  });
});

describe('AreaChart', () => {
  test('面を塗る', () => {
    const { container } = render(AreaChart, { props: base });
    expect(container.querySelectorAll('.sc-linearea-fill').length).toBeGreaterThan(0);
  });

  test('折れ線は塗らない', () => {
    const { container } = render(LineChart, { props: base });
    expect(container.querySelectorAll('.sc-linearea-fill')).toHaveLength(0);
  });

  test('積むのが既定（棒とはここだけ既定が違う）', () => {
    const { container } = render(AreaChart, { props: base });
    // 積んだ二区画は接する: 下の系列の点の位置が、上の系列の下端になる
    const paths = [...container.querySelectorAll('.sc-linearea-fill')].map((p) => p.getAttribute('d'));
    expect(paths).toHaveLength(2);
    expect(paths[0]).not.toBe(paths[1]);
  });

  test('表には積む前の生の値が並ぶ', async () => {
    render(AreaChart, { props: base });
    await fireEvent.click(screen.getByText('表で見る'));
    expect(screen.getByRole('cell', { name: '120' })).toBeTruthy();
  });
});

describe('描き込み', () => {
  test('指定すると拭き取りの矩形が出る（線が伸びる動き。棒のように下からせり上がらない）', () => {
    const { container } = render(LineChart, { props: { ...base, animateOnAppear: true } });
    const wipe = container.querySelector('clipPath .sc-linearea-wipe');
    expect(wipe).not.toBeNull();
    const series = container.querySelector('.sc-linearea-series')!;
    expect(series.getAttribute('clip-path')).toMatch(/^url\(#/);
  });

  test('指定しなければ拭き取らない', () => {
    const { container } = render(LineChart, { props: base });
    expect(container.querySelector('.sc-linearea-wipe')).toBeNull();
    expect(container.querySelector('.sc-linearea-series')!.getAttribute('clip-path')).toBeNull();
  });

  test('面でも同じ動きを使う', () => {
    const { container } = render(AreaChart, { props: { ...base, animateOnAppear: true } });
    expect(container.querySelector('clipPath .sc-linearea-wipe')).not.toBeNull();
  });
});
