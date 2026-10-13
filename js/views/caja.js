const ViewCaja = (() => {
  const elEstado = () => document.getElementById("caja-estado");
  const elContent = () => document.getElementById("caja-content");

  let rangoOverride = null; // { desde, hasta } en YYYY-MM-DD, o null = rango por defecto del backend (hoy)
  let listenersAttached = false;

  // Debajo de este monto, una diferencia no se resalta en rojo (redondeo, vuelto, etc.) —
  // umbral único para que sea fácil de ajustar, pedido por el usuario 2026-10-12.
  const DIFERENCIA_UMBRAL = 1000;

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    elContent().addEventListener("click", async (ev) => {
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
        return;
      }
      const btnGuardarNota = ev.target.closest(".btn-guardar-nota");
      if (btnGuardarNota) {
        await handleGuardarNota(btnGuardarNota);
      }
    });
  }

  async function handleGuardarNota(btn) {
    const id = btn.dataset.cajaId;
    const textarea = btn.closest(".card-nota").querySelector(".input-nota");
    const nota = textarea.value;
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    textarea.disabled = true;
    btn.textContent = "Guardando…";
    try {
      const res = await Api.cajaNota(id, nota);
      if (!res.ok) throw new Error(res.error || "No se pudo guardar la nota.");
      await render();
    } catch (err) {
      btn.disabled = false;
      textarea.disabled = false;
      btn.textContent = textoOriginal;
      alert(err.message);
    }
  }

  // El ticket puede traer un campo ilegible; nunca inventamos un valor, mostramos "—".
  function val(n) {
    return (n === null || n === undefined) ? "—" : Utils.formatMonto(n);
  }

  // Monto de una diferencia: en rojo solo si abs(valor) >= DIFERENCIA_UMBRAL, si no, color de
  // texto normal (una diferencia de $12 no es un error grave). Pedido del usuario 2026-10-12.
  function valDif(n) {
    if (n === null || n === undefined) return "—";
    const clase = Math.abs(n) >= DIFERENCIA_UMBRAL ? "dif-roja" : "";
    return clase ? `<span class="${clase}">${Utils.formatMonto(n)}</span>` : Utils.formatMonto(n);
  }

  // Clasifica una diferencia para chips: "ok" (prácticamente cero), "neutral" (chica, < umbral)
  // o "mala" (>= umbral, se resalta en rojo como hasta ahora).
  function nivelDif(n) {
    if (n === null || n === undefined) return "sindata";
    if (Math.abs(n) < 1) return "ok";
    if (Math.abs(n) < DIFERENCIA_UMBRAL) return "neutral";
    return "mala";
  }

  function badgeDiferenciaTotal(r) {
    // Diferencia_total viene de control_caja (fuente vs. usado de efectivo+tarjeta) y no sabe
    // nada de transferencias MP, que llegan por fuera de esos dos medios. Si hay transferencias
    // imputadas en este turno, se muestra la diferencia ya ajustada por ese cobro.
    const tieneAjuste = !!r.transferencias_mp_total;
    const diff = tieneAjuste ? r.diferencia_total_ajustada : r.diferencia_total;
    const sufijo = tieneAjuste ? " (con transferencias MP imputadas)" : "";
    const nivel = nivelDif(diff);
    if (nivel === "sindata") return `<span class="badge badge-neutral">Diferencia no detectada</span>`;
    if (nivel === "ok") return `<span class="badge badge-ok">Caja cuadra${sufijo}</span>`;
    const clase = nivel === "mala" ? "badge-diferencia" : "badge-neutral";
    return `<span class="badge ${clase}">Diferencia caja ${Utils.formatMonto(diff)}${sufijo}</span>`;
  }

  function badgeEgresosComprobantes(r) {
    const diff = r.diferencia_egresos_vs_comprobantes;
    const nivel = nivelDif(diff);
    if (nivel === "sindata") return `<span class="badge badge-neutral">Sin comprobantes para comparar</span>`;
    if (nivel === "ok") return `<span class="badge badge-ok">Egresos coinciden con comprobantes</span>`;
    const clase = nivel === "mala" ? "badge-diferencia" : "badge-neutral";
    return `<span class="badge ${clase}">Egresos vs comprobantes: diferencia ${Utils.formatMonto(diff)}</span>`;
  }

  function filaMedioPago(nombre, fuente, usado, diferencia) {
    return `
      <div class="card-row">
        <div class="card-sub">${nombre}</div>
        <div>Según sistema ${val(fuente)} · Real ${val(usado)} · Diferencia ${valDif(diferencia)}</div>
      </div>`;
  }

  function badgeDepositosEfectivo(r) {
    if (!r.depositos_efectivo) return "";
    const diff = r.diferencia_deposito_vs_usado;
    const nivel = nivelDif(diff);
    if (nivel === "sindata") return `<span class="badge badge-neutral">Depósitos registrados, sin efectivo contado para comparar</span>`;
    if (nivel === "ok") return `<span class="badge badge-ok">Depósito coincide con el efectivo contado</span>`;
    const clase = nivel === "mala" ? "badge-diferencia" : "badge-neutral";
    return `<span class="badge ${clase}">Depósito vs. efectivo contado: diferencia ${Utils.formatMonto(diff)}</span>`;
  }

  function filaDepositoEfectivo(r) {
    if (!r.depositos_efectivo) return "";
    return `
      <div class="card-row">
        <div class="card-sub">Depósitos del turno</div>
        <div>${val(r.depositos_efectivo)} · Dif vs. contado ${valDif(r.diferencia_deposito_vs_usado)}</div>
      </div>`;
  }

  function badgeTransferenciaVsImputado(r) {
    // El "Ingreso en transferencia" del ticket de Cierre de Lote (terminal_transferencia) es la
    // prueba externa de lo cobrado por QR/MercadoPago ese turno; se cruza contra lo que
    // efectivamente se imputó desde la vista M.Pago (transferencias_mp_total). Avisa cuando el
    // ticket dice que entró transferencia pero todavía no se imputó nada, o el monto no coincide.
    if (r.terminal_transferencia === null || r.terminal_transferencia === undefined) return "";
    const diff = r.diferencia_transferencia_mp_vs_terminal;
    const nivel = nivelDif(diff);
    if (nivel === "sindata") return "";
    if (nivel === "ok") return `<span class="badge badge-ok">QR del cierre de lote coincide con lo imputado</span>`;
    const clase = nivel === "mala" ? "badge-diferencia" : "badge-neutral";
    return `<span class="badge ${clase}">QR cierre de lote vs. imputado: diferencia ${Utils.formatMonto(diff)}</span>`;
  }

  function badgeTerminalVsUsado(r) {
    if (r.terminal_total === null || r.terminal_total === undefined) return "";
    const diff = r.diferencia_terminal_vs_usado;
    const nivel = nivelDif(diff);
    if (nivel === "sindata") return `<span class="badge badge-neutral">Cierre de lote registrado, sin tarjeta contada para comparar</span>`;
    if (nivel === "ok") return `<span class="badge badge-ok">Cierre de lote coincide con la tarjeta contada</span>`;
    const clase = nivel === "mala" ? "badge-diferencia" : "badge-neutral";
    return `<span class="badge ${clase}">Cierre de lote vs. tarjeta contada: diferencia ${Utils.formatMonto(diff)}</span>`;
  }

  // Cierre de Lote de la terminal bancaria: fuente externa distinta tanto del ticket de Arqueo
  // de Caja como de las transferencias MercadoPago imputadas. La línea que el ticket de Cierre
  // de Lote llama "transferencia" es en realidad lo cobrado por QR en la terminal — se muestra
  // como "QR" (antes decía "Transferencia/QR", cambiado a pedido del usuario 2026-10-12 para no
  // confundirla con las Transferencias MercadoPago, que son un ingreso aparte).
  function terminalHtml(r) {
    const sinDatos = r.terminal_transferencia === null && r.terminal_tarjeta === null && r.terminal_total === null;
    if (sinDatos) return "";
    return `
      <div class="card-detail-label">Cierre de lote (terminal bancaria)</div>
      <div class="card-row"><div class="card-sub">QR</div><div>${val(r.terminal_transferencia)} · Dif vs. imputado ${valDif(r.diferencia_transferencia_mp_vs_terminal)}</div></div>
      <div class="card-row"><div class="card-sub">Tarjeta</div><div>${val(r.terminal_tarjeta)}</div></div>
      <div class="card-row"><div class="card-sub">Total</div><div>${val(r.terminal_total)} · Dif vs. contado ${valDif(r.diferencia_terminal_vs_usado)}</div></div>`;
  }

  function comprobantesDetalleHtml(r) {
    if (!r.comprobantes || !r.comprobantes.length) return `<div class="empty-msg" style="padding:0 0 4px;">Sin comprobantes cargados en este turno.</div>`;
    const filas = r.comprobantes.map(c => `
      <div class="card-row">
        <div class="card-sub">${c.fecha ? Utils.fechaCortaConDia(c.fecha) : "—"} · ${Utils.escapeHtml(c.proveedor || "Sin proveedor")}${c.negocio ? " · " + Utils.escapeHtml(c.negocio) : ""}</div>
        <div>${val(c.monto)}</div>
      </div>`).join("");
    return `
      ${filas}
      <div class="card-row"><div class="card-sub">Total</div><div>${val(r.egresos_comprobantes)}</div></div>`;
  }

  function depositosDetalleHtml(r) {
    if (!r.depositos || !r.depositos.length) return "";
    const filas = r.depositos.map(d => `
      <div class="card-row">
        <div class="card-sub">${d.turno ? Utils.escapeHtml(d.turno) : "Turno sin especificar"}${d.registrado_por ? " · " + Utils.escapeHtml(d.registrado_por) : ""}</div>
        <div>${val(d.monto_total)}</div>
      </div>`).join("");
    return `
      <div class="card-detail-label">Depósitos en efectivo del turno</div>
      ${filas}`;
  }

  function transferenciasMPDetalleHtml(r) {
    if (!r.transferencias_mp || !r.transferencias_mp.length) return `<div class="empty-msg" style="padding:0 0 4px;">Sin transferencias MercadoPago imputadas en este turno.</div>`;
    const filas = r.transferencias_mp.map(t => `
      <div class="card-row">
        <div class="card-sub">${t.hora ? Utils.escapeHtml(t.hora.slice(0, 5)) : "—"}${t.descripcion ? " · " + Utils.escapeHtml(t.descripcion) : ""}</div>
        <div>${val(t.monto)}</div>
      </div>`).join("");
    return filas;
  }

  function notaHtml(r) {
    return `
      <div class="card-detail-label">Nota</div>
      <div class="card-nota">
        <textarea class="input-nota" data-caja-id="${Utils.escapeHtml(r.id)}" placeholder="Agregar una nota sobre este turno…">${Utils.escapeHtml(r.nota || "")}</textarea>
        <button type="button" class="btn-guardar-nota" data-caja-id="${Utils.escapeHtml(r.id)}">Guardar nota</button>
      </div>`;
  }

  // Total de ingresos del turno: lo que ya trae el ticket (Efectivo + Tarjeta + QR, bajo
  // Ingresos_total del arqueo) más las transferencias MercadoPago imputadas desde el panel,
  // que el ticket nunca vio. Mismo criterio que usa el backend para el agregado `totales`.
  function totalIngresos(r) {
    if (r.ingresos_total === null || r.ingresos_total === undefined) return null;
    return r.ingresos_total + (r.transferencias_mp_total || 0);
  }

  function headerAperturaCierre(r) {
    const horaApertura = r.hora_apertura ? r.hora_apertura.slice(0, 5) : "—";
    const horaCierre = r.hora_cierre ? r.hora_cierre.slice(0, 5) : "—";
    const respApertura = r.responsable_apertura ? Utils.escapeHtml(r.responsable_apertura) : "—";
    const respCierre = r.responsable_cierre ? Utils.escapeHtml(r.responsable_cierre) : "—";
    return `Apertura ${horaApertura} ${respApertura} · Cierre ${horaCierre} ${respCierre}`;
  }

  function cardReporte(r) {
    const tituloFecha = r.fecha_apertura
      ? Utils.fechaLarga(r.fecha_apertura)
      : (r.fecha_cierre ? Utils.fechaLarga(r.fecha_cierre) : "Fecha sin datos");

    const diferenciaCajaTotal = r.transferencias_mp_total ? r.diferencia_total_ajustada : r.diferencia_total;

    return `
      <div class="card">
        <div class="card-row">
          <div class="card-main">
            <div class="card-title">${tituloFecha}</div>
            <div class="card-sub">${Utils.escapeHtml(r.registrado_por || "Sin remitente")} · ${headerAperturaCierre(r)}</div>
          </div>
          <div class="card-meta"><span class="card-hora">${val(r.resumen)}</span></div>
        </div>
        <div class="card-row" style="flex-wrap: wrap; gap: 6px; margin-top: 6px;">
          ${badgeDiferenciaTotal(r)}
          ${badgeEgresosComprobantes(r)}
        </div>
        <div class="card-detail">
          <div class="card-detail-label">Ingresos</div>
          <div class="card-row"><div class="card-sub">Efectivo</div><div>${val(r.ventas_efectivo)}</div></div>
          <div class="card-row"><div class="card-sub">Tarjeta</div><div>${val(r.ventas_tarjeta)}</div></div>
          <div class="card-row"><div class="card-sub">QR</div><div>${val(r.ventas_transferencia)}</div></div>
          ${r.transferencias_mp_total ? `<div class="card-row"><div class="card-sub">Transferencias MercadoPago imputadas</div><div>${val(r.transferencias_mp_total)}</div></div>` : ""}
          <div class="card-row"><div class="card-sub"><strong>Total ingresos</strong></div><div><strong>${val(totalIngresos(r))}</strong></div></div>

          <div class="card-detail-label">Egresos</div>
          <div class="card-row"><div class="card-sub"><strong>Total egresos</strong></div><div><strong>${val(r.egreso_total)}</strong></div></div>
          <div class="card-row"><div class="card-sub">Comprobantes cargados</div><div>${val(r.egresos_comprobantes)}</div></div>
          <div class="card-row"><div class="card-sub">Diferencia vs. comprobantes</div><div>${valDif(r.diferencia_egresos_vs_comprobantes)}</div></div>
          <div class="card-row"><div class="card-sub">Resumen (saldo del turno)</div><div>${val(r.resumen)}</div></div>

          <div class="card-detail-label">Detalle de ingresos</div>
          ${transferenciasMPDetalleHtml(r)}

          <div class="card-detail-label">Detalle de egresos</div>
          ${comprobantesDetalleHtml(r)}

          <div class="card-detail-label">Conciliación por medio de pago</div>
          ${filaMedioPago("Efectivo", r.total_fuente_efectivo, r.total_usado_efectivo, r.diferencia_efectivo)}
          ${filaMedioPago("Tarjeta", r.total_fuente_tarjeta, r.total_usado_tarjeta, r.diferencia_tarjeta)}
          ${filaMedioPago("QR", r.total_fuente_transferencia, r.total_usado_transferencia, r.diferencia_transferencia)}
          ${filaMedioPago("Transferencias MP", null, r.transferencias_mp_total || null, null)}
          <div class="card-row"><div class="card-sub">Total</div><div>Diferencia ${valDif(diferenciaCajaTotal)}</div></div>
          <div class="card-help-text">Diferencia positiva = sobra; negativa = falta.</div>

          ${filaDepositoEfectivo(r) || badgeDepositosEfectivo(r) ? `
          <div class="card-detail-label">Depósitos bancarios</div>
          <div class="card-row" style="flex-wrap: wrap; gap: 6px;">${badgeDepositosEfectivo(r)}</div>
          ${filaDepositoEfectivo(r)}
          ${depositosDetalleHtml(r)}` : ""}

          ${terminalHtml(r) ? `
          <div class="card-row" style="flex-wrap: wrap; gap: 6px; margin-top: 8px;">
            ${badgeTerminalVsUsado(r)}
            ${badgeTransferenciaVsImputado(r)}
          </div>
          ${terminalHtml(r)}` : ""}

          ${notaHtml(r)}
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
      <div class="estado-msg" style="padding-top: 0;">Corresponden únicamente a la caja principal (Caja GV) — no incluyen otras cajas del predio.</div>
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
