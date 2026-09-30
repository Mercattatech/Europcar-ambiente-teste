import prisma from '@/lib/prisma';

/**
 * Mapeamento de erros de pagamento/reserva → mensagem amigável, editável pelo
 * admin via CMS (tabela ContentBlock, chave "reservation.error.<code>"). Isso
 * evita mensagens fixas no código: quando a Cielo ou o XRS retornam um código
 * conhecido (ex: ReturnCode 129 "Affiliation not found"), buscamos o texto
 * correspondente no CMS antes de cair no fallback técnico.
 */

/**
 * Mapeamento estático de erros de idade do XRS → mensagens amigáveis em PT-BR.
 * Estes fallbacks garantem que, mesmo sem cadastro no CMS (ContentBlock),
 * o usuário veja uma mensagem compreensível e não o código técnico do XRS.
 */
const XRS_ERROR_FALLBACKS: Record<string, string> = {
  // Erros de idade do condutor
  'rental.drivertooyoungforcategory': 'O condutor não possui a idade mínima exigida para alugar esta categoria de veículo.',
  'rental.drivertooyoungforcountry': 'A idade do condutor é inferior ao limite mínimo permitido no país de retirada.',
  'rental.drivertoooldforcountry': 'A idade do condutor ultrapassa o limite máximo permitido para locação neste país.',
  'xrs.driver.notlegal.age': 'É necessário ter no mínimo 18 anos de idade para realizar a reserva.',
  // Erros de Delivery/Collection (Transfer)
  'delcol.nodeliveryatthisstation': 'Esta estação de aluguel não realiza entregas de veículos no endereço indicado.',
  'delcol.nocollectionatthisstation': 'Esta estação não realiza recolhimento de veículos no endereço indicado.',
  'delcol.delcolfeemayapply': 'Atenção: taxa de entrega/recolhimento pode ser aplicada.',
  // Erros Cielo (pagamento)
  '129': 'Ocorreu um problema ao processar seu pagamento. Entre em contato com o suporte.',
  '605': 'Erro interno na autenticação do cartão. Tente novamente ou use outro cartão.',
  '606': 'Erro interno na autenticação do cartão. Tente novamente ou use outro cartão.',
  '607': 'Erro interno na autenticação do cartão. Tente novamente ou use outro cartão.',
};

export async function getReservationErrorMessage(code: string | number | undefined | null, fallback: string): Promise<string> {
  if (!code && code !== 0) return fallback;
  const codeStr = String(code).toLowerCase();
  try {
    const block = await prisma.contentBlock.findUnique({
      where: { key: `reservation.error.${code}` },
    });
    if (block?.value_ptBR) return block.value_ptBR;
  } catch (err) {
    console.warn('[CMS] Falha ao buscar reservation.error:', (err as Error).message);
  }
  // Fallback estático para erros de idade do XRS
  return XRS_ERROR_FALLBACKS[codeStr] || fallback;
}

