const ViewCuentaCorriente = (() => {
  const elEstado = () => document.getElementById("cuenta-corriente-estado");
  const elContent = () => document.getElementById("cuenta-corriente-content");

  let rangoOverride = null; // { desde, hasta } en YYYY-MM-DD, o null = rango por defecto del backend
  let proveedorFiltro = null; // nombre exacto del proveedor, o null = todos
  let estadoFiltro = "vencidas"; // "vencidas" | "no_vencidas" | null = todas — arranca en "vencidas" por defecto
  let selectedIds = new Set();
  let ultimaData = null;
  let listenersAttached = false;

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    elContent().addEventListener("click", async (ev) => {
      const btnToggle = ev.target.closest("#cc-btn-rango");
      if (btnToggle) {
        const form = document.getElementById("cc-rango-form");
        form.hidden = !form.hidden;
        return;
      }
      const btnAplicar = ev.target.closest("#cc-btn-aplicar");
      if (btnAplicar) {
        const desde = document.getElementById("cc-input-desde").value;
        const hasta = document.getElementById("cc-input-hasta").value;
        if (!desde || !hasta) return;
        rangoOverride = { desde, hasta };
        render();
        return;
      }
      const btnReset = ev.target.closest("#cc-btn-reset");
      if (btnReset) {
        rangoOverride = null;
        render();
        return;
      }
      const btnProveedor = ev.target.closest("#cc-btn-proveedor");
      if (btnProveedor) {
        const form = document.getElementById("cc-proveedor-form");
        form.hidden = !form.hidden;
        return;
      }
      const btnProveedorReset = ev.target.closest("#cc-btn-proveedor-reset");
      if (btnProveedorReset) {
        proveedorFiltro = null;
        rerenderLocal();
        return;
      }
      const btnEstado = ev.target.closest("#cc-btn-estado");
      if (btnEstado) {
        const form = document.getElementById("cc-estado-form");
        form.hidden = !form.hidden;
        return;
      }
      const btnEstadoReset = ev.target.closest("#cc-btn-estado-reset");
      if (btnEstadoReset) {
        estadoFiltro = null;
        rerenderLocal();
        return;
      }
      const btnPagarSel = ev.target.closest("#cc-btn-pagar-seleccionados");
      if (btnPagarSel) {
        await handleMarcarPagadoBulk();
        return;
      }
      const btnMarcar = ev.target.closest(".btn-marcar-pagado");
      if (btnMarcar) {
        await handleMarcarPagado(btnMarcar);
        return;
      }
      const card = ev.target.closest(".card-clickable");
      if (card && !ev.target.closest(".card-marcar-pagado") && !ev.target.closest(".card-check")) {
        const detalle = card.querySelector(".card-detail");
        if (detalle) detalle.hidden = !detalle.hidden;
      }
    });

    elContent().addEventListener("change", (ev) => {
      const selProveedor = ev.target.closest("#cc-select-proveedor");
      if (selProveedor) {
        proveedorFiltro = selProveedor.value || null;
        rerenderLocal();
        return;
      }
      const selEstado = ev.target.closest("#cc-select-estado");
      if (selEstado) {
        estadoFiltro = selEstado.value || null;
        rerenderLocal();
        return;
      }
      const chk = ev.target.closest(".cc-check");
      if (chk) {
        const id = chk.dataset.id;
        if (chk.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        rerenderLocal();
      }
    });
  }

  function rerenderLocal() {
    if (!ultimaData) return;
    renderContent(ultimaData);
  }

  async function handleMarcarPagado(btn) {
    const id = btn.dataset.id;
    const wrapper = btn.closest(".card-marcar-pagado");
    const select = wrapper.querySelector(".select-origen-pago");
    const origen_pago = select.value;
    if (!origen_pago) {
      select.focus();
      return;
    }
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    select.disabled = true;
    btn.textContent = "Marcando…";
    try {
      const res = await Api.marcarPagadoCC(id, origen_pago);
      if (!res.ok) throw new Error(res.error || "No se pudo marcar el comprobante como pagado.");
      await render();
    } catch (err) {
      btn.disabled = false;
      select.disabled = false;
      btn.textContent = textoOriginal;
      alert(err.message);
    }
  }

  async function handleMarcarPagadoBulk() {
    const select = document.getElementById("cc-bulk-origen");
    const origen_pago = select.value;
    if (!origen_pago) {
      select.focus();
      return;
    }
    const btn = document.getElementById("cc-btn-pagar-seleccionados");
    btn.disabled = true;
    select.disabled = true;
    btn.textContent = "Marcando…";
    let error = null;
    for (const id of Array.from(selectedIds)) {
      try {
        const res = await Api.marcarPagadoCC(id, origen_pago);
        if (!res.ok) throw new Error(res.error || "No se pudo marcar el comprobante como pagado.");
        selectedIds.delete(id);
      } catch (err) {
        error = err;
        break;
      }
    }
    await render();
    if (error) alert(error.message);
  }

  function badgeDias(dias) {
    if (dias === null || dias === undefined) return "";
    let clase = "badge-neutral";
    if (dias >= 30) clase = "badge-bad";
    else if (dias >= 14) clase = "badge-warn";
    return `<span class="badge ${clase}">${dias} día${dias === 1 ? "" : "s"}</span>`;
  }

  // Vencida = tiene fecha_vencimiento cargada y ya pasó. Sin fecha_vencimiento no se considera
  // vencida (no hay plazo pactado con el proveedor todavía).
  function esVencido(c) {
    return !!c.fecha_vencimiento && c.fecha_vencimiento < Utils.todayISO();
  }

  function badgeVencido(c) {
    if (!c.fecha_vencimiento) return "";
    return esVencido(c)
      ? `<span class="badge badge-bad">Vencida</span>`
      : `<span class="badge badge-ok">No vencida</span>`;
  }

  function cardComprobante(c) {
    const subPartes = [];
    subPartes.push(Utils.fechaLarga(c.fecha));
    if (c.categoria) subPartes.push(c.categoria);
    if (c.negocio) subPartes.push(c.negocio);
    const sub = subPartes.map(Utils.escapeHtml).join(" · ");

    const filas = [];
    if (c.registrado_por) filas.push(["Registrado por", Utils.escapeHtml(c.registrado_por)]);
    if (c.fecha_vencimiento) filas.push(["Vencimiento", Utils.escapeHtml(Utils.fechaLarga(c.fecha_vencimiento))]);

    const tieneDetalle = filas.length > 0;
    const detalle = tieneDetalle
      ? `<div class="card-detail" hidden>${filas.map(([label, val]) => `<div class="card-detail-label">${label}</div><div>${val}</div>`).join("")}</div>`
      : "";

    const checked = selectedIds.has(c.id) ? " checked" : "";

    return `
      <div class="card${tieneDetalle ? " card-clickable" : ""}">
        <div class="card-row">
          <label class="card-check">
            <input type="checkbox" class="cc-check" data-id="${Utils.escapeHtml(c.id)}"${checked}>
          </label>
          <div class="card-main">
            <div class="card-title">${Utils.escapeHtml(c.proveedor || "Sin proveedor")}</div>
            <div class="card-sub">${sub}${tieneDetalle ? ' <span class="card-info-icon">ⓘ</span>' : ""}</div>
          </div>
          <div class="card-meta">
            <span class="card-hora">${Utils.formatMonto(c.monto)}</span>
            ${badgeDias(c.dias_desde)}
            ${badgeVencido(c)}
          </div>
        </div>
        ${detalle}
        <div class="card-asignar card-marcar-pagado">
          <select class="select-unidad select-origen-pago">
            <option value="">Elegir caja…</option>
            <option value="Caja GV">Caja GV</option>
            <option value="Caja GO">Caja GO</option>
          </select>
          <button type="button" class="btn-asignar btn-marcar-pagado" data-id="${Utils.escapeHtml(c.id)}">Marcar como pagado</button>
        </div>
      </div>`;
  }

  function renderContent(data) {
    ultimaData = data;
    const itemsTodos = data.comprobantes || [];
    const proveedores = Array.from(new Set(itemsTodos.map(c => c.proveedor).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
    let items = proveedorFiltro ? itemsTodos.filter(c => c.proveedor === proveedorFiltro) : itemsTodos;
    if (estadoFiltro === "vencidas") items = items.filter(esVencido);
    else if (estadoFiltro === "no_vencidas") items = items.filter(c => !esVencido(c));

    const sinResultadosMsg = [
      proveedorFiltro ? "para este proveedor" : "",
      estadoFiltro === "vencidas" ? "vencidas" : estadoFiltro === "no_vencidas" ? "no vencidas" : ""
    ].filter(Boolean).join(" ");
    const contenido = items.length
      ? items.map(cardComprobante).join("")
      : `<div class="empty-msg">Sin pagos pendientes en cuenta corriente en este período${sinResultadosMsg ? " " + sinResultadosMsg : ""}.</div>`;

    const seleccionActiva = itemsTodos.filter(c => selectedIds.has(c.id));
    const totalSeleccionado = seleccionActiva.reduce((sum, c) => sum + (c.monto || 0), 0);
    const bulkBar = seleccionActiva.length
      ? `
      <div class="card">
        <div class="card-title">${seleccionActiva.length} comprobante${seleccionActiva.length === 1 ? "" : "s"} seleccionado${seleccionActiva.length === 1 ? "" : "s"} · ${Utils.formatMonto(totalSeleccionado)}</div>
        <div class="card-asignar card-marcar-pagado">
          <select class="select-unidad select-origen-pago" id="cc-bulk-origen">
            <option value="">Elegir caja…</option>
            <option value="Caja GV">Caja GV</option>
            <option value="Caja GO">Caja GO</option>
          </select>
          <button type="button" class="btn-asignar" id="cc-btn-pagar-seleccionados">Pagar seleccionados</button>
        </div>
      </div>`
      : "";

    elContent().innerHTML = `
      <div class="horas-periodo">
        Período: <strong>${Utils.fechaLarga(data.desde)}</strong> → <strong>${Utils.fechaLarga(data.hasta)}</strong>
        <button type="button" id="cc-btn-rango" class="btn-link">Cambiar rango</button>
        <button type="button" id="cc-btn-proveedor" class="btn-link">Proveedor${proveedorFiltro ? `: ${Utils.escapeHtml(proveedorFiltro)}` : ""}</button>
        <button type="button" id="cc-btn-estado" class="btn-link">Estado${estadoFiltro ? `: ${estadoFiltro === "vencidas" ? "Vencidas" : "No vencidas"}` : ""}</button>
      </div>
      <div id="cc-rango-form" class="card-walkin-form" hidden>
        <input type="date" id="cc-input-desde" class="input-fecha" value="${data.desde}">
        <span>a</span>
        <input type="date" id="cc-input-hasta" class="input-fecha" value="${data.hasta}">
        <button type="button" id="cc-btn-aplicar" class="btn-walkin-confirmar">Aplicar</button>
        ${rangoOverride ? `<button type="button" id="cc-btn-reset" class="btn-link">Por defecto</button>` : ""}
      </div>
      <div id="cc-proveedor-form" class="card-walkin-form" hidden>
        <select id="cc-select-proveedor" class="select-unidad">
          <option value="">Todos los proveedores</option>
          ${proveedores.map(p => `<option value="${Utils.escapeHtml(p)}"${p === proveedorFiltro ? " selected" : ""}>${Utils.escapeHtml(p)}</option>`).join("")}
        </select>
        ${proveedorFiltro ? `<button type="button" id="cc-btn-proveedor-reset" class="btn-link">Quitar filtro</button>` : ""}
      </div>
      <div id="cc-estado-form" class="card-walkin-form" hidden>
        <select id="cc-select-estado" class="select-unidad">
          <option value="">Todas</option>
          <option value="vencidas"${estadoFiltro === "vencidas" ? " selected" : ""}>Vencidas</option>
          <option value="no_vencidas"${estadoFiltro === "no_vencidas" ? " selected" : ""}>No vencidas</option>
        </select>
        ${estadoFiltro ? `<button type="button" id="cc-btn-estado-reset" class="btn-link">Quitar filtro</button>` : ""}
      </div>

      <div class="section-title">Total pendiente: ${Utils.formatMonto(data.total_pendiente)}</div>
      ${bulkBar}
      ${contenido}
    `;
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    try {
      const data = await Api.cuentaCorriente(rangoOverride);
      elEstado().textContent = "";
      renderContent(data);
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
