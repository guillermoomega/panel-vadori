const Api = (() => {
  async function get(path, params = {}) {
    const url = new URL(window.PANEL_CONFIG.apiBase + path);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "X-Panel-Key": window.PANEL_CONFIG.panelKey }
    });

    if (res.status === 403) {
      throw new Error("Acceso rechazado (403) — clave del panel inválida o faltante.");
    }
    if (!res.ok) {
      throw new Error(`Error del servidor (${res.status})`);
    }
    return res.json();
  }

  async function post(path, body = {}) {
    const res = await fetch(window.PANEL_CONFIG.apiBase + path, {
      method: "POST",
      headers: {
        "X-Panel-Key": window.PANEL_CONFIG.panelKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.status === 403) {
      throw new Error("Acceso rechazado (403) — clave del panel inválida o faltante.");
    }
    if (!res.ok) {
      let mensaje = `Error del servidor (${res.status})`;
      try {
        const data = await res.json();
        if (data && data.error) mensaje = data.error;
      } catch (_) { /* respuesta sin cuerpo JSON */ }
      throw new Error(mensaje);
    }
    return res.json();
  }

  return {
    ocupacion: (desde, hasta) => get("/ocupacion", { desde, hasta }),
    hoy: () => get("/hoy"),
    limpieza: () => get("/limpieza"),
    asignar: (reserva_id, unidad_id) => post("/asignar", { reserva_id, unidad_id }),
    cambiarEstadoUnidad: (unidad_id, estado) => post("/estado-suite", { unidad_id, estado }),
    pagar: (reserva_id) => post("/pagar", { reserva_id }),
    recibirMesa: (reserva_id) => post("/recibir", { reserva_id }),
    walkin: (turno, adultos, ninios) => post("/walkin", { turno, adultos, ninios }),
    horas: (rango) => get("/horas", rango || {}),
    pagarHoras: (rango, excluidos, area) => post("/horas/pagar", { ...(rango || {}), excluidos: excluidos || [], ...(area ? { area } : {}) }),
    caja: (rango) => get("/caja", rango || {}),
    cuentaCorriente: (rango) => get("/cuenta-corriente", rango || {}),
    marcarPagadoCC: (id, origen_pago) => post("/cuenta-corriente/pagar", { id, origen_pago }),
    fichajes: (rango) => get("/fichajes", rango || {}),
    editarFichaje: (id, fecha, hora) => post("/fichajes/editar", { id, fecha, hora }),
    crearFichaje: ({ nombre, tipo, fecha, hora }) => post("/fichajes/crear", { nombre, tipo, fecha, hora })
  };
})();
