const ViewHoy = (() => {
  const elEstado = () => document.getElementById("hoy-estado");
  const elContent = () => document.getElementById("hoy-content");

  let listenersAttached = false;
  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    elContent().addEventListener("click", async (ev) => {
      const btnAsignar = ev.target.closest(".btn-asignar");
      if (btnAsignar) {
        await handleAsignar(btnAsignar);
        return;
      }
      const btnRecibir = ev.target.closest(".btn-recibir");
      if (btnRecibir) {
        await handleRecibir(btnRecibir);
        return;
      }
      if (ev.target.closest(".card-asignar")) return;
      const card = ev.target.closest(".card-clickable");
      if (!card) return;
      const detalle = card.querySelector(".card-detail");
      if (detalle) detalle.hidden = !detalle.hidden;
    });
  }

  async function handleRecibir(btn) {
    const reservaId = btn.dataset.reservaId;
    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = "…";
    try {
      const res = await Api.recibirMesa(reservaId);
      if (!res.ok) throw new Error(res.error || "No se pudo marcar la reserva como recibida.");
      await render();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = textoOriginal;
      alert(err.message);
    }
  }

  async function handleAsignar(btn) {
    const reservaId = btn.dataset.reservaId;
    const wrapper = btn.closest(".card-asignar");
    const select = wrapper.querySelector(".select-unidad");
    const unidadId = select.value;
    if (!unidadId) {
      select.focus();
      return;
    }
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    select.disabled = true;
    btn.textContent = "Asignando…";
    try {
      const res = await Api.asignar(reservaId, unidadId);
      if (!res.ok) throw new Error(res.error || "No se pudo asignar la unidad.");
      await render();
    } catch (err) {
      btn.disabled = false;
      select.disabled = false;
      btn.textContent = textoOriginal;
      alert(err.message);
    }
  }

  function cardReserva(r, unidades = []) {
    const estado = Utils.estadoReservaSuite(r);
    const unidad = r.sin_asignar ? "sin asignar" : (r.unidad || "—");
    const subPartes = [unidad];
    if (r.tipo_unidad) subPartes.push(r.tipo_unidad);
    if (r.adultos) subPartes.push(`${r.adultos} ad.`);
    if (r.paquete) subPartes.push(r.paquete);
    const sub = subPartes.map(Utils.escapeHtml).join(" · ");

    const filas = [];
    if (r.tipo_unidad) filas.push(["Tipo de unidad", Utils.escapeHtml(r.tipo_unidad)]);
    if (r.paquete) filas.push(["Paquete", Utils.escapeHtml(r.paquete)]);
    if (r.costo !== null && r.costo !== undefined) filas.push(["Costo", Utils.escapeHtml(Utils.formatMonto(r.costo))]);
    if (r.monto_sena) filas.push(["Seña", Utils.escapeHtml(Utils.formatMonto(r.monto_sena))]);
    if (r.tipo_cama) filas.push(["Tipo de cama", Utils.escapeHtml(r.tipo_cama)]);
    if (r.observaciones && r.observaciones.trim()) filas.push(["Observaciones", Utils.escapeHtml(r.observaciones)]);

    const tieneDetalle = filas.length > 0;
    const detalle = tieneDetalle
      ? `<div class="card-detail" hidden>${filas.map(([label, val]) => `<div class="card-detail-label">${label}</div><div>${val}</div>`).join("")}</div>`
      : "";

    const asignar = r.sin_asignar
      ? `<div class="card-asignar">
          <select class="select-unidad">
            <option value="">Elegir unidad…</option>
            ${unidades.map(u => `<option value="${Utils.escapeHtml(u.id)}">${Utils.escapeHtml(u.nombre)}${u.estado && u.estado !== "Lista" ? " · " + Utils.escapeHtml(u.estado) : ""}</option>`).join("")}
          </select>
          <button type="button" class="btn-asignar" data-reserva-id="${Utils.escapeHtml(r.id)}">Asignar</button>
        </div>`
      : "";

    return `
      <div class="card${tieneDetalle ? " card-clickable" : ""}">
        <div class="card-row">
          <div class="card-main">
            <div class="card-title">${Utils.escapeHtml(r.huesped || "Sin nombre")}${tieneDetalle ? ' <span class="card-info-icon">ⓘ</span>' : ""}</div>
            <div class="card-sub">${sub}</div>
          </div>
          <div class="card-meta">
            <span class="badge ${Utils.badgeClaseReserva(estado)}">${Utils.escapeHtml(estado || "—")}</span>
          </div>
        </div>
        ${detalle}
        ${asignar}
      </div>`;
  }

  function cardMesaHoy(m) {
    const subPartes = [`${m.personas ?? "?"} ad.`];
    if (m.ninios) subPartes.push(`${m.ninios} niños`);
    const sub = subPartes.map(Utils.escapeHtml).join(" · ");
    const puedeRecibir = m.estado !== "Recibida" && m.estado !== "Cancelada";

    const detalle = m.notas && m.notas.trim()
      ? `<div class="card-detail"><div class="card-detail-label">Observaciones</div><div>${Utils.escapeHtml(m.notas)}</div></div>`
      : "";

    const recibir = puedeRecibir
      ? `<button type="button" class="btn-recibir" data-reserva-id="${Utils.escapeHtml(m.id)}" title="Marcar como recibida">✓</button>`
      : "";

    return `
      <div class="card">
        <div class="card-row">
          <div class="card-main">
            <div class="card-title">${Utils.escapeHtml(m.hora || "Sin hora")} — ${Utils.escapeHtml(m.nombre || "Sin nombre")}</div>
            <div class="card-sub">${sub}</div>
          </div>
          <div class="card-meta card-meta-mesa">
            <span class="badge ${Utils.badgeClaseReserva(m.estado)}">${Utils.escapeHtml(m.estado || "—")}</span>
            ${recibir}
          </div>
        </div>
        ${detalle}
      </div>`;
  }

  function agruparPorTurno(mesas) {
    const porHora = new Map();
    for (const m of mesas) {
      if (m.estado === "Cancelada") continue;
      const hora = m.hora || "Sin hora";
      if (!porHora.has(hora)) porHora.set(hora, { hora, personas: 0, ninios: 0, reservas: [] });
      const t = porHora.get(hora);
      t.personas += Number(m.personas) || 0;
      t.ninios += Number(m.ninios) || 0;
      t.reservas.push(m);
    }
    return Array.from(porHora.values()).sort((a, b) => a.hora.localeCompare(b.hora));
  }

  function cardTurno(t) {
    const detalle = `<div class="card-detail" hidden>${t.reservas.map(r =>
      `<div>${Utils.escapeHtml(r.nombre || "Sin nombre")} — ${r.personas ?? "?"} ad.${r.ninios ? ` · ${r.ninios} niños` : ""}</div>`
    ).join("")}</div>`;

    return `
      <div class="card card-clickable">
        <div class="card-row">
          <div class="card-main">
            <div class="card-title">${Utils.escapeHtml(t.hora)} <span class="card-info-icon">ⓘ</span></div>
          </div>
          <div class="card-meta">
            <div class="card-hora">${t.personas} pers.${t.ninios ? ` · ${t.ninios} niños` : ""}</div>
          </div>
        </div>
        ${detalle}
      </div>`;
  }

  function seccion(titulo, items, renderCard, vacioMsg) {
    if (!items.length) {
      return `<div class="section-title">${titulo}</div><div class="empty-msg">${vacioMsg}</div>`;
    }
    return `<div class="section-title">${titulo}</div>${items.map(renderCard).join("")}`;
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    elContent().innerHTML = "";
    try {
      const manana = Utils.addDays(Utils.todayISO(), 1);
      const pasado = Utils.addDays(Utils.todayISO(), 2);
      const [data, limpieza, rango] = await Promise.all([Api.hoy(), Api.limpieza(), Api.ocupacion(manana, pasado)]);
      const unidades = limpieza.unidades || [];
      const mesasManana = (rango.mesas || []).filter(m => m.fecha === manana);
      const mesasPasado = (rango.mesas || []).filter(m => m.fecha === pasado);
      const mesasHoyPendientes = (data.mesas_hoy || [])
        .filter(m => m.estado !== "Cancelada" && m.estado !== "Recibida")
        .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

      elEstado().textContent = "";
      elContent().innerHTML =
        seccion("Check-ins de hoy", data.checkins, r => cardReserva(r, unidades), "Sin check-ins hoy.") +
        seccion("Check-outs de hoy", data.checkouts, r => cardReserva(r, unidades), "Sin check-outs hoy.") +
        seccion("Mesas de hoy", mesasHoyPendientes, cardMesaHoy, "Sin reservas de mesa pendientes de recibir hoy.") +
        seccion("Mesas de mañana", agruparPorTurno(mesasManana), cardTurno, "Sin reservas de mesa mañana.") +
        seccion("Mesas de pasado mañana", agruparPorTurno(mesasPasado), cardTurno, "Sin reservas de mesa pasado mañana.");
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
