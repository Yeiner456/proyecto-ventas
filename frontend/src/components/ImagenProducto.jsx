import React, { useState } from "react";
import { Package } from "lucide-react";
import { productoImagenUrl } from "../services/apiClient";
import "../styles/ImagenProducto.css";

/* ============================================================================
 * ImagenProducto — miniatura reutilizable (POS de cajero, tabla de gestión
 * de Productos, previsualización del formulario).
 * ----------------------------------------------------------------------------
 * 'producto.imagen_ruta' viene nula para casi todos los productos hasta
 * que alguien la suba desde la vista de Productos, así que el caso
 * "sin imagen" es el camino normal, no un error: se muestra el placeholder
 * directo, sin pedirle nada a la API. Si sí hay ruta pero el archivo no
 * carga (por ejemplo, se borró a mano de storage/app/public), onError
 * cae al mismo placeholder en vez de dejar el ícono roto del navegador.
 * ==========================================================================*/
export default function ImagenProducto({ producto, width = 84, height = width, iconSize, className = "" }) {
  const [fallo, setFallo] = useState(false);
  const alturaNumerica = typeof height === "number" ? height : 84;
  const tamanoIcono = iconSize ?? Math.round(alturaNumerica * 0.32);

  const estiloContenedor = { width, height };

  if (!producto?.imagen_ruta || fallo) {
    return (
      <div className={`img-producto-wrap img-producto-placeholder ${className}`} style={estiloContenedor}>
        <Package size={tamanoIcono} />
      </div>
    );
  }

  return (
    <div className={`img-producto-wrap ${className}`} style={estiloContenedor}>
      <img
        className="img-producto-img"
        src={productoImagenUrl(producto.id_producto)}
        alt={producto.nombre}
        loading="lazy"
        onError={() => setFallo(true)}
      />
    </div>
  );
}
