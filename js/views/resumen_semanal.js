const ViewResumenSemanal = (() => {
  const elEstado = () => document.getElementById("resumen-estado");
  const elContent = () => document.getElementById("resumen-content");

  let rangoOverride = null; // { desde, hasta } en YYYY-MM-DD, o null = rango por defecto del backend (miércoles a martes)
  let listenersAttached = false;

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
      }
    });
  }

  function renderContent(data) {
    const t = data.totales || { ingresos_total: 0, egresos_efectivo: 0, egresos_tarjeta: 0, ganancia_perdida: 0, turnos_incluidos: 0 };
    const gananciaClase = t.ganancia_perdida >= 0 ? "tile-ok" : "tile-bad";
    const gananciaLabel = t.ganancia_perdida >= 0 ? "Ganancia" : "Pérdida";

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

      <div class="section-title">Totales del período</div>
      <div class="tiles-grid">
        <div class="tile">
          <div class="tile-label">Ingresos totales</div>
          <div class="tile-value">${Utils.formatMonto(t.ingresos_total)}</div>
        </div>
        <div class="tile">
          <div class="tile-label">Egresos en efectivo</div>
          <div class="tile-value">${Utils.formatMonto(t.egresos_efectivo)}</div>
        </div>
        <div class="tile">
          <div class="tile-label">Egresos en tarjeta</div>
          <div class="tile-value">${Utils.formatMonto(t.egresos_tarjeta)}</div>
        </div>
        <div class="tile ${gananciaClase}">
          <div class="tile-label">${gananciaLabel}</div>
          <div class="tile-value">${Utils.formatMonto(Math.abs(t.ganancia_perdida))}</div>
        </div>
      </div>
      <div class="estado-msg" style="padding-top: 0;">
        Calculado sobre ${t.turnos_incluidos} turno${t.turnos_incluidos === 1 ? "" : "s"} de caja registrados en el período (Caja GV) — no incluye turnos sin reporte cargado.
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
