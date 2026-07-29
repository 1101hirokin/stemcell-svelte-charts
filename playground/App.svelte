<script lang="ts">
  import { AreaChart, BarChart, LineChart, PieChart, ScatterChart, Sparkline } from '../src/lib/index';
  import { Box, Button, Checkbox, Cluster, Container, Select, StemcellProvider, Stack, Switcher, Text } from '@stemcell/svelte';
  import {
    broken,
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
    breakdown,
    cloud,
    single,
    timeline,
    trends,
    narrowRange,
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

{#snippet orientationLabel()}向き{/snippet}
{#snippet stackingLabel()}積み方{/snippet}
{#snippet valueLabelsLabel()}値の札{/snippet}
{#snippet animateLabel()}描き込みアニメ{/snippet}

<!-- Provider は面を持たない(テーマと密度を立てるだけ)。中身は包まない -->
<StemcellProvider />

<Container max="lg">
  <Stack gap="lg">
  <Text variant="title-lg" as="h1">svelte-charts playground</Text>

  <div class="pg-controls">
    <Cluster gap="md" align="center">
      <!-- 欄は場所いっぱいに広がるので、切り替えの帯では幅を与える(Box の逃げ道) -->
      <Box style="inline-size: 10rem">
      <Select
        value={orientation}
        options={[
          { value: 'vertical', label: '縦棒' },
          { value: 'horizontal', label: '横棒' },
        ]}
        onchange={(v) => (orientation = v as typeof orientation)}
        size="sm"
        label={orientationLabel}
      />
      </Box>
      <Box style="inline-size: 12rem">
      <Select
        value={stacking}
        options={[
          { value: 'group', label: '並置' },
          { value: 'stacked', label: '積み上げ' },
          { value: 'normalized', label: '100% 積み上げ' },
        ]}
        onchange={(v) => (stacking = v as typeof stacking)}
        size="sm"
        label={stackingLabel}
      />
      </Box>
      <Checkbox checked={valueLabels} onchange={(v) => (valueLabels = v)} label={valueLabelsLabel} />
      <Checkbox checked={animate} onchange={(v) => (animate = v)} label={animateLabel} />
      <Button variant="outlined" size="sm" onclick={() => (take += 1)}>描き直す</Button>
      <Text variant="body-sm" muted>選んだ点: {picked || '(まだ無い)'}</Text>
    </Cluster>
  </div>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>描き込みアニメ（`animateOnAppear`。reduced-motion では動かない）</Text>
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
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>素直な形（四半期 × 二系列）</Text>
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
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>系列が 8 つ（分類の色は 6 段。7 番目から回る）</Text>
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
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>桁が違いすぎる（12,400,000 と 12 と 0）</Text>
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
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>正と負が混ざる（積み上げると基線を挟む）</Text>
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
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>100% 積み上げに符号が混ざる（分母は絶対値の和）</Text>
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
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>穴が空いている（空の値、読めない値、行そのものが無い、名前が空）</Text>
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
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>名前が長い（切り詰める。斜めにも横倒しにもしない）</Text>
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
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>90 日ぶん（下限で並べて横へ送る）</Text>
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
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>40 日 × 3 系列（多い × 多い）</Text>
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
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>狭い場所に押し込む（18rem）</Text>
    <Box style="inline-size: 18rem">
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
    </Box>
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>小数で、ほとんど同じ値（刻みが細かい）</Text>
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
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>一本だけ／同じ棒に二行（後の行を採って警告）</Text>
    <Switcher threshold="20rem" gap="lg">
      <Box>
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
      </Box>
      <Box>
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
      </Box>
    </Switcher>
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>折れ線（時間の軸。欠測は空きになる）</Text>
    {#key take}
      <LineChart
        ratio="16:9"
        animateOnAppear={animate}
        data={timeline}
        encoding={{ x: '日', y: '件数', color: '区分' }}
        scale={{ x: 'time' }}
        legend
        markers
        label="日別の件数"
        description="1月から5月まで。甲は3月、乙は4月が欠測。"
        tableLabel="表で見る"
        locale="ja-JP"
      />
    {/key}
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>折れ線（穴。左は切る、右は点線の橋）</Text>
    <Switcher threshold="20rem" gap="lg">
      <Box>
        <LineChart
          ratio="4:3"
          data={broken}
          encoding={{ x: '日', y: '値' }}
          scale={{ x: 'category' }}
          label="切る（既定）"
          tableLabel="表で見る"
          locale="ja-JP"
        />
      </Box>
      <Box>
        <LineChart
          ratio="4:3"
          data={broken}
          encoding={{ x: '日', y: '値' }}
          scale={{ x: 'category' }}
          gaps="bridge"
          label="点線の橋"
          tableLabel="表で見る"
          locale="ja-JP"
        />
      </Box>
    </Switcher>
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>折れ線（狭い範囲。ゼロ基線を省く）</Text>
    <LineChart
      ratio="16:9"
      data={narrowRange}
      encoding={{ x: '時', y: '値' }}
      scale={{ x: 'category' }}
      markers
      crosshair
      label="時刻ごとの値"
      tableLabel="表で見る"
      locale="ja-JP"
    />
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>面（既定は積む。ゼロ基線は省かない）</Text>
    {#key take}
    <Switcher threshold="20rem" gap="lg">
      <Box>
        <AreaChart
          ratio="4:3"
          animateOnAppear={animate}
          data={timeline}
          encoding={{ x: '日', y: '件数', color: '区分' }}
          scale={{ x: 'time' }}
          legend
          label="積む（既定）"
          tableLabel="表で見る"
          locale="ja-JP"
        />
      </Box>
      <Box>
        <AreaChart
          ratio="4:3"
          animateOnAppear={animate}
          data={timeline}
          encoding={{ x: '日', y: '件数', color: '区分' }}
          scale={{ x: 'time' }}
          stacking="group"
          legend
          label="重ねる（薄く塗る）"
          tableLabel="表で見る"
          locale="ja-JP"
        />
      </Box>
    </Switcher>
    {/key}
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>散布（大きさは面積。潰れたら薄く）</Text>
    {#key take}
      <ScatterChart
        ratio="16:9"
        animateOnAppear={animate}
        data={cloud}
        encoding={{ x: '費用', y: '売上', color: '区分', size: '規模' }}
        pointSize={24}
        legend
        crosshair
        label="費用と売上"
        description="費用が増えるほど売上も増えるが、規模の大きい案件ほど散らばりが大きい。"
        tableLabel="表で見る"
        locale="ja-JP"
      />
    {/key}
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>円と輪（名前は外へ引き、入らない扇には出さない）</Text>
    {#key take}
      <Switcher threshold="20rem" gap="lg">
        <Box>
          <PieChart
            ratio="1:1"
            animateOnAppear={animate}
            data={breakdown}
            encoding={{ theta: '件数', color: '区分' }}
            label="流入元の内訳"
            tableLabel="表で見る"
            locale="ja-JP"
          />
        </Box>
        <Box>
          <PieChart
            ratio="1:1"
            animateOnAppear={animate}
            data={breakdown}
            encoding={{ theta: '件数', color: '区分' }}
            hole="donut"
            legend
            label="同じデータを輪で"
            tableLabel="表で見る"
            locale="ja-JP"
          />
        </Box>
      </Switcher>
    {/key}
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>小さな線（表の行末に置く。軸も表も持たない）</Text>
    <table class="pg-table">
      <thead>
        <tr><th>商品</th><th>直近 12 週</th><th>今週</th></tr>
      </thead>
      <tbody>
        {#each trends as row (row.name)}
          <tr>
            <td>{row.name}</td>
            <td class="pg-spark">
              <Sparkline
                data={row.points}
                encoding={{ x: '週', y: '値' }}
                label={`${row.name} の直近 12 週`}
                valueLabel="件"
                locale="ja-JP"
              />
            </td>
            <td>{row.points.at(-1)?.値}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Stack>

  <Stack gap="sm">
    <Text variant="label-md" as="h2" muted>データが無い</Text>
    <BarChart
      ratio="16:9"
      data={[]}
      encoding={encode('日', '件数')}
      {orientation}
      label="日別の件数"
      emptyLabel="この期間のデータはありません"
      tableLabel="表で見る"
    />
  </Stack>
  </Stack>
</Container>
