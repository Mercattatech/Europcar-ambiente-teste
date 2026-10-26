/**
 * Aplicação de qualificação do lead de franquia (popup da landing /seja-um-franqueado).
 * Compartilhado entre o front (renderização) e a API (validação + pontuação),
 * para que o score não dependa do que o navegador envia.
 */

export interface AppOption {
  label: string;
  points: number;
}

export interface AppQuestion {
  id: string;
  title: string;
  hint?: string;
  /** "text" = resposta livre; demais = múltipla escolha */
  type: 'choice' | 'text';
  options?: AppOption[];
  placeholder?: string;
}

export const APPLICATION_QUESTIONS: AppQuestion[] = [
  {
    id: 'perfil',
    title: 'Qual opção melhor descreve seu perfil hoje?',
    type: 'choice',
    options: [
      { label: 'Já opero uma locadora de veículos', points: 4 },
      { label: 'Sou empresário(a) de outro segmento', points: 3 },
      { label: 'Sou executivo(a) e quero empreender', points: 2 },
      { label: 'Sou investidor(a)', points: 2 },
    ],
  },
  {
    id: 'experiencia',
    title: 'Qual sua experiência com locação, frota, turismo ou mobilidade?',
    type: 'choice',
    options: [
      { label: 'Mais de 5 anos', points: 4 },
      { label: 'De 1 a 5 anos', points: 3 },
      { label: 'Menos de 1 ano', points: 1 },
      { label: 'Nenhuma experiência no setor', points: 0 },
    ],
  },
  {
    id: 'capital',
    title: 'Quanto você tem disponível para investir, incluindo a frota?',
    hint: 'A frota é o principal investimento da operação.',
    type: 'choice',
    options: [
      { label: 'Até R$ 1 milhão', points: 1 },
      { label: 'R$ 1 mi a R$ 2,5 mi', points: 2 },
      { label: 'R$ 2,5 mi a R$ 5 mi', points: 4 },
      { label: 'Acima de R$ 5 mi', points: 5 },
    ],
  },
  {
    id: 'origem_capital',
    title: 'Como pretende compor esse investimento?',
    type: 'choice',
    options: [
      { label: 'Capital próprio', points: 4 },
      { label: 'Capital próprio + financiamento da frota', points: 4 },
      { label: 'Com sócios ou investidores', points: 3 },
      { label: 'Dependo de financiamento total', points: 0 },
    ],
  },
  {
    id: 'cidade',
    title: 'Em qual cidade e estado você pretende operar?',
    type: 'text',
    placeholder: 'Ex.: Campinas / SP',
  },
  {
    id: 'ponto',
    title: 'Você já tem um ponto comercial na região?',
    type: 'choice',
    options: [
      { label: 'Sim, próximo a aeroporto ou rodoviária', points: 3 },
      { label: 'Sim, em área comercial ou central', points: 2 },
      { label: 'Ainda não, mas já estou pesquisando', points: 1 },
      { label: 'Ainda não', points: 0 },
    ],
  },
  {
    id: 'dedicacao',
    title: 'Como será sua dedicação ao negócio?',
    type: 'choice',
    options: [
      { label: 'Vou operar pessoalmente, em tempo integral', points: 4 },
      { label: 'Vou contratar um gestor e acompanhar de perto', points: 3 },
      { label: 'Apenas como investidor(a)', points: 1 },
    ],
  },
  {
    id: 'prazo',
    title: 'Em quanto tempo pretende iniciar a operação?',
    type: 'choice',
    options: [
      { label: 'Em até 3 meses', points: 5 },
      { label: 'De 3 a 6 meses', points: 4 },
      { label: 'De 6 a 12 meses', points: 2 },
      { label: 'Mais de 12 meses', points: 1 },
      { label: 'Só estou pesquisando', points: 0 },
    ],
  },
];

export const MAX_APPLICATION_SCORE = APPLICATION_QUESTIONS.reduce(
  (sum, q) => sum + (q.options ? Math.max(...q.options.map((o) => o.points)) : 0),
  0,
);

export interface ScoredApplication {
  answers: { id: string; pergunta: string; resposta: string; pontos: number }[];
  score: number;
  max: number;
  /** A = quente, B = morno, C = frio */
  grade: 'A' | 'B' | 'C';
  missing: string[];
}

/** Valida as respostas contra a lista oficial e calcula a pontuação. */
export function scoreApplication(raw: Record<string, unknown>): ScoredApplication {
  const answers: ScoredApplication['answers'] = [];
  const missing: string[] = [];
  let score = 0;

  for (const q of APPLICATION_QUESTIONS) {
    const value = typeof raw?.[q.id] === 'string' ? (raw[q.id] as string).trim().slice(0, 160) : '';
    if (q.type === 'text') {
      if (!value) missing.push(q.id);
      answers.push({ id: q.id, pergunta: q.title, resposta: value, pontos: 0 });
      continue;
    }
    const opt = q.options?.find((o) => o.label === value);
    if (!opt) {
      missing.push(q.id);
      answers.push({ id: q.id, pergunta: q.title, resposta: '', pontos: 0 });
      continue;
    }
    score += opt.points;
    answers.push({ id: q.id, pergunta: q.title, resposta: opt.label, pontos: opt.points });
  }

  const ratio = MAX_APPLICATION_SCORE ? score / MAX_APPLICATION_SCORE : 0;
  const grade = ratio >= 0.7 ? 'A' : ratio >= 0.45 ? 'B' : 'C';
  return { answers, score, max: MAX_APPLICATION_SCORE, grade, missing };
}
