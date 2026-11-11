// Estado do assistente de agendamento na URL (UX-07, UX-08). Sem imports com "@/": os testes de
// apps/web/test rodam com node:test via tsx, fora do Next.
//
//   /book?productId=…&employeeId=…&date=2026-11-12&step=3
//
// Recarregar a página, usar o "voltar" do navegador ou chegar por um link (card da landing,
// "Agendar de novo") mantém as escolhas.
import { offersProduct } from './booking-wizard';

export type WizardStep = 1 | 2 | 3;

export interface WizardParams {
  step?: WizardStep;
  productId?: string;
  employeeId?: string;
  date?: string;
  /** Só no assistente do admin. */
  clientId?: string;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

type ParamSource = { get(name: string): string | null };

function idParam(source: ParamSource, name: string) {
  const value = source.get(name)?.trim();
  return value && ID.test(value) ? value : undefined;
}

/** Lê os parâmetros da URL. Valor fora do formato é ignorado, nunca repassado adiante. */
export function readWizardParams(source: ParamSource): WizardParams {
  const rawStep = Number(source.get('step'));
  const date = source.get('date') ?? '';
  return {
    step: rawStep === 1 || rawStep === 2 || rawStep === 3 ? rawStep : undefined,
    productId: idParam(source, 'productId'),
    employeeId: idParam(source, 'employeeId'),
    date: DATE_KEY.test(date) ? date : undefined,
    clientId: idParam(source, 'clientId'),
  };
}

/** Monta a query string, sempre na mesma ordem e sem parâmetro vazio. */
export function wizardQuery(params: WizardParams): string {
  const query = new URLSearchParams();
  if (params.step) query.set('step', String(params.step));
  if (params.productId) query.set('productId', params.productId);
  if (params.employeeId) query.set('employeeId', params.employeeId);
  if (params.date) query.set('date', params.date);
  if (params.clientId) query.set('clientId', params.clientId);
  return query.toString();
}

type ProductLike = { id: string };
type EmployeeLike = { id: string; products: ReadonlyArray<{ product: { id: string } }> };

export interface WizardSelection<P extends ProductLike, E extends EmployeeLike> {
  product: P | null;
  employee: E | null;
  /** Passo que a tela mostra. */
  step: WizardStep;
  /** Até onde dá para ir com o que já foi escolhido (os passos até aqui são clicáveis). */
  maxStep: WizardStep;
}

/**
 * Resolve as escolhas da URL contra o catálogo carregado. Serviço que não existe mais ou
 * profissional que não faz o serviço são descartados. Sem `step` na URL, a tela abre no primeiro
 * passo que ainda falta: `/book?productId=…` vai direto ao profissional (UX-08).
 */
export function resolveWizardSelection<P extends ProductLike, E extends EmployeeLike>(
  params: WizardParams,
  products: readonly P[],
  employees: readonly E[],
): WizardSelection<P, E> {
  const product = products.find((item) => item.id === params.productId) ?? null;
  const candidate = employees.find((item) => item.id === params.employeeId) ?? null;
  const employee = product && candidate && offersProduct(candidate, product.id) ? candidate : null;

  const maxStep: WizardStep = product ? (employee ? 3 : 2) : 1;
  const wanted = params.step ?? maxStep;
  const step = Math.min(wanted, maxStep) as WizardStep;
  return { product, employee, step, maxStep };
}

/**
 * A data da URL só vale se estiver entre hoje e o último dia reservável. Fora disso (link antigo,
 * dia que já passou), a tela escolhe o próximo dia aberto.
 */
export function usableWizardDate(
  date: string | undefined,
  todayKey: string,
  maxDateKey?: string,
): string | null {
  if (!date) return null;
  if (date < todayKey) return null;
  if (maxDateKey && date > maxDateKey) return null;
  return date;
}
