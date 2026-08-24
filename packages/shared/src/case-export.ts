/**
 * Onde o dossiê de um caso fica guardado.
 *
 * A chave é função pura dos identificadores, e por isso **não é gravada em lugar nenhum**. O
 * worker calcula para escrever, a API calcula para assinar a URL, e as duas chegam ao mesmo
 * lugar sem que o layout do armazenamento precise trafegar pela linha do trabalho — que é
 * devolvida inteira pela rota genérica de acompanhamento de processamento.
 *
 * Prefixo próprio: é arquivo que nós produzimos, nunca um envio de terceiro, então fica fora
 * do caminho de quarentena e varredura que governa a entrada de documentos.
 */
export function caseDossierObjectKey(
  organizationId: string,
  caseId: string,
  jobId: string,
): string {
  return `exports/${organizationId}/${caseId}/${jobId}.pdf`;
}
