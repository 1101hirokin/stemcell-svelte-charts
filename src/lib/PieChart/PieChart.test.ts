import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import PieChart from './PieChart.svelte';
import ScatterChart from '../ScatterChart/ScatterChart.svelte';
import Sparkline from '../Sparkline/Sparkline.svelte';

const share = [
  { 区分: '検索', 件数: 50 },
  { 区分: '直接', 件数: 30 },
  { 区分: 'その他', 件数: 20 },
];
const pieBase = {
  data: share,
  encoding: { theta: '件数', color: '区分' },
  label: '流入元の内訳',
  tableLabel: '表で見る',
  locale: 'ja-JP',
};

const slices = (c: HTMLElement) => [...c.querySelectorAll('.sc-pie-slice')];

describe('PieChart', () => {
  test('扇は区分の数だけ出て、名前と値と取り分を読み上げる', () => {
    const { container } = render(PieChart, { props: pieBase });
    expect(slices(container)).toHaveLength(3);
    expect(slices(container)[0]!.getAttribute('aria-label')).toBe('検索 50 50%');
  });

  test('並べ替えない(データの順のまま)', () => {
    const { container } = render(PieChart, { props: pieBase });
    const names = slices(container).map((s) => s.getAttribute('aria-label')!.split(' ')[0]);
    expect(names).toEqual(['検索', '直接', 'その他']);
  });

  test('軸の帯を持たない', () => {
    const { container } = render(PieChart, { props: pieBase });
    expect(container.querySelector('.sc-chart-values')).toBeNull();
    expect(container.querySelector('.sc-chart-categories')).toBeNull();
  });

  test('輪にすると穴が空く(扇の形が変わる)', () => {
    const { container: circle } = render(PieChart, { props: pieBase });
    const { container: donut } = render(PieChart, { props: { ...pieBase, hole: 'donut' as const } });
    expect(slices(circle)[0]!.getAttribute('d')).not.toBe(slices(donut)[0]!.getAttribute('d'));
  });

  test('表は常に在り、畳んで置く', () => {
    render(PieChart, { props: pieBase });
    expect(screen.getByText('表で見る').closest('details')?.open).toBe(false);
  });

  test('左右で扇を進む(系列の軸は無い)', async () => {
    const { container } = render(PieChart, { props: pieBase });
    const svg = container.querySelector('svg')!;
    const at = () => container.querySelector('[data-cursor="true"]')!.getAttribute('aria-label');
    expect(at()).toBe('検索 50 50%');
    await fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(at()).toBe('直接 30 30%');
    await fireEvent.keyDown(svg, { key: 'ArrowDown' });
    expect(at()).toBe('直接 30 30%');
  });

  test('押すと指した扇をアプリへ渡す', async () => {
    const onpointactivate = vi.fn();
    const { container } = render(PieChart, { props: { ...pieBase, onpointactivate } });
    await fireEvent.click(slices(container)[1]!);
    expect(onpointactivate).toHaveBeenCalledWith({ name: '直接', value: 30, share: 0.3 });
  });

  test('同じ区分が二度来たら開発時に知らせる', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(PieChart, { props: { ...pieBase, data: [{ 区分: '甲', 件数: 1 }, { 区分: '甲', 件数: 2 }] } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('行が二つ以上あります'));
    warn.mockRestore();
  });
});

const points = [
  { 費用: 10, 売上: 100, 区分: '甲' },
  { 費用: 30, 売上: 240, 区分: '甲' },
  { 費用: 20, 売上: 180, 区分: '乙' },
];
const scatterBase = {
  data: points,
  encoding: { x: '費用', y: '売上', color: '区分' },
  label: '費用と売上',
  tableLabel: '表で見る',
  locale: 'ja-JP',
};

describe('ScatterChart', () => {
  test('点は行の数だけ出る', () => {
    const { container } = render(ScatterChart, { props: scatterBase });
    expect(container.querySelectorAll('.sc-scatter-point')).toHaveLength(3);
  });

  test('点は結ばない', () => {
    const { container } = render(ScatterChart, { props: scatterBase });
    expect(container.querySelector('path')).toBeNull();
  });

  test('x の昇順で辿る', async () => {
    const { container } = render(ScatterChart, { props: scatterBase });
    const svg = container.querySelector('svg')!;
    const at = () => container.querySelector('[data-cursor="true"]')!.getAttribute('aria-label');
    expect(at()).toBe('甲 10 100');
    await fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(at()).toBe('甲 30 240');
  });

  test('大きさを割り当てると読み上げに乗る', () => {
    const { container } = render(ScatterChart, {
      props: { ...scatterBase, encoding: { x: '費用', y: '売上', size: '売上' } },
    });
    expect(container.querySelector('.sc-scatter-point')!.getAttribute('aria-label')).toBe('10 100 100');
  });
});

describe('Sparkline', () => {
  const rows = [{ 日: '1日', 値: 3 }, { 日: '2日', 値: 9 }, { 日: '3日', 値: 5 }];

  test('一枚の絵として届き、要約を読み上げる', () => {
    render(Sparkline, { props: { data: rows, encoding: { x: '日', y: '値' }, label: '直近', locale: 'ja-JP' } });
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toBe('直近: 3、最小 3、最大 9、最後 5');
  });

  test('単位を渡せる(DS は文言を持たない)', () => {
    render(Sparkline, {
      props: { data: rows, encoding: { x: '日', y: '値' }, label: '直近', valueLabel: '件', locale: 'ja-JP' },
    });
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('最大 9 件');
  });

  test('軸も表も凡例も持たない', () => {
    const { container } = render(Sparkline, {
      props: { data: rows, encoding: { x: '日', y: '値' }, label: '直近' },
    });
    expect(container.querySelector('.sc-chart-values')).toBeNull();
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('.sc-chart-legend')).toBeNull();
  });

  test('データが空でも壊れない', () => {
    render(Sparkline, { props: { data: [], encoding: { x: '日', y: '値' }, label: '直近' } });
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('直近');
  });
});
