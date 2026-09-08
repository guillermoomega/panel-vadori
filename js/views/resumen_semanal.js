const ViewResumenSemanal = (() => {
  const elEstado = () => document.getElementById("resumen-estado");
  const elContent = () => document.getElementById("resumen-content");

  let rangoOverride = null; // { desde, hasta } en YYYY-MM-DD, o null = rango por defecto del backend (miércoles a martes)
  let listenersAttached = false;
  const categoriasAbiertas = new Set();

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    elContent().addEventListener("click", (ev) => {
      const btnToggle = ev.target.closest("#resumen-btn-rango");
      if (btnToggle) {
        const form = document.getElementById("resumen-rango-form");
        form.hidden = !form.hidden;
        return;
      }
      const btnAplicar = ev.target.closest("#resumen-btn-aplicar");
      if (btnAplicar) {
        const desde = document.getElementById("resumen-input-desde").value;
        const hasta = document.getElementById("resumen-input-hasta").value;
        if (!desde || !hasta) return;
        rangoOverride = { desde, hasta };
        render();
        return;
      }
      const btnReset = ev.target.closest("#resumen-btn-reset");
      if (btnReset) {
        rangoOverride = null;
        render();
        return;
      }
      const card = ev.target.closest(".card-clickable");
      if (!card) return;
      const detalle = card.querySelector(".card-detail");
      if (!detalle) return;
      detalle.hidden = !detalle.hidden;
      const categoria = card.dataset.categoria;
      if (categoria) {
        if (detalle.hidden) categoriasAbiertas.delete(categoria);
        else categoriasAbiertas.add(categoria);
      }
    });
  }

  const LABEL_CATEGORIA = {
    "sueldos": "Sueldos",
    "servicios": "Servicios",
    "mantenimiento": "Mantenimiento",
    "insumos cocina": "Insumos cocina",
    "insumos suites": "Insumos suites",
    "bebidas": "Bebidas",
    "limpieza": "Limpieza",
    "otros": "Otros"
  };

  function labelCategoria(categoria) {
    return LABEL_CATEGORIA[categoria] || Utils.escapeHtml(categoria);
  }

  function fila(label, monto, totalRow) {
    return `
      <div class="card card-row"${totalRow ? ' style="font-weight:600;"' : ""}>
        <div class="card-main"><div class="card-title">${label}</div></div>
        <div class="card-right"><span class="card-hora">${Utils.formatMonto(monto)}</span></div>
      </div>`;
  }

  function filaComprobante(c) {
    const fechaTxt = c.fecha ? Utils.fechaCorta(c.fecha) : "sin fecha";
    const negocio = c.negocio ? Utils.escapeHtml(c.negocio) : "";
    const registrado = c.registrado_por ? Utils.escapeHtml(c.registrado_por) : "";
    const label = negocio ? `${fechaTxt} · ${negocio}` : fechaTxt;
    const valor = registrado ? `${Utils.formatMonto(c.monto)} — ${registrado}` : Utils.formatMonto(c.monto);
    return `<div class="card-detail-label">${label}</div><div>${valor}</div>`;
  }

  function filaCategoria(c) {
    const detalle = (c.detalle || []).map(filaComprobante).join("");
    const abierto = categoriasAbiertas.has(c.categoria);
    return `
      <div class="card card-clickable" data-categoria="${Utils.escapeHtml(c.categoria)}">
        <div class="card-row">
          <div class="card-main"><div class="card-title">${labelCategoria(c.categoria)} <span class="card-info-icon">ⓘ</span></div></div>
          <div class="card-right"><span class="card-hora">${Utils.formatMonto(c.monto)}</span></div>
        </div>
        <div class="card-detail"${abierto ? "" : " hidden"}>${detalle}</div>
      </div>`;
  }

  function renderContent(data) {
    const t = data.totales || { ingresos_total: 0, ingresos_efectivo: 0, ingresos_tarjeta: 0, egresos_por_categoria: [], egresos_total: 0, ganancia_perdida: 0, turnos_incluidos: 0 };
    const gananciaClase = t.ganancia_perdida >= 0 ? "tile-ok" : "tile-bad";
    const gananciaLabel = t.ganancia_perdida >= 0 ? "Ganancia" : "Pérdida";

    const egresosFilas = (t.egresos_por_categoria || []).length
      ? t.egresos_por_categoria.map(filaCategoria).join("")
      : `<div class="empty-msg">Sin comprobantes pagados en este período.</div>`;

    elContent().innerHTML = `
      <div class="horas-periodo">
        Período: <strong>${Utils.fechaLarga(data.desde)}</strong> → <strong>${Utils.fechaLarga(data.hasta)}</strong>
        <button type="button" id="resumen-btn-rango" class="btn-link">Cambiar rango</button>
      </div>
      <div id="resumen-rango-form" class="card-walkin-form" hidden>
        <input type="date" id="resumen-input-desde" class="input-fecha" value="${data.desde}">
        <span>a</span>
        <input type="date" id="resumen-input-hasta" class="input-fecha" value="${data.hasta}">
        <button type="button" id="resumen-btn-aplicar" class="btn-walkin-confirmar">Aplicar</button>
        ${rangoOverride ? `<button type="button" id="resumen-btn-reset" class="btn-link">Por defecto</button>` : ""}
      </div>

      <div class="section-title">Ingresos</div>
      ${fila("En efectivo", t.ingresos_efectivo)}
      ${fila("En tarjetas", t.ingresos_tarjeta)}
      ${fila("Total", t.ingresos_total, true)}

      <div class="section-title">Egresos</div>
      ${egresosFilas}
      ${fila("Total", t.egresos_total, true)}

      <div class="tiles-grid" style="margin-top: 12px;">
        <div class="tile ${gananciaClase}">
          <div class="tile-label">${gananciaLabel}</div>
          <div class="tile-value">${Utils.formatMonto(Math.abs(t.ganancia_perdida))}</div>
        </div>
      </div>
      <div class="estado-msg" style="padding-top: 0;">
        Calculado sobre ${t.turnos_incluidos} turno${t.turnos_incluidos === 1 ? "" : "s"} de caja registrados en el período (ingresos) y sobre los comprobantes pagados en el período (egresos) — no incluye turnos sin reporte cargado.
      </div>
    `;
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    try {
      const data = await Api.caja(rangoOverride);
      elEstado().textContent = "";
      renderContent(data);
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
