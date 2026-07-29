/**
 * 契約(../stemcell-component-prompts/contracts)から適合テストを生成する。
 *
 * GOVERNANCE §6-2 の「契約の props 名 / enum 値 / 既定値 / 必須トークン参照が実装と一致するか」を、
 * 実装側の meta.ts(既定値の単一の源)と CSS に対して照合する。svelte リポの同名の道具と同じ形で、
 * 図の束のために二つだけ変えてある。
 *
 *   1. CSS は部品ごとに一枚ではない。外枠は internal/frame.css が持ち、図ごとの CSS はその上に
 *      薄く乗る。だから import を辿って「その部品が実際に読む CSS」を集める(conformance/css.ts)。
 *      internal を丸ごと見る形にしたら、小さな線が円の CSS の字の役を要求されて赤くなった。
 *   2. 基底の契約(Chart)は実装を持たない。実装(meta.ts)のある契約だけを見て、残りは未実装として
 *      一覧に出す。
 *
 * extends は仕様側スキーマの意味論どおり props / states / tokensRequired を1段だけ解決する。
 */
import { readdirSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SPEC = join(import.meta.dirname, '../../stemcell-component-prompts/contracts');
const OUT = join(import.meta.dirname, 'generated');
const LIB = join(import.meta.dirname, '../src/lib');

type Prop = { type: string; values?: string[]; default?: unknown; optional?: boolean };
type Contract = {
  component: string;
  extends?: string;
  props?: Record<string, Prop>;
  states?: string[];
  tokensRequired?: string[];
  a11y?: { focusRing?: boolean };
};

/** focusRing: true は焦点の環の幾何を含意する(focus-ring.md §4。契約は列挙しない)。 */
const FOCUS_RING_GEOMETRY = ['focus-ring.width', 'focus-ring.style', 'focus-ring.offset'];

const load = (name: string): Contract => JSON.parse(readFileSync(join(SPEC, name, 'contract.json'), 'utf-8'));

const resolve = (c: Contract): Contract => {
  if (!c.extends) return c;
  const parent = load(c.extends);
  return {
    ...c,
    props: { ...(parent.props ?? {}), ...(c.props ?? {}) },
    states: c.states ?? parent.states,
    tokensRequired: [...new Set([...(parent.tokensRequired ?? []), ...(c.tokensRequired ?? [])])],
    a11y: c.a11y ?? parent.a11y,
  };
};

/** color.dataviz.categorical.1 -> --color-dataviz-categorical-1 等、prop 値で展開した変数名。 */
const cssVars = (c: Contract): string[] => {
  const out: string[] = [];
  const required = [...(c.tokensRequired ?? []), ...(c.a11y?.focusRing ? FOCUS_RING_GEOMETRY : [])];
  for (const token of required) {
    let names = [token];
    for (const match of token.matchAll(/\{([^}]+)\}/g)) {
      const values = c.props?.[match[1]!]?.values ?? [];
      names = names.flatMap((n) => values.map((v) => n.replace(`{${match[1]}}`, v)));
    }
    out.push(...names.map((n) => `--${n.replaceAll('.', '-')}`));
  }
  return [...new Set(out)];
};

mkdirSync(OUT, { recursive: true });
const dirs = readdirSync(SPEC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const implemented: string[] = [];
const missing: string[] = [];

for (const name of dirs) {
  if (!existsSync(join(LIB, name, 'meta.ts'))) {
    // 図の束が実装するのは図の契約だけである。核の 72 部品は別のリポが実装する
    if (existsSync(join(SPEC, name, 'contract.json')) && load(name).extends === 'Chart') missing.push(name);
    continue;
  }
  implemented.push(name);
  const c = resolve(load(name));
  const spec = {
    props: Object.fromEntries(
      Object.entries(c.props ?? {}).map(([k, p]) => [
        k,
        { type: p.type, values: p.values ?? null, default: p.default ?? null, optional: p.optional ?? false },
      ]),
    ),
    states: c.states ?? [],
    cssVars: cssVars(c),
    typography: cssVars(c)
      .filter((v) => v.startsWith('--typography-'))
      .map((v) => v.slice('--typography-'.length)),
  };
  writeFileSync(
    join(OUT, `${name}.test.ts`),
    `// 自動生成。編集しない(源は契約)。
import { describe, it, expect } from 'vitest';
import { META } from '../../src/lib/${name}/meta';
import { cssFor } from '../css';
import { join } from 'node:path';

const SPEC = ${JSON.stringify(spec, null, 2)} as const;

/** その部品が実際に読み込む CSS(import を辿る)。 */
const css = () => cssFor(join(__dirname, '../../src/lib'), '${name}');

describe('${name} conformance', () => {
  it('props: 名前の集合が契約と過不足なく一致する', () => {
    expect(Object.keys(META.props).sort()).toEqual(Object.keys(SPEC.props).sort());
  });
  for (const [name, p] of Object.entries<{ values: readonly string[] | null; default: unknown }>(SPEC.props)) {
    it(\`props.\${name}: enum 値と既定値が契約と一致する\`, () => {
      const m = (META.props as Record<string, any>)[name];
      if (p.values) expect([...m.values].sort()).toEqual([...p.values].sort());
      if (p.default !== null) expect(m.default).toEqual(p.default);
    });
  }
  it('tokensRequired: 必須トークンの CSS 変数が実装 CSS に現れる', () => {
    const text = css();
    for (const v of SPEC.cssVars) expect(text, \`missing \${v}\`).toContain(\`var(\${v}\`);
  });
  it('typography: 実装が引く字の役をすべて契約が宣言している', () => {
    const used = new Set(
      [...css().matchAll(/--typography-([a-z0-9-]+?)-(?:font-family|font-size|font-weight|line-height|letter-spacing)/g)]
        .map((m) => m[1]!),
    );
    for (const role of used) expect(SPEC.typography, \`undeclared typography.\${role}\`).toContain(role);
  });
});
`,
  );
}

writeFileSync(
  join(OUT, '_coverage.txt'),
  `implemented: ${implemented.join(', ') || '(none)'}\nnot yet: ${missing.join(', ') || '(none)'}\n`,
);
console.log(`generated ${implemented.length} conformance tests; not yet implemented: ${missing.length}`);
