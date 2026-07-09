import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/* ============================================================================
 * exportar.js — genera los archivos Excel/PDF en el navegador.
 * ----------------------------------------------------------------------------
 * Deliberadamente NO llama al backend: recibe filas ya resueltas (ver
 * reportesService.js) y las convierte a un archivo con SheetJS (xlsx) o
 * jsPDF + jspdf-autotable. Cero endpoints nuevos en Laravel — es la pieza
 * central de la decisión "generar en el frontend" tomada para Reportes.
 *
 * Requiere instalar en frontend/:
 *   npm install xlsx jspdf jspdf-autotable
 *
 * Colores tomados de acta_colores_tipografia.docx (v1.0, aprobado
 * 10/06/2026): jsPDF no puede leer las variables CSS de theme.css, así
 * que el verde SENA se repite aquí como RGB. Si el acta cambia de
 * versión, actualizar también estas constantes.
 * ==========================================================================*/

const SENA_GREEN = [57, 169, 0]; // #39A900
const INK = [26, 26, 26]; // #1A1A1A
const WHITE = [255, 255, 255]; // #FFFFFF
const TEXT_SECONDARY = [107, 114, 128]; // #6B7280
const ROW_ALT = [245, 245, 245]; // #F5F5F5

function filasAMatriz(datos, columnas) {
  return datos.map((fila) => columnas.map((col) => col.accessor(fila) ?? "—"));
}

/**
 * @param columnas [{ header: string, accessor: (fila) => valor }]
 */
export function descargarExcel({ nombreArchivo, hojaNombre = "Datos", columnas, datos }) {
  const encabezados = columnas.map((c) => c.header);
  const cuerpo = filasAMatriz(datos, columnas);

  const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...cuerpo]);
  hoja["!cols"] = columnas.map(() => ({ wch: 20 }));

  const libro = XLSX.utils.book_new();
  // Excel limita el nombre de hoja a 31 caracteres.
  XLSX.utils.book_append_sheet(libro, hoja, hojaNombre.slice(0, 31));

  XLSX.writeFile(libro, nombreArchivo);
}

export function descargarPDF({ nombreArchivo, titulo, subtitulo, columnas, datos }) {
  // Más de 5 columnas ya no cabe cómodo en vertical.
  const doc = new jsPDF({ orientation: columnas.length > 5 ? "landscape" : "portrait" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(titulo, 14, 18);

  let startY = 24;
  if (subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(subtitulo, 14, 25);
    startY = 32;
  }

  autoTable(doc, {
    startY,
    head: [columnas.map((c) => c.header)],
    body: filasAMatriz(datos, columnas),
    headStyles: { fillColor: SENA_GREEN, textColor: WHITE, fontStyle: "bold" },
    styles: { fontSize: 9, textColor: INK },
    alternateRowStyles: { fillColor: ROW_ALT },
  });

  doc.save(nombreArchivo);
}

/**
 * ej: nombreArchivoConFecha("inventario", "Sucursal Centro")
 *     -> "inventario_Sucursal-Centro_2026-07-09"
 */
export function nombreArchivoConFecha(prefijo, sucursalNombre) {
  const fecha = new Date().toISOString().slice(0, 10);
  const sucursalSlug = sucursalNombre
    ? sucursalNombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
    : "todas";
  return `${prefijo}_${sucursalSlug}_${fecha}`;
}
