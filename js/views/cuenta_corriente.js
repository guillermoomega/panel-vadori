const ViewCuentaCorriente = (() => {
  const elEstado = () => document.getElementById("cuenta-corriente-estado");
  const elContent = () => document.getElementById("cuenta-corriente-content");

  let rangoOverride = null; // { desde, hasta } en YYYY-MM-DD, o null = rango por defecto del backend
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
      const btnMarcar = ev.target.closest(".btn-marcar-pagado");
      if (btnMarcar) {
        await handleMarcarPagado(btnMarcar);
        return;
      }
      const card = ev.target.closest(".card-clickable");
      if (card && !ev.target.closest(".card-marcar-pagado")) {
        const detalle = card.querySelector(".card-detail");
        if (detalle) detalle.hidden = !detalle.hidden;
      }
    });
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

  function badgeDias(dias) {
    if (dias === null || dias === undefined) return "";
    let clase = "badge-neutral";
    if (dias >= 30) clase = "badge-bad";
    else if (dias >= 14) clase = "badge-warn";
    return `<span class="badge ${clase}">${dias} día${dias === 1 ? "" : "s"}</span>`;
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

    return `
      <div class="card${tieneDetalle ? " card-clickable" : ""}">
        <div class="card-row">
          <div class="card-main">
            <div class="card-title">${Utils.escapeHtml(c.proveedor || "Sin proveedor")}</div>
            <div class="card-sub">${sub}${tieneDetalle ? ' <span class="card-info-icon">ⓘ</span>' : ""}</div>
          </div>
          <div class="card-meta">
            <span class="card-hora">${Utils.formatMonto(c.monto)}</span>
            ${badgeDias(c.dias_desde)}
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
    const items = data.comprobantes || [];
    const contenido = items.length
      ? items.map(cardComprobante).join("")
      : `<div class="empty-msg">Sin pagos pendientes en cuenta corriente en este período.</div>`;

    elContent().innerHTML = `
      <div class="horas-periodo">
        Período: <strong>${Utils.fechaLarga(data.desde)}</strong> → <strong>${Utils.fechaLarga(data.hasta)}</strong>
        <button type="button" id="cc-btn-rango" class="btn-link">Cambiar rango</button>
      </div>
      <div id="cc-rango-form" class="card-walkin-form" hidden>
        <input type="date" id="cc-input-desde" class="input-fecha" value="${data.desde}">
        <span>a</span>
        <input type="date" id="cc-input-hasta" class="input-fecha" value="${data.hasta}">
        <button type="button" id="cc-btn-aplicar" class="btn-walkin-confirmar">Aplicar</button>
        ${rangoOverride ? `<button type="button" id="cc-btn-reset" class="btn-link">Por defecto</button>` : ""}
      </div>

      <div class="section-title">Total pendiente: ${Utils.formatMonto(data.total_pendiente)}</div>
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
