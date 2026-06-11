/** Días sin pago antes de marcar como "en mora" */
export const DIAS_MORA_ALERTA = 15;

/** Días sin pago antes de marcar como "crítico" */
export const DIAS_MORA_CRITICO = 30;

/** Tope de crédito por defecto para clientes nuevos (COP) */
export const CREDITO_DEFAULT = 50_000;

/** Límite de registros por defecto en queries de listado */
export const QUERY_LIMIT_DEFAULT = 50;

/** Duración del JWT en formato jose */
export const TOKEN_EXPIRY = '7d';

/** Duración máxima de la cookie de sesión en segundos (7 días) */
export const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
