/**
 * Catálogo de proteções e extras que podem aparecer nas buscas do site.
 *
 * Os códigos vêm da XRS (insuranceList / equipmentList). O painel /painel/extras usa este
 * catálogo para listar cada item e permitir ativar/desativar individualmente.
 * Itens que a XRS devolver e que NÃO estiverem aqui continuam aparecendo normalmente
 * (padrão = ativo), então nada "some" por falta de cadastro neste arquivo.
 */

/** Chave especial: upsell "Proteção Premium — Franquia Zero" (tarifa ETO) */
export const ZERO_EXCESS_KEY = 'ZERO_EXCESS';

export interface CatalogProtection {
  /** Código XRS da proteção (ou ZERO_EXCESS) */
  code: string;
  name: string;
  description: string;
}

export interface CatalogExtra {
  /** Nome exibido no painel */
  name: string;
  description: string;
  /** Códigos XRS equivalentes (ex.: GPS pode vir como NVS ou NAV) — ligados/desligados juntos */
  codes: string[];
}

export const PROTECTION_CATALOG: CatalogProtection[] = [
  { code: ZERO_EXCESS_KEY, name: 'Proteção Premium — Franquia Zero', description: 'Upgrade de franquia zero oferecido na tarifa "Pagar Agora" (ETO).' },
  { code: 'LDW', name: 'Proteção Básica (LDW)', description: 'Danos e roubo com franquia padrão.' },
  { code: 'CDW', name: 'Proteção contra Danos por Colisão (CDW)', description: 'Proteção contra danos por colisão com franquia.' },
  { code: 'THW', name: 'Proteção contra Roubo (THW)', description: 'Roubo do veículo com franquia reduzida.' },
  { code: 'STHW', name: 'Super Proteção contra Roubo (STHW)', description: 'Roubo com franquia ainda menor.' },
  { code: 'SPTHW', name: 'Proteção Total contra Roubo (SPTHW)', description: 'Roubo com franquia zero.' },
  { code: 'SCDW', name: 'Super Proteção contra Danos (SCDW)', description: 'Redução adicional da franquia por danos.' },
  { code: 'SPCDW', name: 'Proteção Total contra Danos e Acidentes (SPCDW)', description: 'Danos e acidentes com franquia zero.' },
  { code: 'TPL', name: 'Responsabilidade Civil (TPL)', description: 'Responsabilidade civil perante terceiros.' },
  { code: 'WWI', name: 'Para-brisas, vidros, faróis e pneus (WWI)', description: 'Zera a responsabilidade por vidros, faróis e pneus.' },
  { code: 'WIN', name: 'Proteção de vidros (WIN)', description: 'Cobertura de vidros.' },
  { code: 'RSA', name: 'Assistência na estrada 24h (RSA)', description: 'Assistência em qualquer dia e horário.' },
  { code: 'RSE', name: 'Assistência na estrada estendida (RSE)', description: 'Assistência na estrada (versão estendida).' },
  { code: 'LRSA', name: 'Assistência na estrada (LRSA)', description: 'Assistência na estrada (versão local).' },
  { code: 'PAI', name: 'Acidentes pessoais (PAI)', description: 'Indenização a motorista e passageiros.' },
  { code: 'SPAI', name: 'Super acidentes pessoais (SPAI)', description: 'Acidentes pessoais com cobertura ampliada.' },
  { code: 'SPPAI', name: 'Acidentes pessoais ampliado (SPPAI)', description: 'Acidentes pessoais, pacote ampliado.' },
  { code: 'MEDIUM', name: 'Proteção Média (MEDIUM)', description: 'Pacote com franquia reduzida contra danos e roubo.' },
  { code: 'PREMIUM', name: 'Proteção Premium (PREMIUM)', description: 'Pacote com proteção completa contra danos e roubo.' },
  { code: 'PREMPRE', name: 'Proteção Plus (PREMPRE)', description: 'Pacote completo com franquia zero.' },
  { code: 'PREMPLUS', name: 'Proteção Premium Plus (PREMPLUS)', description: 'Pacote premium estendido com cobertura máxima.' },
  { code: 'PREMUP', name: 'Proteção Premium Up (PREMUP)', description: 'Pacote premium.' },
  { code: 'PROPLUS', name: 'Proteção Pro Plus (PROPLUS)', description: 'Pacote de proteção ampliado.' },
  { code: 'INTERIOR', name: 'Danos ao interior (INTERIOR)', description: 'Cobertura de danos ao interior do veículo.' },
  { code: 'INTCLEAN', name: 'Limpeza interna (INTCLEAN)', description: 'Cobertura/serviço de limpeza interna.' },
  { code: 'APP', name: 'Proteção de Aparência (APP)', description: 'Danos estéticos ao veículo.' },
  { code: 'AWC', name: 'Estradas não pavimentadas (AWC)', description: 'Condução em estradas de terra.' },
  { code: 'PEP', name: 'Efeitos Pessoais (PEP)', description: 'Bagagens e pertences pessoais.' },
  { code: 'FAW', name: 'Proteção FAW', description: 'Proteção complementar (código FAW).' },
  { code: 'FCO', name: 'Proteção FCO', description: 'Proteção complementar (código FCO).' },
  { code: 'GOZEN', name: 'Proteção GOZEN', description: 'Proteção complementar (código GOZEN).' },
  { code: 'RIM', name: 'Proteção de rodas (RIM)', description: 'Proteção de rodas/aros.' },
  { code: 'HSS', name: 'Proteção HSS', description: 'Proteção incluída (código HSS).' },
  { code: 'LAF', name: 'Taxas e Impostos (LAF)', description: 'Taxa de licenciamento/estrada incluída.' },
];

export const EXTRA_CATALOG: CatalogExtra[] = [
  { name: 'Assento de bebê (1–3 anos)', description: 'Cadeira infantil grupo 1.', codes: ['CSB'] },
  { name: 'Bebê conforto (0–12 meses)', description: 'Cadeira voltada para trás.', codes: ['CSI'] },
  { name: 'Assento criança (4–7 anos)', description: 'Cadeira grupo 2.', codes: ['CST'] },
  { name: 'Assento de elevação Booster (8–12 anos)', description: 'Assento de elevação.', codes: ['CBS', 'BST'] },
  { name: 'Condutor adicional', description: 'Segundo/terceiro motorista.', codes: ['ADD', 'ADR'] },
  { name: 'Sistema de navegação GPS', description: 'Navegador GPS portátil.', codes: ['NVS', 'NAV'] },
  { name: 'Ativação de pedágio eletrônico (Toll / Via Verde)', description: 'Taxa de ativação de pedágio eletrônico.', codes: ['TOL', 'TOLL', 'VVR', 'ETL'] },
  { name: 'Taxa transfronteiriça', description: 'Condução em países adicionais.', codes: ['CBF', 'LRC'] },
  { name: 'Sobretaxa motorista jovem', description: 'Motoristas com menos de 25 anos.', codes: ['YOU', 'JAC'] },
  { name: 'Sobretaxa motorista sênior', description: 'Motoristas acima da idade máxima.', codes: ['SNR'] },
  { name: 'Diesel garantido', description: 'Disponível só em algumas categorias.', codes: ['DVD'] },
  { name: 'Carga para carros a diesel', description: 'Suplemento para diesel.', codes: ['DSL'] },
  { name: 'Rack de esqui', description: 'Suporte para esquis/snowboards.', codes: ['SKR', 'SKB', 'SKV'] },
  { name: 'Correntes para neve', description: 'Correntes para pneus.', codes: ['SNO', 'CHN'] },
  { name: 'Pneus de neve', description: 'Pneus para condições de neve.', codes: ['STR'] },
  { name: 'Wi-Fi portátil', description: 'Hotspot móvel.', codes: ['WFI'] },
  { name: 'Serviço de emergência no exterior', description: 'Assistência de emergência internacional.', codes: ['EMS'] },
  { name: 'Compensação de CO₂', description: 'Contribuição ambiental opcional (código CO2).', codes: ['CO2'] },
  { name: 'Extra SCH', description: 'Item opcional da estação (código SCH).', codes: ['SCH'] },
  { name: 'Extra ED1', description: 'Item opcional da estação (código ED1).', codes: ['ED1'] },
  { name: 'Extra IER', description: 'Item opcional da estação (código IER).', codes: ['IER'] },
];
