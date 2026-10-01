// Peso corporal ao longo do tempo.
//
// O perfil guardava um peso só, o da última edição: a meta de calorias usava o número,
// mas a tendência se perdia. Cada mudança de peso agora vira um registro do dia (um por
// dia, o último vence), e o perfil continua lendo o mais recente para a conta.

import { somarDias } from './consumo';

export interface RegistroPeso {
  /** Dia local 'AAAA-MM-DD' — chave primária: um registro por dia. */
  dia: string;
  kg: number;
  criadoEm: number;
}

export interface TendenciaPeso {
  atual: number;
  /** Diferença em kg entre o registro mais recente e o mais antigo da janela. */
  variacao: number;
  /** Dia do registro mais antigo da janela. */
  desde: string;
}

/** Faixa aceita como peso real (o campo do perfil recebe cada tecla digitada). */
export function pesoValido(kg: number | undefined): kg is number {
  return kg !== undefined && Number.isFinite(kg) && kg >= 20 && kg <= 400;
}

/** Registros dos últimos `dias` dias até `hoje`, em ordem cronológica. */
export function registrosNaJanela(registros: RegistroPeso[], hoje: string, dias: number): RegistroPeso[] {
  const inicio = somarDias(hoje, -dias);
  return registros.filter((r) => r.dia >= inicio && r.dia <= hoje).sort((a, b) => a.dia.localeCompare(b.dia));
}

/** Variação de peso na janela; null com menos de dois registros nela. */
export function tendenciaPeso(registros: RegistroPeso[], hoje: string, dias = 30): TendenciaPeso | null {
  const janela = registrosNaJanela(registros, hoje, dias);
  if (janela.length < 2) return null;
  const primeiro = janela[0];
  const ultimo = janela[janela.length - 1];
  return {
    atual: ultimo.kg,
    variacao: Math.round((ultimo.kg - primeiro.kg) * 10) / 10,
    desde: primeiro.dia,
  };
}
