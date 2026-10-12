import React from "react";
import { CREDITOS } from "../../config/creditos";
import "../../styles/Creditos.css";

/* ============================================================================
 * Creditos — pie con los créditos del sistema.
 * ----------------------------------------------------------------------------
 * Los datos viven en config/creditos.js. Dos usos:
 *   - Pantalla de inicio de sesión: variante "clara" y `detallado`, que además
 *     lista a los integrantes del equipo cuando estén cargados.
 *   - Barra lateral: variante "oscura" (fondo oscuro) y compacto — solo dos
 *     líneas, para no ocupar espacio en el menú.
 * ==========================================================================*/
export default function Creditos({ variante = "clara", detallado = false }) {
  const { sistema, entidad, equipo, anio, integrantes } = CREDITOS;

  return (
    <div className={`creditos creditos-${variante}`}>
      <p className="creditos-titulo">
        {sistema} · {entidad}
      </p>
      <p className="creditos-linea">
        Desarrollado por el {equipo} · {anio}
      </p>

      {detallado && integrantes.length > 0 && (
        <ul className="creditos-lista">
          {integrantes.map((persona) => (
            <li key={persona.nombre}>
              {persona.nombre}
              {persona.rol ? <span className="creditos-rol"> — {persona.rol}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
