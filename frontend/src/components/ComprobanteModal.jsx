import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Paperclip, RotateCcw, AlertTriangle, Loader2, CheckCircle2, X, Clock } from "lucide-react";

/* ============================================================================
 * ComprobanteModal — paso final del cobro para métodos de pago que exigen
 * comprobante (MetodoPago::requiere_comp, ej. Transferencia bancaria).
 * ----------------------------------------------------------------------------
 * Responsabilidad única: producir un File (foto tomada o archivo adjunto) y
 * entregarlo al padre vía onConfirmar(file). No conoce la API ni la venta —
 * NuevaVentaView es quien sube el archivo a POST /api/comprobantes-pago y
 * luego cambia el estado de la venta a 'pagado'. Mismo patrón que
 * RestaurarModal en BackupsView.jsx: el hijo solo recoge input del usuario,
 * el padre orquesta las llamadas de red y pasa `subiendo`/`error` como props.
 *
 * Backend acepta jpg, jpeg, png o pdf, máx. 5MB (StoreComprobantePagoRequest).
 *
 * Salir de aquí sin terminar tiene DOS caminos distintos, a propósito:
 *   - "Dejar pendiente" (y la X / click afuera, que son lo mismo): la
 *     venta ya nació 'pendiente' en el paso 1 del cobro, así que esto no
 *     llama a la API — solo cierra el modal y el cajero la retoma después
 *     desde "Ventas pendientes".
 *   - "Cancelar venta": de verdad anula la venta (PATCH estado=cancelado).
 *     Antes esta era la ÚNICA salida (hasta la X cancelaba) — ahora es la
 *     opción explícita para cuando el cajero de verdad no va a completarla.
 * ==========================================================================*/

const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "application/pdf"];
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5MB, igual que el backend

export default function ComprobanteModal({ ventaId, subiendo, error, onConfirmar, onDejarPendiente, onCancelar }) {
    const [modo, setModo] = useState("elegir"); // elegir | camara | previsualizar
    const [archivo, setArchivo] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [errorCamara, setErrorCamara] = useState(null);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const fileInputRef = useRef(null);

    const detenerCamara = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }, []);

    // Corta la cámara si el modal se cierra o se desmonta con ella abierta.
    useEffect(() => () => detenerCamara(), [detenerCamara]);

    async function abrirCamara() {
        setErrorCamara(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false,
            });
            streamRef.current = stream;
            setModo("camara");
        } catch {
            setErrorCamara(
                "No se pudo acceder a la cámara (permiso denegado o no disponible). Usa 'Adjuntar comprobante' en su lugar."
            );
        }
    }

    useEffect(() => {
        if (modo === "camara" && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [modo]);

    function capturarFoto() {
        const video = videoRef.current;
        if (!video) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        canvas.toBlob(
            (blob) => {
                if (!blob) return;
                const file = new File([blob], `comprobante_venta_${ventaId}.jpg`, { type: "image/jpeg" });
                detenerCamara();
                setArchivo(file);
                setPreviewUrl(URL.createObjectURL(file));
                setModo("previsualizar");
            },
            "image/jpeg",
            0.9
        );
    }

    function manejarArchivoElegido(e) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        if (!TIPOS_ACEPTADOS.includes(file.type)) {
            setErrorCamara("Formato no permitido. Usa una imagen (JPG/PNG) o un PDF.");
            return;
        }
        if (file.size > TAMANO_MAXIMO) {
            setErrorCamara("El archivo pesa más de 5MB. Comprime la imagen o toma la foto de nuevo.");
            return;
        }

        setErrorCamara(null);
        setArchivo(file);
        setPreviewUrl(file.type === "application/pdf" ? null : URL.createObjectURL(file));
        setModo("previsualizar");
    }

    function reintentar() {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setArchivo(null);
        setPreviewUrl(null);
        setErrorCamara(null);
        setModo("elegir");
    }

    function cerrar() {
        detenerCamara();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        onDejarPendiente();
    }

    function cancelarVenta() {
        detenerCamara();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        onCancelar();
    }

    return (
        <div className="modal-overlay" onMouseDown={subiendo ? undefined : cerrar}>
            <div className="modal cm-modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">Comprobante de pago</h3>
                        <p className="field-help">Venta #{ventaId} · este método exige comprobante</p>
                    </div>
                    {!subiendo && (
                        <button className="modal-close" onClick={cerrar}>
                            <X size={18} />
                        </button>
                    )}
                </div>

                {modo === "elegir" && (
                    <div className="cm-opciones">
                        <button className="cm-opcion-btn" onClick={abrirCamara}>
                            <Camera size={28} />
                            Tomar foto
                        </button>
                        <button className="cm-opcion-btn" onClick={() => fileInputRef.current?.click()}>
                            <Paperclip size={28} />
                            Adjuntar comprobante
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            style={{ display: "none" }}
                            onChange={manejarArchivoElegido}
                        />
                    </div>
                )}

                {modo === "camara" && (
                    <div className="cm-camara">
                        <video ref={videoRef} autoPlay playsInline muted className="cm-video" />
                        <div className="modal-actions">
                            <button className="btn btn-outline" onClick={reintentar}>Cancelar</button>
                            <button className="btn btn-primary" onClick={capturarFoto}>
                                <Camera size={16} /> Capturar
                            </button>
                        </div>
                    </div>
                )}

                {modo === "previsualizar" && archivo && (
                    <div className="cm-preview">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Comprobante" className="cm-preview-img" />
                        ) : (
                            <div className="cm-preview-pdf">
                                <Paperclip size={32} />
                                <span>{archivo.name}</span>
                            </div>
                        )}

                        {error && (
                            <div className="alert alert-danger u-alert-xs">
                                <AlertTriangle size={14} className="u-icon-inline" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="modal-actions">
                            <button className="btn btn-outline" onClick={reintentar} disabled={subiendo}>
                                <RotateCcw size={14} /> Elegir otro
                            </button>
                            <button className="btn btn-primary" onClick={() => onConfirmar(archivo)} disabled={subiendo}>
                                {subiendo ? (
                                    <>
                                        <Loader2 size={16} className="cm-spin" /> Finalizando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} /> Finalizar compra
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {errorCamara && modo !== "previsualizar" && (
                    <div className="alert alert-danger u-alert-xs cm-error-camara">
                        <AlertTriangle size={14} className="u-icon-inline" />
                        <span>{errorCamara}</span>
                    </div>
                )}

                <button className="btn btn-outline u-btn-block cm-dejar-pendiente" onClick={cerrar} disabled={subiendo}>
                    <Clock size={14} /> Dejar pendiente
                </button>
                <button className="btn btn-danger-ghost u-btn-block cm-cancelar-venta" onClick={cancelarVenta} disabled={subiendo}>
                    Cancelar venta
                </button>
            </div>
        </div>
    );
}