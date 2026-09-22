const ViewMpago = (() => {
  const elEstado = () => document.getElementById("mpago-estado");
  const elContent = () => document.getElementById("mpago-content");

  let rangoOverride = null; // { desde, hasta } en YYYY-MM-DD, o null = rango por defecto del backend
  let ultimaData = null;
  let abiertos = new Set(); // payment_id con el panel de imputación desplegado
  let turnoSeleccionado = {}; // payment_id -> reportes_caja_id elegido
  let listenersAttached = false;

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    elContent().addEventListener("click", async (ev) => {
      const btnToggle = ev.target.closest("#mpago-btn-rango");
      if (btnToggle) {
        const form = document.getElementById("mpago-rango-form");
        form.hidden = !form.hidden;
        return;
      }
      const btnAplicar = ev.target.closest("#mpago-btn-aplicar");
      if (btnAplicar) {
        const desde = document.getElementById("mpago-input-desde").value;
        const hasta = document.getElementById("mpago-input-hasta").value;
        if (!desde || !hasta) return;
        rangoOverride = { desde, hasta };
        render();
        return;
      }
      const btnReset = ev.target.closest("#mpago-btn-reset");
      if (btnReset) {
        rangoOverride = null;
        render();
        return;
      }
      const btnConfirmar = ev.target.closest(".btn-confirmar-imputar");
      if (btnConfirmar) {
        await handleImputar(btnConfirmar);
      }
    });

    elContent().addEventListener("change", (ev) => {
      const chk = ev.target.closest(".mp-check");
      if (chk) {
        const id = chk.dataset.id;
        if (chk.checked) abiertos.add(id);
        else abiertos.delete(id);
        rerenderLocal();
        return;
      }
      const sel = ev.target.closest(".mp-select-turno");
      if (sel) {
        turnoSeleccionado[sel.dataset.id] = sel.value;
      }
    });
  }

  function rerenderLocal() {
    if (!ultimaData) return;
    renderContent(ultimaData);
  }

  async function handleImputar(btn) {
    const id = btn.dataset.id;
    const t = (ultimaData.transferencias || []).find(x => x.payment_id === id);
    if (!t) return;
    const wrapper = btn.closest(".card-marcar-pagado");
    const select = wrapper.querySelector(".mp-select-turno");
    const reportes_caja_id = select.value;
    if (!reportes_caja_id) {
      select.focus();
      return;
    }
    const turno = (ultimaData.turnos_disponibles || []).find(x => x.id === reportes_caja_id);
    const turnoTxt = turno ? `${Utils.fechaCortaConDia(turno.fecha_apertura)} ${turno.hora_apertura || ""}` : "el turno seleccionado";
    if (!confirm(`¿Imputar ${Utils.formatMonto(t.monto)} (${Utils.fechaCortaConDia(t.fecha)}) como cobro en la caja de ${turnoTxt}?`)) {
      return;
    }
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    select.disabled = true;
    btn.textContent = "Imputando…";
    try {
      const res = await Api.imputarMpago({
        payment_id: t.payment_id,
        fecha: t.fecha,
        hora: t.hora,
        monto: t.monto,
        descripcion: t.descripcion,
        reportes_caja_id
      });
      if (!res.ok) throw new Error(res.error || "No se pudo imputar la transferencia.");
      abiertos.delete(id);
      await render();
    } catch (err) {
      btn.disabled = false;
      select.disabled = false;
      btn.textContent = textoOriginal;
      alert(err.message);
    }
  }

  function turnoLabel(turno) {
    const fecha = turno.fecha_apertura ? Utils.fechaCortaConDia(turno.fecha_apertura) : "—";
    const hora = turno.hora_apertura ? ` ${turno.hora_apertura.slice(0, 5)}` : "";
    const resp = turno.responsable_apertura ? ` · ${turno.responsable_apertura}` : "";
    const estado = turno.abierta ? " (abierta)" : "";
    return `${fecha}${hora}${resp}${estado}`;
  }

  function selectTurnoHtml(t, turnos) {
    const sugeridoId = t.turno_sugerido ? t.turno_sugerido.id : "";
    const seleccionado = turnoSeleccionado.hasOwnProperty(t.payment_id) ? turnoSeleccionado[t.payment_id] : sugeridoId;
    const opciones = turnos.map(tn => `<option value="${Utils.escapeHtml(tn.id)}"${tn.id === seleccionado ? " selected" : ""}>${Utils.escapeHtml(turnoLabel(tn))}</option>`).join("");
    return `
      <select class="select-unidad mp-select-turno" data-id="${Utils.escapeHtml(t.payment_id)}">
        <option value="">Elegir turno…</option>
        ${opciones}
      </select>`;
  }

  function cardTransferencia(t, turnos) {
    const subPartes = [];
    if (t.fecha) subPartes.push(Utils.fechaCortaConDia(t.fecha) + (t.hora ? ` ${t.hora.slice(0, 5)}` : ""));
    if (t.pagador) subPartes.push(t.pagador);
    if (t.metodo_pago) subPartes.push(t.metodo_pago);
    const sub = subPartes.map(Utils.escapeHtml).join(" · ");

    if (t.imputado) {
      return `
        <div class="card">
          <div class="card-row">
            <div class="card-main">
              <div class="card-title">${Utils.escapeHtml(t.descripcion || "Transferencia")}</div>
              <div class="card-sub">${sub}</div>
            </div>
            <div class="card-meta">
              <span class="card-hora">${Utils.formatMonto(t.monto)}</span>
              <span class="badge badge-ok">Imputada</span>
            </div>
          </div>
        </div>`;
    }

    const abierto = abiertos.has(t.payment_id);
    const checked = abierto ? " checked" : "";

    return `
      <div class="card">
        <div class="card-row">
          <label class="card-check">
            <input type="checkbox" class="mp-check" data-id="${Utils.escapeHtml(t.payment_id)}"${checked}>
          </label>
          <div class="card-main">
            <div class="card-title">${Utils.escapeHtml(t.descripcion || "Transferencia")}</div>
            <div class="card-sub">${sub}</div>
          </div>
          <div class="card-meta">
            <span class="card-hora">${Utils.formatMonto(t.monto)}</span>
            ${t.turno_sugerido ? "" : `<span class="badge badge-warn">Sin turno sugerido</span>`}
          </div>
        </div>
        ${abierto ? `
        <div class="card-asignar card-marcar-pagado">
          ${selectTurnoHtml(t, turnos)}
          <button type="button" class="btn-asignar btn-confirmar-imputar" data-id="${Utils.escapeHtml(t.payment_id)}">Imputar como cobro</button>
        </div>` : ""}
      </div>`;
  }

  function renderContent(data) {
    ultimaData = data;
    const turnos = data.turnos_disponibles || [];
    const items = data.transferencias || [];
    const pendientes = items.filter(t => !t.imputado).length;

    const contenido = items.length
      ? items.map(t => cardTransferencia(t, turnos)).join("")
      : `<div class="empty-msg">Sin transferencias de MercadoPago sin vincular a una reserva en este período.</div>`;

    elContent().innerHTML = `
      <div class="horas-periodo">
        Período: <strong>${Utils.fechaLarga(data.desde)}</strong> → <strong>${Utils.fechaLarga(data.hasta)}</strong>
        <button type="button" id="mpago-btn-rango" class="btn-link">Cambiar rango</button>
      </div>
      <div id="mpago-rango-form" class="card-walkin-form" hidden>
        <input type="date" id="mpago-input-desde" class="input-fecha" value="${data.desde}">
        <span>a</span>
        <input type="date" id="mpago-input-hasta" class="input-fecha" value="${data.hasta}">
        <button type="button" id="mpago-btn-aplicar" class="btn-walkin-confirmar">Aplicar</button>
        ${rangoOverride ? `<button type="button" id="mpago-btn-reset" class="btn-link">Por defecto</button>` : ""}
      </div>

      <div class="section-title">Transferencias MercadoPago${pendientes ? ` · ${pendientes} pendiente${pendientes === 1 ? "" : "s"} de imputar` : ""}</div>
      <div class="estado-msg" style="padding-top: 0;">Sólo se muestran pagos que no están vinculados a ninguna reserva o seña.</div>
      ${contenido}
    `;
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    try {
      const data = await Api.mpago(rangoOverride);
      elEstado().textContent = "";
      renderContent(data);
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
