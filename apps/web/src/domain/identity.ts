/**
 * Forma do nome curto do escritório, espelhando a validação do servidor.
 *
 * O mesmo padrão existe no DTO da API e numa constraint do banco. Aqui ele serve só para o
 * botão saber quando habilitar — quem decide continua sendo o servidor.
 */
export const organizationSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/u;
