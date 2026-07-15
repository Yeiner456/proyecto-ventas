import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { comprobanteUrl } from "../services/apiClient";

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
 * PDF de una factura individual (no un reporte tabular como descargarPDF).
 * Se generó porque FacturaService (backend) crea el registro en BD pero
 * nunca produce un archivo real — el campo 'pdf_ruta' del modelo Factura
 * existe mas nunca se llena, y no hay ningún endpoint que sirva un PDF.
 * En vez de tocar el backend a días de la entrega, se arma aquí con los
 * mismos datos que ya carga el modal de detalle (GET /api/ventas/{id}),
 * mismo patrón que ya se usó para Reportes: todo en el navegador, cero
 * endpoints nuevos.
 *
 * @param factura objeto de GET /api/facturas (numero_factura, total, created_at, sucursal, cajero)
 * @param venta   objeto de GET /api/ventas/{id} (detalles.producto, metodo_pago)
 */
function cargarImagenComoDataURL(url) {
  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
      return res.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const lector = new FileReader();
          lector.onloadend = () => resolve(lector.result);
          lector.onerror = () => reject(new Error("No se pudo leer la imagen descargada."));
          lector.readAsDataURL(blob);
        })
    );
}

function dimensionesImagen(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("No se pudo leer las dimensiones de la imagen."));
    img.src = dataUrl;
  });
}

/**
 * @param factura objeto de GET /api/facturas (numero_factura, total, created_at, sucursal, cajero)
 * @param venta   objeto de GET /api/ventas/{id} (detalles.producto, metodo_pago, comprobantes)
 *
 * Es async porque, si la venta tiene un comprobante tipo imagen, hay que
 * descargarlo (fetch) antes de poder incrustarlo con doc.addImage(). Un
 * comprobante en PDF NO se puede fusionar aquí sin una librería aparte
 * (jsPDF no lee/combina PDFs ajenos) — en ese caso se deja una nota en
 * vez de fingir que se incrustó.
 */
export async function descargarFacturaPDF(factura, venta) {
  const doc = new jsPDF({ orientation: "portrait" });
  const formatMoney = (n) => `$${Number(n).toLocaleString("es-CO")}`;
  const formatFecha = (iso) =>
    new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

  // --- Encabezado ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text("Factura", 14, 20);

  doc.setFontSize(12);
  doc.setTextColor(...SENA_GREEN);
  doc.text(factura.numero_factura, 14, 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text(formatFecha(factura.created_at), 14, 34);

  // --- Datos de la venta (sucursal / cajero / método de pago) ---
  const datosVenta = [
    ["Sucursal", factura.sucursal?.nombre ?? "—"],
    ["Cajero", factura.cajero?.nombre ?? "—"],
    ["Método de pago", venta?.metodo_pago?.nombre ?? "—"],
    ["Venta asociada", `#${factura.venta_id}`],
  ];

  autoTable(doc, {
    startY: 40,
    body: datosVenta,
    theme: "plain",
    styles: { fontSize: 9, textColor: INK, cellPadding: { top: 1, bottom: 1, left: 0, right: 4 } },
    columnStyles: { 0: { fontStyle: "bold", textColor: TEXT_SECONDARY, cellWidth: 40 } },
  });

  // --- Tabla de productos ---
  const detalles = venta?.detalles ?? [];
  const filasProductos = detalles.map((d) => [
    d.producto?.nombre ?? "Producto eliminado",
    String(d.cantidad),
    formatMoney(d.precio_unitario_venta),
    formatMoney(d.cantidad * d.precio_unitario_venta),
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [["Producto", "Cant.", "Precio unit.", "Subtotal"]],
    body: filasProductos,
    headStyles: { fillColor: SENA_GREEN, textColor: WHITE, fontStyle: "bold" },
    styles: { fontSize: 9, textColor: INK },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      1: { halign: "right", cellWidth: 20 },
      2: { halign: "right", cellWidth: 35 },
      3: { halign: "right", cellWidth: 35 },
    },
  });

  // --- Total ---
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text("Total", 140, finalY, { align: "right" });
  doc.text(formatMoney(factura.total), 196, finalY, { align: "right" });

  // --- Comprobante de pago, como página(s) adicional(es) ---
  const comprobantes = venta?.comprobantes ?? [];
  for (const c of comprobantes) {
    const esImagen = ["jpg", "jpeg", "png"].includes((c.tipo_archivo ?? "").toLowerCase());

    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    doc.text("Comprobante de pago", 14, 18);

    if (!esImagen) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_SECONDARY);
      doc.text(
        `Este comprobante se subió como archivo PDF y no se puede incrustar aquí. Descárgalo por separado desde el detalle de la venta (Comprobante.${c.tipo_archivo}).`,
        14,
        28,
        { maxWidth: 182 }
      );
      continue;
    }

    try {
      const dataUrl = await cargarImagenComoDataURL(comprobanteUrl(c.id_comprobante));
      const { width, height } = await dimensionesImagen(dataUrl);

      // Ajustar la imagen al ancho de la página (A4: 210mm), dejando
      // márgenes de 14mm a cada lado, sin deformar la proporción.
      const anchoMax = 182;
      const altoMax = 250;
      const escala = Math.min(anchoMax / width, altoMax / height, 1);
      const anchoFinal = width * escala;
      const altoFinal = height * escala;

      const formato = c.tipo_archivo.toLowerCase() === "png" ? "PNG" : "JPEG";
      doc.addImage(dataUrl, formato, 14, 26, anchoFinal, altoFinal);
    } catch (e) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_SECONDARY);
      doc.text("No se pudo cargar la imagen del comprobante. Verifica la conexión con el servidor.", 14, 28, {
        maxWidth: 182,
      });
    }
  }

  doc.save(`${factura.numero_factura}.pdf`);
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
