/* ============================================================================
 * totales.js — UNA sola regla de "qué cuenta como vendido".
 * ----------------------------------------------------------------------------
 * Por qué existe (2026): el mismo número ("cuánto vendimos") se calculaba en
 * varios lugares con reglas ligeramente distintas — la tarjeta de Ventas, el
 * Excel de Ventas, el Excel de Reportes, "Facturado hoy" del Dashboard y
 * "Total facturado" de Facturas. Cuando cada pantalla sumaba a su manera, los
 * totales no cuadraban entre sí. Todo lo que muestre o exporte un total de
 * dinero debe pasar por este archivo.
 *
 * REGLAS
 *  - VENDIDO = ventas en estado 'pagado' o 'entregado'.
 *  - 'cancelado' NUNCA suma. Su valor se deja en blanco al exportar, para que
 *    nadie lo sume sin querer al seleccionar la columna en Excel.
 *  - 'pendiente' / 'en_preparacion' / 'listo_para_entregar' todavía no se han
 *    cobrado: no son "vendido". Se muestran aparte como "en curso, sin cobrar"
 *    para que (vendido + en curso) siga cuadrando con la suma de la columna.
 *
 * FACTURAS CANCELADAS
 *  La tabla 'facturas' no tiene columna de estado y una venta ya pagada SÍ
 *  puede cancelarse después (VentaController::cambiarEstado devuelve el stock
 *  pero deja la factura intacta). Por eso "factura cancelada" = factura cuya
 *  venta está en 'cancelado'. FacturaController::index ya carga la relación
 *  'venta', así que no hace falta tocar el backend.
 *
 * Es un módulo "hoja": no importa nada, así que lo pueden usar vistas,
 * servicios y utils sin crear dependencias circulares.
 * ==========================================================================*/

export const ESTADOS_VENDIDOS = ["pagado", "entregado"];
export const ESTADOS_EN_CURSO = ["pendiente", "en_preparacion", "listo_para_entregar"];

// Los totales vienen de MySQL como decimal(10,2) en string ("38000.00").
// Se redondea a 2 decimales para que la suma en coma flotante de JS no deje
// restos tipo 0.1 + 0.2 = 0.30000000000000004.
const aNumero = (valor) => Number(valor) || 0;
const redondear = (n) => Math.round(n * 100) / 100;

export const esVentaVendida = (venta) => ESTADOS_VENDIDOS.includes(venta?.estado);
export const esVentaCancelada = (venta) => venta?.estado === "cancelado";
export const esVentaEnCurso = (venta) => ESTADOS_EN_CURSO.includes(venta?.estado);

/**
 * Resumen de dinero de un conjunto de ventas.
 * @returns {{ vendido:number, cantidadVendida:number, enCurso:number, cantidadEnCurso:number, canceladas:number }}
 */
export function resumenVentas(ventas) {
  let vendido = 0;
  let enCurso = 0;
  let cantidadVendida = 0;
  let cantidadEnCurso = 0;
  let canceladas = 0;

  for (const v of ventas ?? []) {
    if (esVentaVendida(v)) {
      vendido += aNumero(v.total);
      cantidadVendida += 1;
    } else if (esVentaEnCurso(v)) {
      enCurso += aNumero(v.total);
      cantidadEnCurso += 1;
    } else if (esVentaCancelada(v)) {
      canceladas += 1;
    }
  }

  return {
    vendido: redondear(vendido),
    cantidadVendida,
    enCurso: redondear(enCurso),
    cantidadEnCurso,
    canceladas,
  };
}

/**
 * Valor de la columna "Total" al exportar: número (para que Excel pueda
 * sumarlo) o "" en blanco si la venta está cancelada.
 */
export function totalVentaParaExportar(venta) {
  return esVentaCancelada(venta) ? "" : aNumero(venta?.total);
}

/**
 * Filas de cierre del Excel/PDF de ventas. Se calcula con la MISMA función
 * (resumenVentas) que la tarjeta de la pantalla, así que si se exporta el
 * mismo filtro, ambos números son idénticos.
 */
export function pieTotalesVentas(ventas) {
  const r = resumenVentas(ventas);
  const pie = [{ etiqueta: "TOTAL VENDIDO (pagado + entregado)", valor: r.vendido }];

  if (r.cantidadEnCurso > 0) {
    pie.push({ etiqueta: "En curso, aún sin cobrar (no incluido en el total vendido)", valor: r.enCurso });
  }
  if (r.canceladas > 0) {
    pie.push({ etiqueta: `Ventas canceladas excluidas: ${r.canceladas} (su valor se deja en blanco)` });
  }
  return pie;
}

/**
 * Una factura está vigente mientras su venta no esté cancelada. Si la
 * relación 'venta' no vino cargada no hay forma de saber que se canceló, así
 * que se considera vigente (comportamiento anterior, no se pierde dinero de
 * vista por un dato faltante).
 */
export const esFacturaVigente = (factura) => factura?.venta?.estado !== "cancelado";

export function sumarFacturasVigentes(facturas) {
  return redondear((facturas ?? []).filter(esFacturaVigente).reduce((suma, f) => suma + aNumero(f.total), 0));
}
