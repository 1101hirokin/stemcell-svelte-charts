<script lang="ts">
  import { BarChart } from '../src/lib/index';

  const monthly = [
    { 月: '1月', 売上: 1200, 区分: '実績' },
    { 月: '1月', 売上: 1000, 区分: '予算' },
    { 月: '2月', 売上: 1500, 区分: '実績' },
    { 月: '2月', 売上: 1400, 区分: '予算' },
    { 月: '3月', 売上: 900, 区分: '実績' },
    { 月: '3月', 売上: 1300, 区分: '予算' },
    { 月: '4月', 売上: 1750, 区分: '実績' },
    { 月: '4月', 売上: 1500, 区分: '予算' },
  ];

  const change = [
    { 部門: '営業', 増減: 320 },
    { 部門: '開発', 増減: -140 },
    { 部門: '管理', 増減: 60 },
    { 部門: '支援', 増減: -220 },
  ];

  const long = [
    { 名前: 'とても長い商品名のサンプル A', 数: 420 },
    { 名前: 'とても長い商品名のサンプル B', 数: 380 },
    { 名前: '短い名前', 数: 210 },
  ];

  const tiny = [
    { 種別: '大', 件数: 5000 },
    { 種別: '小', 件数: 3 },
    { 種別: '零', 件数: 0 },
  ];

  const many = Array.from({ length: 36 }, (_, i) => ({ 日: `${i + 1}日`, 件数: 20 + ((i * 37) % 80) }));

  let hidden = $state<string[]>([]);
  let picked = $state('');
</script>

<main>
  <h1>svelte-charts playground</h1>

  <section>
    <h2>並置(既定)</h2>
    <div>
      <BarChart
        ratio="16:9"
        data={monthly}
        encoding={{ x: '月', y: '売上', color: '区分' }}
        label="月別の売上"
        description="1月から4月まで、実績と予算を並べている。3月だけ実績が予算を下回る。"
        tableLabel="表で見る"
        locale="ja-JP"
        legend
        {hidden}
        onhiddenchange={(next) => (hidden = next)}
        onpointactivate={(point) => (picked = `${point.category} ${point.series ?? ''} ${point.value}`)}
      />
    </div>
    <p>選んだ点: {picked || '(まだ無い)'}</p>
  </section>

  <section>
    <h2>積み上げ / 100% 積み上げ</h2>
    <div class="pg-row">
      <div style="flex: 1; min-inline-size: 16rem">
        <BarChart
          ratio="16:9"
          data={monthly}
          encoding={{ x: '月', y: '売上', color: '区分' }}
          stacking="stacked"
          legend
          label="積み上げ"
          tableLabel="表で見る"
          locale="ja-JP"
        />
      </div>
      <div style="flex: 1; min-inline-size: 16rem">
        <BarChart
          ratio="16:9"
          data={monthly}
          encoding={{ x: '月', y: '売上', color: '区分' }}
          stacking="normalized"
          legend
          label="100% 積み上げ"
          tableLabel="表で見る"
          locale="ja-JP"
        />
      </div>
    </div>
  </section>

  <section>
    <h2>負の値(基線が中に来る)</h2>
    <div>
      <BarChart
        ratio="16:9"
        data={change}
        encoding={{ x: '部門', y: '増減' }}
        label="前年比の増減"
        tableLabel="表で見る"
        locale="ja-JP"
        valueLabels
      />
    </div>
  </section>

  <section>
    <h2>横棒(長い名前は切り詰める)</h2>
    <div>
      <BarChart
        ratio="16:9"
        data={long}
        encoding={{ y: '名前', x: '数' }}
        orientation="horizontal"
        label="商品別の数量"
        tableLabel="表で見る"
        locale="ja-JP"
      />
    </div>
  </section>

  <section>
    <h2>極小の値と 0</h2>
    <div>
      <BarChart ratio="16:9" data={tiny} encoding={{ x: '種別', y: '件数' }} label="件数" tableLabel="表で見る" locale="ja-JP" />
    </div>
  </section>

  <section>
    <h2>狭いところに多い(下限で並べて横へ送る)</h2>
    <div class="pg-narrow">
      <BarChart ratio="4:3" data={many} encoding={{ x: '日', y: '件数' }} label="日別の件数" tableLabel="表で見る" locale="ja-JP" />
    </div>
  </section>

  <section>
    <h2>データが無い</h2>
    <div>
      <BarChart
        ratio="16:9"
        data={[]}
        encoding={{ x: '日', y: '件数' }}
        label="日別の件数"
        emptyLabel="この期間のデータはありません"
        tableLabel="表で見る"
      />
    </div>
  </section>
</main>
