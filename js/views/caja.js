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

  // Los gastos del arqueo (Egreso menos "Movimientos de caja" de egreso) se cruzan con los comprobantes.
  function badgeEgresosComprobantes(r) {
    const diff = r.diferencia_egresos_vs_comprobantes;
    const nivel = nivelDif(diff);
    if (nivel === "sindata") return `<span class="badge badge-neutral">Sin comprobantes para comparar</span>`;
    if (nivel === "ok") return `<span class="badge badge-ok">Gastos coinciden con comprobantes</span>`;
    const clase = nivel === "mala" ? "badge-diferencia" : "badge-neutral";
    return `<span class="badge ${clase}">Gastos vs comprobantes: diferencia ${Utils.formatMonto(diff)}</span>`;
  }

  // El monto inicial de una caja debería ser el efectivo contado (Total caja Usado) al cierre
  // de la caja anterior. Los depósitos de ese día no se descuentan, solo se muestran como
  // posible explicación de la diferencia.
  function badgeMontoInicial(r) {
    if (!r.turno_anterior) return "";
    const diff = r.diferencia_monto_inicial;
    const nivel = nivelDif(diff);
    if (nivel === "sindata") return `<span class="badge badge-neutral">Monto inicial sin dato para comparar</span>`;
    if (nivel === "ok") return `<span class="badge badge-ok">Inicial coincide con el cierre anterior</span>`;
    const clase = nivel === "mala" ? "badge-diferencia" : "badge-neutral";
    return `<span class="badge ${clase}">Inicial vs. cierre anterior: diferencia ${Utils.formatMonto(diff)}</span>`;
  }

  function montoInicialHtml(r) {
    const a = r.turno_anterior;
    const origen = a
      ? `${a.fecha_apertura ? Utils.fechaCortaConDia(a.fecha_apertura) : "—"} ${a.hora_apertura ? a.hora_apertura.slice(0, 5) : ""} – ${a.hora_cierre ? a.hora_cierre.slice(0, 5) : "—"}`
      : "";
    return `
      <div class="card-detail-label">Monto inicial</div>
      <div class="card-row"><div class="card-sub">Según arqueo</div><div>${val(r.monto_inicial)}</div></div>
      ${a ? `
      <div class="card-row"><div class="card-sub">Efectivo contado al cierre anterior (${origen})</div><div>${val(a.efectivo_contado)}</div></div>
      <div class="card-row"><div class="card-sub">Diferencia</div><div>${valDif(r.diferencia_monto_inicial)}</div></div>
      ${a.depositos_efectivo ? `<div class="card-row"><div class="card-sub">Depósitos registrados ese día</div><div>${val(a.depositos_efectivo)}</div></div>` : ""}`
      : `<div class="empty-msg" style="padding:0 0 4px;">No hay caja anterior en los 15 días previos para comparar.</div>`}`;
  }

  function filaMedioPago(nombre, fuente, usado, diferencia) {
    return `
      <div class="card-row">
        <div class="card-sub">${nombre}</div>
        <div>Según sistema ${val(fuente)} · Real ${val(usado)} · Diferencia ${valDif(diferencia)}</div>
      </div>`;
  }

  // Si el arqueo trae "Movimientos de caja" de egreso en efectivo, el depósito se compara contra
  // ese retiro; si no, contra el efectivo contado (criterio anterior).
  function hayDeposito(r) {
    return !!r.depositos_efectivo || (r.movimientos_egreso_efectivo !== null && r.movimientos_egreso_efectivo !== undefined);
  }

  function badgeDepositosEfectivo(r) {
    if (!hayDeposito(r)) return "";
    const contraRetiro = r.deposito_comparado_con === "movimiento";
    const diff = r.diferencia_deposito_vs_usado;
    const nivel = nivelDif(diff);
    if (nivel === "sindata") return `<span class="badge badge-neutral">Depósitos registrados, sin efectivo contado para comparar</span>`;
    if (contraRetiro && !r.depositos_efectivo) return `<span class="badge badge-diferencia">Retiro para depositar sin comprobante de depósito</span>`;
    const contra = contraRetiro ? "el retiro del arqueo" : "el efectivo contado";
    if (nivel === "ok") return `<span class="badge badge-ok">Depósito coincide con ${contra}</span>`;
    const clase = nivel === "mala" ? "badge-diferencia" : "badge-neutral";
    return `<span class="badge ${clase}">Depósito vs. ${contra}: diferencia ${Utils.formatMonto(diff)}</span>`;
  }

  function filaDepositoEfectivo(r) {
    if (!hayDeposito(r)) return "";
    const contraRetiro = r.deposito_comparado_con === "movimiento";
    return `
      ${contraRetiro ? `<div class="card-row"><div class="card-sub">Retiro para depositar (arqueo)</div><div>${val(r.movimientos_egreso_efectivo)}</div></div>` : ""}
      <div class="card-row">
        <div class="card-sub">Depósitos del turno</div>
        <div>${val(r.depositos_efectivo || 0)} · Dif vs. ${contraRetiro ? "retiro" : "contado"} ${valDif(r.diferencia_deposito_vs_usado)}</div>
      </div>`;
  }

  function badgeNivel(diff, sinDatoTxt, okTxt, difTxt) {
    const nivel = nivelDif(diff);
    if (nivel === "sindata") return `<span class="badge badge-neutral">${sinDatoTxt}</span>`;
    if (nivel === "ok") return `<span class="badge badge-ok">${okTxt}</span>`;
    const clase = nivel === "mala" ? "badge-diferencia" : "badge-neutral";
    return `<span class="badge ${clase}">${difTxt}: diferencia ${Utils.formatMonto(diff)}</span>`;
  }

  // Arqueos con línea QR propia: tarjeta del lote vs. tarjeta contada y QR del lote vs. QR contado,
  // ambos descontando las propinas (vouchers que llegan junto al cierre de lote).
  function badgeTerminalVsUsado(r) {
    if (r.terminal_total === null || r.terminal_total === undefined) return "";
    if (!r.qr_en_ticket) {
      return badgeNivel(r.diferencia_terminal_vs_usado, "Cierre de lote registrado, sin tarjeta contada para comparar",
        "Cierre de lote coincide con la tarjeta contada", "Cierre de lote vs. tarjeta contada");
    }
    return badgeNivel(r.diferencia_terminal_vs_usado, "Cierre de lote sin tarjeta para comparar",
        "Tarjeta del lote coincide con el arqueo", "Tarjeta del lote vs. arqueo")
      + badgeNivel(r.diferencia_qr_terminal_vs_usado, "Cierre de lote sin QR para comparar",
        "QR del lote coincide con el arqueo", "QR del lote vs. arqueo");
  }

  // Cierre de Lote de la terminal bancaria: fuente externa distinta tanto del ticket de Arqueo
  // de Caja como de las transferencias MercadoPago imputadas. El POS registra los cobros QR de la
  // terminal como "Tarjeta", por eso el total del cierre se compara contra la tarjeta contada y el
  // QR no se cruza con lo imputado en M.Pago (2026-10-31). La línea que el ticket de Cierre
  // de Lote llama "transferencia" es en realidad lo cobrado por QR en la terminal — se muestra
  // como "QR" (antes decía "Transferencia/QR", cambiado a pedido del usuario 2026-10-12 para no
  // confundirla con las Transferencias MercadoPago, que son un ingreso aparte).
  // Desde 2026-11-08 el arqueo trae la línea QR propia (qr_en_ticket): tarjeta y QR del lote se
  // comparan cada uno contra su línea del arqueo, descontando las propinas de los vouchers.
  function terminalHtml(r) {
    const sinDatos = r.terminal_transferencia === null && r.terminal_tarjeta === null && r.terminal_total === null;
    if (sinDatos) return "";
    const propinas = (r.propinas || []).map(p => `
      <div class="card-row" style="padding-left:16px;">
        <div class="card-sub">↳ ${p.hora ? Utils.escapeHtml(String(p.hora).slice(0, 5)) : "—"} · ${p.medio === "qr" ? "QR" : "Tarjeta"}</div>
        <div class="card-sub">${val(p.monto)}</div>
      </div>`).join("");
    const filaPropinas = (r.propinas_tarjeta || r.propinas_qr) ? `
      <div class="card-row"><div class="card-sub">Propinas (vouchers)</div><div>Tarjeta ${val(r.propinas_tarjeta || 0)} · QR ${val(r.propinas_qr || 0)}</div></div>${propinas}` : "";
    if (!r.qr_en_ticket) {
      return `
      <div class="card-detail-label">Cierre de lote (terminal bancaria)</div>
      <div class="card-row"><div class="card-sub">QR</div><div>${val(r.terminal_transferencia)}</div></div>
      <div class="card-row"><div class="card-sub">Tarjeta</div><div>${val(r.terminal_tarjeta)}</div></div>
      ${filaPropinas}
      <div class="card-row"><div class="card-sub">Total</div><div>${val(r.terminal_total)} · Dif vs. contado ${valDif(r.diferencia_terminal_vs_usado)}</div></div>`;
    }
    return `
      <div class="card-detail-label">Cierre de lote (terminal bancaria)</div>
      <div class="card-row"><div class="card-sub">Tarjeta</div><div>${val(r.terminal_tarjeta)} · Dif vs. arqueo ${valDif(r.diferencia_terminal_vs_usado)}</div></div>
      <div class="card-row"><div class="card-sub">QR</div><div>${val(r.terminal_transferencia)} · Dif vs. arqueo ${valDif(r.diferencia_qr_terminal_vs_usado)}</div></div>
      ${filaPropinas}
      <div class="card-row"><div class="card-sub">Total</div><div>${val(r.terminal_total)}</div></div>`;
  }

  // Sueldos pagados desde el panel: una sub-fila por persona (nombre y monto).
  function detalleSueldosHtml(c) {
    if (!c.detalle_sueldos || !c.detalle_sueldos.length) return "";
    return c.detalle_sueldos.map(d => `
      <div class="card-row" style="padding-left:16px;">
        <div class="card-sub">↳ ${Utils.escapeHtml(d.nombre)}${d.horas != null ? " · " + d.horas + " h" : ""}</div>
        <div class="card-sub">${val(d.monto)}</div>
      </div>`).join("");
  }

  function comprobantesDetalleHtml(r) {
    if (!r.comprobantes || !r.comprobantes.length) return `<div class="empty-msg" style="padding:0 0 4px;">Sin comprobantes cargados en este turno.</div>`;
    const filas = r.comprobantes.map(c => `
      <div class="card-row">
        <div class="card-sub">${c.fecha ? Utils.fechaCortaConDia(c.fecha) : "—"} · ${Utils.escapeHtml(c.proveedor || "Sin proveedor")}${c.negocio ? " · " + Utils.escapeHtml(c.negocio) : ""}</div>
        <div>${val(c.monto)}</div>
      </div>${detalleSueldosHtml(c)}`).join("");
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

  // Total de ingresos del turno: lo que ya trae el ticket (Ingresos_total del arqueo). Las
  // transferencias MercadoPago imputadas desde el panel solo se suman cuando el ticket no trae
  // la línea "Transferencia" (arqueos anteriores al 2026-10-12); si la trae, son la misma plata.
  // Mismo criterio que usa el backend para el agregado `totales`.
  function totalIngresos(r) {
    if (r.ingresos_total === null || r.ingresos_total === undefined) return null;
    return r.ingresos_total + (r.transferencias_mp_en_ticket ? 0 : (r.transferencias_mp_total || 0));
  }

  function filaTransferenciasMP(r) {
    if (!r.transferencias_mp_en_ticket) return filaMedioPago("Transferencias MP", null, r.transferencias_mp_total || null, null);
    return `
      <div class="card-row">
        <div class="card-sub">Transferencia vs. M.Pago</div>
        <div>Ticket ${val(r.total_usado_transferencia)} · Imputado ${val(r.transferencias_mp_total || 0)} · Diferencia ${valDif(r.diferencia_transferencia_mp_vs_usado)}</div>
      </div>`;
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
          ${badgeMontoInicial(r)}
        </div>
        <div class="card-detail">
          ${montoInicialHtml(r)}

          <div class="card-detail-label">Ingresos</div>
          <div class="card-row"><div class="card-sub">Efectivo</div><div>${val(r.ventas_efectivo)}</div></div>
          <div class="card-row"><div class="card-sub">Tarjeta</div><div>${val(r.ventas_tarjeta)}</div></div>
          <div class="card-row"><div class="card-sub">Transferencia</div><div>${val(r.ventas_transferencia)}</div></div>
          ${r.ventas_qr !== null && r.ventas_qr !== undefined ? `<div class="card-row"><div class="card-sub">QR</div><div>${val(r.ventas_qr)}</div></div>` : ""}
          ${r.movimientos_total ? `<div class="card-row"><div class="card-sub">Movimientos de caja${r.movimientos_efectivo ? " (efectivo)" : ""}</div><div>${val(r.movimientos_efectivo || r.movimientos_total)}</div></div>` : ""}
          ${r.transferencias_mp_total && !r.transferencias_mp_en_ticket ? `<div class="card-row"><div class="card-sub">Transferencias MercadoPago imputadas</div><div>${val(r.transferencias_mp_total)}</div></div>` : ""}
          <div class="card-row"><div class="card-sub"><strong>Total ingresos</strong></div><div><strong>${val(totalIngresos(r))}</strong></div></div>

          <div class="card-detail-label">Egresos</div>
          <div class="card-row"><div class="card-sub"><strong>Total egresos</strong></div><div><strong>${val(r.egreso_total)}</strong></div></div>
          ${r.movimientos_egreso_total ? `
          <div class="card-row"><div class="card-sub">Gastos</div><div>${val(r.gastos_arqueo)}</div></div>
          <div class="card-row"><div class="card-sub">Movimientos de caja (retiro para depositar)</div><div>${val(r.movimientos_egreso_total)}</div></div>` : ""}
          <div class="card-row"><div class="card-sub">Comprobantes cargados</div><div>${val(r.egresos_comprobantes)}</div></div>
          <div class="card-row"><div class="card-sub">Gastos vs. comprobantes</div><div>${valDif(r.diferencia_egresos_vs_comprobantes)}</div></div>
          <div class="card-row"><div class="card-sub">Resumen (saldo del turno)</div><div>${val(r.resumen)}</div></div>

          <div class="card-detail-label">Detalle de ingresos</div>
          ${transferenciasMPDetalleHtml(r)}

          <div class="card-detail-label">Detalle de egresos</div>
          ${comprobantesDetalleHtml(r)}

          <div class="card-detail-label">Conciliación por medio de pago</div>
          ${filaMedioPago("Efectivo", r.total_fuente_efectivo, r.total_usado_efectivo, r.diferencia_efectivo)}
          ${filaMedioPago("Tarjeta", r.total_fuente_tarjeta, r.total_usado_tarjeta, r.diferencia_tarjeta)}
          ${filaMedioPago("Transferencia", r.total_fuente_transferencia, r.total_usado_transferencia, r.diferencia_transferencia)}
          ${r.qr_en_ticket ? filaMedioPago("QR", r.total_fuente_qr, r.total_usado_qr, r.diferencia_qr) : ""}
          ${filaTransferenciasMP(r)}
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
          </div>
          ${terminalHtml(r)}` : ""}

          ${notaHtml(r)}
        </div>
      </div>`;
  }

  // Comprobantes Caja GV del período que no cayeron dentro del horario de ningún turno
  // (ej. sueldos pagados desde el panel fuera del horario de caja).
  function sinTurnoHtml(data) {
    const lista = data.comprobantes_sin_turno || [];
    if (!lista.length) return "";
    const filas = lista.map(c => `
      <div class="card-row">
        <div class="card-sub">${c.fecha ? Utils.fechaCortaConDia(c.fecha) : "—"} · ${Utils.escapeHtml(c.proveedor || "Sin proveedor")}${c.categoria ? " · " + Utils.escapeHtml(c.categoria) : ""}</div>
        <div>${val(c.monto)}</div>
      </div>${detalleSueldosHtml(c)}`).join("");
    return `
      <div class="section-title">Egresos sin turno asociado</div>
      <div class="estado-msg" style="padding-top: 0;">Pagos de Caja GV hechos fuera del horario de cualquier turno (por ejemplo, sueldos pagados desde el panel).</div>
      <div class="card">
        ${filas}
        <div class="card-row"><div class="card-sub"><strong>Total</strong></div><div><strong>${val(data.egresos_sin_turno_total)}</strong></div></div>
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
      ${sinTurnoHtml(data)}
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
