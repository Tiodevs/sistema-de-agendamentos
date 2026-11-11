import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { compile } from 'tailwindcss';

// Os testes rodam com a pasta do app (apps/web) como diretório atual.
// A pasta do app sai do caminho deste arquivo, não do diretório atual: o teste roda igual com
// `npm test` na raiz e com `npm run test --workspace=apps/web`.
const ROOT = join(__dirname, '..');
const STYLES = join(ROOT, 'src', 'styles');
const requireFromApp = createRequire(join(ROOT, 'package.json'));

type Rgb = [number, number, number];
type Theme = 'light' | 'dark';

/**
 * Fundos onde o texto colorido aparece: cartão, painel e cartão cinza. São os `--admin-card`,
 * `--admin-panel` e `--admin-card-muted` de styles/admin.css (lá em oklch), convertidos para sRGB.
 */
const SURFACES: Record<Theme, Record<string, Rgb>> = {
  light: { cartão: [255, 255, 255], painel: [243, 243, 247], 'cartão cinza': [235, 235, 240] },
  dark: { cartão: [26, 26, 29], painel: [18, 18, 21], 'cartão cinza': [34, 34, 38] },
};

const MIN_CONTRAST = 4.5;

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16)) as Rgb;
}

function luminance(rgb: Rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste da WCAG 2.x. */
function contrast(a: Rgb, b: Rgb) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function over(color: Rgb, background: Rgb, alpha: number): Rgb {
  return color.map((channel, index) =>
    Math.round(channel * alpha + background[index] * (1 - alpha)),
  ) as Rgb;
}

/** Lê tokens.css na ordem da cascata: `:root` vale nos dois temas, `.dark` só no escuro. */
function readTokens(): Record<Theme, Map<string, string>> {
  const css = readFileSync(join(STYLES, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens: Record<Theme, Map<string, string>> = { light: new Map(), dark: new Map() };

  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = selector.split(',').map((item) => item.trim());
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      if (selectors.includes(':root')) {
        tokens.light.set(name, value.trim());
        tokens.dark.set(name, value.trim());
      }
      if (selectors.includes('.dark')) tokens.dark.set(name, value.trim());
    }
  }
  return tokens;
}

function resolveToken(tokens: Map<string, string>, name: string): { rgb: Rgb; alpha: number } {
  const value = tokens.get(name);
  assert.ok(value, `token ${name} não existe em tokens.css`);

  const mix = /^color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, transparent\)$/.exec(value);
  if (mix) return { rgb: resolveToken(tokens, mix[1]).rgb, alpha: Number(mix[2]) / 100 };

  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  if (reference) return resolveToken(tokens, reference[1]);

  assert.match(value, /^#[0-9a-f]{6}$/i, `${name}: valor fora do formato esperado (${value})`);
  return { rgb: hexToRgb(value), alpha: 1 };
}

const STATUS_TOKENS = [
  '--status-scheduled',
  '--status-confirmed',
  '--status-in-progress',
  '--status-completed',
  '--status-cancelled',
  '--status-no-show',
];
const TONE_TOKENS = ['--tone-info', '--tone-success', '--tone-warning', '--tone-danger'];
const TEXT_ONLY_TOKENS = [
  '--tone-neutral',
  '--brand-accent-text',
  '--chip-cyan',
  '--chip-violet',
  '--chip-sky',
  '--chip-orange',
  '--chip-emerald',
];

describe('cores de status e de tom legíveis nos dois temas (UX-11)', () => {
  const tokens = readTokens();

  for (const theme of ['light', 'dark'] as const) {
    const label = theme === 'light' ? 'tema claro' : 'tema escuro';

    it(`${label}: texto a pelo menos ${MIN_CONTRAST}:1 sobre cartão, painel e cartão cinza`, () => {
      for (const name of [...STATUS_TOKENS, ...TONE_TOKENS, ...TEXT_ONLY_TOKENS]) {
        const { rgb } = resolveToken(tokens[theme], name);
        for (const [surface, background] of Object.entries(SURFACES[theme])) {
          const ratio = contrast(rgb, background);
          assert.ok(
            ratio >= MIN_CONTRAST,
            `${name} sobre ${surface}: ${ratio.toFixed(2)}:1 (${label})`,
          );
        }
      }
    });

    it(`${label}: texto a pelo menos ${MIN_CONTRAST}:1 sobre o próprio fundo suave`, () => {
      for (const name of [...STATUS_TOKENS, ...TONE_TOKENS]) {
        const { rgb } = resolveToken(tokens[theme], name);
        const soft = resolveToken(tokens[theme], `${name}-bg`);
        for (const [surface, background] of Object.entries(SURFACES[theme])) {
          const ratio = contrast(rgb, over(soft.rgb, background, soft.alpha));
          assert.ok(
            ratio >= MIN_CONTRAST,
            `${name} sobre ${name}-bg no ${surface}: ${ratio.toFixed(2)}:1 (${label})`,
          );
        }
      }
    });
  }

  it('cada status tem texto, fundo suave e borda', () => {
    for (const name of STATUS_TOKENS) {
      for (const theme of ['light', 'dark'] as const) {
        resolveToken(tokens[theme], name);
        resolveToken(tokens[theme], `${name}-bg`);
        resolveToken(tokens[theme], `${name}-border`);
      }
    }
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Classes de token usadas no código: `text-status-*`, `bg-tone-*`, `text-chip-*`, `bg-brand`… */
function tokenClassesInSource() {
  const pattern =
    /(?<![\w-])((?:[a-z-]+:)*(?:text|bg|border)-(?:status|tone|chip|brand)(?:-[a-z]+)*(?:\/\d+)?)(?![\w-])/g;
  const found = new Set<string>();
  for (const file of sourceFiles(join(ROOT, 'src'))) {
    for (const [, candidate] of readFileSync(file, 'utf8').matchAll(pattern)) found.add(candidate);
  }
  return [...found].sort();
}

/** A classe como seletor no CSS gerado, sem casar com o começo de outra classe mais longa. */
function hasClassRule(css: string, candidate: string) {
  const selector = `.${candidate.replace(/[:/]/g, (char) => `\\${char}`)}`;
  let from = 0;
  for (;;) {
    const index = css.indexOf(selector, from);
    if (index === -1) return false;
    const next = css[index + selector.length] ?? '';
    if (!/[\w\\-]/.test(next)) return true;
    from = index + 1;
  }
}

describe('tokens de cor chegam ao Tailwind (UX-11, ARQ-10)', () => {
  it('toda classe de token usada no código existe no CSS gerado', async () => {
    const candidates = tokenClassesInSource();
    assert.ok(candidates.length > 0, 'nenhuma classe de token encontrada em src/');

    const entry = join(STYLES, 'globals.css');
    const compiler = await compile(readFileSync(entry, 'utf8'), {
      base: STYLES,
      loadStylesheet: async (id: string, base: string) => {
        // Só as animações; não tem a ver com as cores e o pacote não expõe o CSS para `require`.
        if (id === 'tw-animate-css') return { path: id, base, content: '' };
        const path =
          id === 'tailwindcss'
            ? requireFromApp.resolve('tailwindcss/index.css')
            : resolve(base, id);
        return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
      },
    });
    const css = compiler.build(candidates);

    // O Tailwind não reclama de classe desconhecida: ela só não gera CSS. Sem este teste, um
    // token renomeado ou digitado errado viraria texto sem cor na tela.
    const missing = candidates.filter((candidate) => !hasClassRule(css, candidate));
    assert.deepEqual(missing, [], `classes sem CSS: ${missing.join(', ')}`);

    // O próprio teste: classe de token que não existe não pode passar.
    const bogus = 'text-status-inexistente';
    assert.equal(hasClassRule(compiler.build([bogus]), bogus), false);
  });
});
