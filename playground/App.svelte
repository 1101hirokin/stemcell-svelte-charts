<script lang="ts">
  import { BarChart } from '../src/lib/index';
  import {
    daily,
    dailyBySeries,
    duplicated,
    eightSeries,
    holes,
    longNames,
    mixedNormalized,
    quarterly,
    rates,
    signedFlow,
    single,
    wideRange,
  } from './data';

  // 全体に効かせる切り替え。同じデータを別の姿で見て、崩れ方を探すための道具。
  let orientation = $state<'vertical' | 'horizontal'>('vertical');
  let stacking = $state<'group' | 'stacked' | 'normalized'>('group');
  let valueLabels = $state(false);

  let hidden = $state<string[]>([]);
  let picked = $state('');

  // 初回の描き込み。もう一度見るには描き直す(部品は再生の口を持たない。細かい制御は持たない)
  let animate = $state(true);
  let take = $state(0);

  /** 向きに合わせて対応づけを組む(横棒は量が x)。 */
  const encode = (category: string, value: string, color?: string) =>
    orientation === 'vertical' ? { x: category, y: value, color } : { y: category, x: value, color };
</script>

<main>
  <h1>svelte-charts playground</h1>

  <div class="pg-controls">
    <label>
      向き
      <select bind:value={orientation}>
        <option value="vertical">縦棒</option>
        <option value="horizontal">横棒</option>
      </select>
    </label>
    <label>
      積み方
      <select bind:value={stacking}>
        <option value="group">並置</option>
        <option value="stacked">積み上げ</option>
        <option value="normalized">100% 積み上げ</option>
      </select>
    </label>
    <label><input type="checkbox" bind:checked={valueLabels} /> 値の札</label>
    <label><input type="checkbox" bind:checked={animate} /> 描き込みアニメ</label>
    <button type="button" onclick={() => (take += 1)}>描き直す</button>
    <span class="pg-note">選んだ点: {picked || '(まだ無い)'}</span>
  </div>

  <section>
    <h2>描き込みアニメ（`animateOnAppear`。reduced-motion では動かない）</h2>
    <!-- 描き直すと初回の描き込みがもう一度走る。速さと曲線は motion の規範に従い、細かい制御は持たない -->
    {#key take}
      <BarChart
        ratio="16:9"
        data={quarterly}
        encoding={encode('期', '売上', '区分')}
        {orientation}
        {stacking}
        {valueLabels}
        animateOnAppear={animate}
        legend
        label="四半期別の売上（描き込み {take + 1} 回目）"
        tableLabel="表で見る"
        locale="ja-JP"
      />
    {/key}
  </section>

  <section>
    <h2>素直な形（四半期 × 二系列）</h2>
    <BarChart
      ratio="16:9"
      data={quarterly}
      encoding={encode('期', '売上', '区分')}
      {orientation}
      {stacking}
      {valueLabels}
      legend
      {hidden}
      label="四半期別の売上"
      description="2025 年の四半期別。実績と予算を並べている。3 四半期目だけ実績が予算を下回る。"
      tableLabel="表で見る"
      locale="ja-JP"
      onhiddenchange={(next) => (hidden = next)}
      onpointactivate={(point) => (picked = `${point.category} ${point.series ?? ''} ${point.value}`)}
    />
  </section>

  <section>
    <h2>系列が 8 つ（分類の色は 6 段。7 番目から回る）</h2>
    <BarChart
      ratio="16:9"
      data={eightSeries}
      encoding={encode('月', '訪問', '流入元')}
      {orientation}
      {stacking}
      {valueLabels}
      legend
      label="流入元別の訪問"
      tableLabel="表で見る"
      locale="ja-JP"
    />
  </section>

  <section>
    <h2>桁が違いすぎる（12,400,000 と 12 と 0）</h2>
    <BarChart
      ratio="16:9"
      data={wideRange}
      encoding={encode('区分', '金額')}
      {orientation}
      {stacking}
      {valueLabels}
      label="拠点別の金額"
      tableLabel="表で見る"
      locale="ja-JP"
    />
  </section>

  <section>
    <h2>正と負が混ざる（積み上げると基線を挟む）</h2>
    <BarChart
      ratio="16:9"
      data={signedFlow}
      encoding={encode('月', '額', '種別')}
      {orientation}
      {stacking}
      {valueLabels}
      legend
      label="入出金"
      tableLabel="表で見る"
      locale="ja-JP"
    />
  </section>

  <section>
    <h2>100% 積み上げに符号が混ざる（分母は絶対値の和）</h2>
    <BarChart
      ratio="16:9"
      data={mixedNormalized}
      encoding={encode('部門', '額', '科目')}
      {orientation}
      stacking="normalized"
      legend
      label="部門別の損益"
      tableLabel="表で見る"
      locale="ja-JP"
    />
  </section>

  <section>
    <h2>穴が空いている（空の値、読めない値、行そのものが無い、名前が空）</h2>
    <BarChart
      ratio="16:9"
      data={holes}
      encoding={encode('品目', '在庫')}
      {orientation}
      {stacking}
      {valueLabels}
      label="在庫"
      tableLabel="表で見る"
      locale="ja-JP"
      emptyLabel="在庫のデータがありません"
    />
  </section>

  <section>
    <h2>名前が長い（切り詰める。斜めにも横倒しにもしない）</h2>
    <BarChart
      ratio="16:9"
      data={longNames}
      encoding={encode('施策', '効果')}
      {orientation}
      {stacking}
      {valueLabels}
      label="施策別の効果"
      tableLabel="表で見る"
      locale="ja-JP"
    />
  </section>

  <section>
    <h2>90 日ぶん（下限で並べて横へ送る）</h2>
    <BarChart
      ratio="21:9"
      data={daily}
      encoding={encode('日', '件数')}
      {orientation}
      {stacking}
      label="日別の件数"
      tableLabel="表で見る"
      locale="ja-JP"
    />
  </section>

  <section>
    <h2>40 日 × 3 系列（多い × 多い）</h2>
    <BarChart
      ratio="21:9"
      data={dailyBySeries}
      encoding={encode('日', '件数', '区分')}
      {orientation}
      {stacking}
      legend
      label="日別・区分別の件数"
      tableLabel="表で見る"
      locale="ja-JP"
    />
  </section>

  <section>
    <h2>狭い場所に押し込む（18rem）</h2>
    <div class="pg-narrow">
      <BarChart
        ratio="4:3"
        data={daily}
        encoding={encode('日', '件数')}
        {orientation}
        {stacking}
        label="日別の件数（狭い場所）"
        tableLabel="表で見る"
        locale="ja-JP"
      />
    </div>
  </section>

  <section>
    <h2>小数で、ほとんど同じ値（刻みが細かい）</h2>
    <BarChart
      ratio="16:9"
      data={rates}
      encoding={encode('指標', '値')}
      {orientation}
      {stacking}
      {valueLabels}
      label="指標"
      tableLabel="表で見る"
      locale="ja-JP"
    />
  </section>

  <section>
    <h2>一本だけ／同じ棒に二行（後の行を採って警告）</h2>
    <div class="pg-row">
      <div style="flex: 1; min-inline-size: 14rem">
        <BarChart
          ratio="4:3"
          data={single}
          encoding={encode('名', '値')}
          {orientation}
          {stacking}
          {valueLabels}
          label="合計"
          tableLabel="表で見る"
          locale="ja-JP"
        />
      </div>
      <div style="flex: 1; min-inline-size: 14rem">
        <BarChart
          ratio="4:3"
          data={duplicated}
          encoding={encode('区分', '値')}
          {orientation}
          {stacking}
          {valueLabels}
          label="重なった行"
          tableLabel="表で見る"
          locale="ja-JP"
        />
      </div>
    </div>
  </section>

  <section>
    <h2>データが無い</h2>
    <BarChart
      ratio="16:9"
      data={[]}
      encoding={encode('日', '件数')}
      {orientation}
      label="日別の件数"
      emptyLabel="この期間のデータはありません"
      tableLabel="表で見る"
    />
  </section>
</main>
