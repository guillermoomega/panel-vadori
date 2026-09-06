const ViewCaja = (() => {
  const elEstado = () => document.getElementById("caja-estado");
  const elContent = () => document.getElementById("caja-content");

  let rangoOverride = null; // { desde, hasta } en YYYY-MM-DD, o null = rango por defecto del backend (hoy)
  let listenersAttached = false;

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    elContent().addEventListener("click", (ev) => {
      const btnToggle = ev.target.closest("#caja-btn-rango");
      if (btnToggle) {
        const form = document.getElementById("caja-rango-form");
        form.hidden = !form.hidden;
        return;
      }
      const btnAplicar = ev.target.closest("#caja-btn-aplicar");
      if (btnAplicar) {
        const desde = document.getElementById("caja-input-desde").value;
        const hasta = document.getElementById("caja-input-hasta").value;
        if (!desde || !hasta) return;
        rangoOverride = { desde, hasta };
        render();
        return;
      }
      const btnReset = ev.target.closest("#caja-btn-reset");
      if (btnReset) {
        rangoOverride = null;
        render();
      }
    });
  }

  // El ticket puede traer un campo ilegible; nunca inventamos un valor, mostramos "—".
  function val(n) {
    return (n === null || n === undefined) ? "—" : Utils.formatMonto(n);
  }

  function badgeDiferenciaTotal(r) {
    if (r.diferencia_total === null || r.diferencia_total === undefined) {
      return `<span class="badge badge-neutral">Diferencia no detectada</span>`;
    }
    if (Math.abs(r.diferencia_total) < 1) {
      return `<span class="badge badge-ok">Caja cuadra</span>`;
    }
    return `<span class="badge badge-warn">Diferencia caja ${Utils.formatMonto(r.diferencia_total)}</span>`;
  }

  function badgeEgresosComprobantes(r) {
    if (r.diferencia_egresos_vs_comprobantes === null || r.diferencia_egresos_vs_comprobantes === undefined) {
      return `<span class="badge badge-neutral">Sin comprobantes para comparar</span>`;
    }
    if (Math.abs(r.diferencia_egresos_vs_comprobantes) < 1) {
      return `<span class="badge badge-ok">Egresos coinciden con comprobantes</span>`;
    }
    return `<span class="badge badge-warn">Egresos vs comprobantes: diferencia ${Utils.formatMonto(r.diferencia_egresos_vs_comprobantes)}</span>`;
  }

  function filaAperturaCierre(label, fecha, hora, responsable) {
    const fechaTxt = fecha ? Utils.fechaLarga(fecha) : "—";
    const horaTxt = hora ? ` · ${Utils.escapeHtml(hora)}` : "";
    const respTxt = responsable ? Utils.escapeHtml(responsable) : "—";
    return `
      <div class="card-row">
        <div class="card-sub">${label}</div>
        <div>${fechaTxt}${horaTxt} — ${respTxt}</div>
      </div>`;
  }

  function filaMedioPago(nombre, fuente, usado, diferencia) {
    return `
      <div class="card-row">
        <div class="card-sub">${nombre}</div>
        <div>Fuente ${val(fuente)} · Usado ${val(usado)} · Dif ${val(diferencia)}</div>
      </div>`;
  }

  function terminalHtml(r) {
    const sinDatos = r.terminal_transferencia === null && r.terminal_tarjeta === null && r.terminal_total === null;
    if (sinDatos) return "";
    return `
      <div class="card-detail-label">Cierre de lote (terminal)</div>
      <div class="card-row"><div class="card-sub">Transferencia/QR</div><div>${val(r.terminal_transferencia)}</div></div>
      <div class="card-row"><div class="card-sub">Tarjeta</div><div>${val(r.terminal_tarjeta)}</div></div>
      <div class="card-row"><div class="card-sub">Total</div><div>${val(r.terminal_total)}</div></div>`;
  }

  function cardReporte(r) {
    const tituloFecha = r.fecha_cierre
      ? Utils.fechaLarga(r.fecha_cierre)
      : (r.fecha_apertura ? Utils.fechaLarga(r.fecha_apertura) : "Fecha sin datos");

    return `
      <div class="card">
        <div class="card-row">
          <div class="card-main">
            <div class="card-title">${tituloFecha}</div>
            <div class="card-sub">${Utils.escapeHtml(r.registrado_por || "Sin remitente")}</div>
          </div>
          <div class="card-meta"><span class="card-hora">${val(r.resumen)}</span></div>
        </div>
        <div class="card-detail">
          <div class="card-detail-label">Apertura / Cierre</div>
          ${filaAperturaCierre("Apertura", r.fecha_apertura, r.hora_apertura, r.responsable_apertura)}
          ${filaAperturaCierre("Cierre", r.fecha_cierre, r.hora_cierre, r.responsable_cierre)}

          <div class="card-detail-label">Totales</div>
          <div class="card-row"><div class="card-sub">Ingresos</div><div>${val(r.ingresos_total)}</div></div>
          <div class="card-row"><div class="card-sub">Egreso</div><div>${val(r.egreso_total)}</div></div>
          <div class="card-row"><div class="card-sub">Resumen</div><div>${val(r.resumen)}</div></div>

          <div class="card-detail-label">Fuente / Usado / Diferencia</div>
          ${filaMedioPago("Efectivo", r.total_fuente_efectivo, r.total_usado_efectivo, r.diferencia_efectivo)}
          ${filaMedioPago("Tarjeta", r.total_fuente_tarjeta, r.total_usado_tarjeta, r.diferencia_tarjeta)}
          <div class="card-row"><div class="card-sub">Total</div><div>Dif ${val(r.diferencia_total)}</div></div>

          ${terminalHtml(r)}

          <div class="card-detail-label">Consistencia</div>
          <div class="card-row" style="flex-wrap: wrap; gap: 6px;">
            ${badgeDiferenciaTotal(r)}
            ${badgeEgresosComprobantes(r)}
          </div>
        </div>
      </div>`;
  }

  function renderContent(data) {
    const reportesHtml = data.reportes.length
      ? data.reportes.map(cardReporte).join("")
      : `<div class="empty-msg">Sin reportes de caja registrados en este período.</div>`;

    elContent().innerHTML = `
      <div class="horas-periodo">
        Período: <strong>${Utils.fechaLarga(data.desde)}</strong> → <strong>${Utils.fechaLarga(data.hasta)}</strong>
        <button type="button" id="caja-btn-rango" class="btn-link">Cambiar rango</button>
      </div>
      <div id="caja-rango-form" class="card-walkin-form" hidden>
        <input type="date" id="caja-input-desde" class="input-fecha" value="${data.desde}">
        <span>a</span>
        <input type="date" id="caja-input-hasta" class="input-fecha" value="${data.hasta}">
        <button type="button" id="caja-btn-aplicar" class="btn-walkin-confirmar">Aplicar</button>
        ${rangoOverride ? `<button type="button" id="caja-btn-reset" class="btn-link">Por defecto</button>` : ""}
      </div>

      <div class="section-title">Reportes de caja</div>
      ${reportesHtml}
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
