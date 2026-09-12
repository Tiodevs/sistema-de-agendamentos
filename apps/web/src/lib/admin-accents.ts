import {
  Brush,
  Droplets,
  Eye,
  Hand,
  HandHeart,
  Palette,
  ScanFace,
  Scissors,
  Sparkles,
  Wind,
  type LucideIcon,
} from 'lucide-react';

export const ADMIN_ACCENTS = [
  { bg: 'bg-[#00DDB2]/15', fg: 'text-[#00DDB2]', solid: 'bg-[#00DDB2]' },
  { bg: 'bg-violet-500/15', fg: 'text-violet-400', solid: 'bg-violet-500' },
  { bg: 'bg-sky-500/15', fg: 'text-sky-400', solid: 'bg-sky-500' },
  { bg: 'bg-orange-400/15', fg: 'text-orange-400', solid: 'bg-orange-400' },
  { bg: 'bg-emerald-400/15', fg: 'text-emerald-400', solid: 'bg-emerald-400' },
] as const;

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash + value.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return hash;
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function accentForId(id: string) {
  return ADMIN_ACCENTS[hashString(id) % ADMIN_ACCENTS.length];
}

export function iconForProduct(name: string): LucideIcon {
  const n = normalizeName(name);

  if (n.includes('sobrancel')) return Eye;
  if (
    n.includes('corte') ||
    n.includes('cabelo') ||
    n.includes('escova') ||
    n.includes('penteado')
  ) {
    return Scissors;
  }
  if (n.includes('barba') || n.includes('bigode')) return ScanFace;
  if (n.includes('hidrat') || n.includes('nutric') || n.includes('tratamento')) return Droplets;
  if (n.includes('relax') || n.includes('progressiv') || n.includes('alis')) return Wind;
  if (n.includes('color') || n.includes('tinta') || n.includes('luzes') || n.includes('mecha')) {
    return Palette;
  }
  if (n.includes('manicur') || n.includes('pedicur') || n.includes('unha')) return Hand;
  if (n.includes('massag') || n.includes('spa')) return HandHeart;
  if (n.includes('depil') || n.includes('limpeza')) return Sparkles;
  if (n.includes('maquiagem') || n.includes('make')) return Brush;

  return Scissors;
}

export function accentForProduct(name: string) {
  const n = normalizeName(name);

  if (n.includes('sobrancel')) return ADMIN_ACCENTS[1];
  if (n.includes('barba') || n.includes('bigode')) return ADMIN_ACCENTS[3];
  if (n.includes('hidrat') || n.includes('nutric') || n.includes('tratamento'))
    return ADMIN_ACCENTS[0];
  if (n.includes('relax') || n.includes('progressiv') || n.includes('alis'))
    return ADMIN_ACCENTS[4];
  if (n.includes('color') || n.includes('tinta') || n.includes('luzes') || n.includes('mecha')) {
    return ADMIN_ACCENTS[2];
  }
  if (n.includes('manicur') || n.includes('pedicur') || n.includes('unha')) return ADMIN_ACCENTS[1];
  if (n.includes('massag') || n.includes('spa')) return ADMIN_ACCENTS[4];
  if (n.includes('depil') || n.includes('limpeza')) return ADMIN_ACCENTS[0];

  return ADMIN_ACCENTS[0];
}
