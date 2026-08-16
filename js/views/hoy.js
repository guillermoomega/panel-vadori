const ViewHoy = (() => {
  const elEstado = () => document.getElementById("hoy-estado");
  const elContent = () => document.getElementById("hoy-content");

  const turnosHoyAbiertos = new Set();

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
      if (!detalle) return;
      detalle.hidden = !detalle.hidden;
      const hora = card.dataset.hora;
      if (hora) {
        if (detalle.hidden) turnosHoyAbiertos.delete(hora);
        else turnosHoyAbiertos.add(hora);
      }
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

  function filaMesaHoy(m) {
    const partes = [`${m.personas ?? "?"} ad.`];
    if (m.ninios) partes.push(`${m.ninios} niños`);
    if (m.notas && m.notas.trim()) partes.push(m.notas);
    const sub = partes.map(Utils.escapeHtml).join(" · ");

    return `
      <div class="mesa-row">
        <div class="mesa-row-info">
          <div>${Utils.escapeHtml(m.nombre || "Sin nombre")}</div>
          <div class="mesa-row-sub">${sub}</div>
        </div>
        <button type="button" class="btn-recibir" data-reserva-id="${Utils.escapeHtml(m.id)}" title="Marcar como recibida">✓</button>
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

  function cardTurnoHoy(t) {
    const pendientes = t.reservas.filter(r => r.estado !== "Recibida");
    const filas = pendientes.length
      ? pendientes.map(filaMesaHoy).join("")
      : `<div class="empty-msg">Todas recibidas.</div>`;
    const abierto = turnosHoyAbiertos.has(t.hora);

    return `
      <div class="card card-clickable" data-hora="${Utils.escapeHtml(t.hora)}">
        <div class="card-row">
          <div class="card-main">
            <div class="card-title">${Utils.escapeHtml(t.hora)} <span class="card-info-icon">ⓘ</span></div>
          </div>
          <div class="card-meta">
            <div class="card-hora">${t.personas} pers.${t.ninios ? ` · ${t.ninios} niños` : ""}</div>
          </div>
        </div>
        <div class="card-detail"${abierto ? "" : " hidden"}>${filas}</div>
      </div>`;
  }

  function totalPersonasTurnos(turnos) {
    return turnos.reduce((acc, t) => ({
      personas: acc.personas + t.personas,
      ninios: acc.ninios + t.ninios
    }), { personas: 0, ninios: 0 });
  }

  function tituloMesas(base, turnos) {
    if (!turnos.length) return base;
    const { personas, ninios } = totalPersonasTurnos(turnos);
    return `${base} · ${personas} pers.${ninios ? ` · ${ninios} niños` : ""}`;
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
      const turnosHoy = agruparPorTurno(data.mesas_hoy);
      const turnosManana = agruparPorTurno(mesasManana);
      const turnosPasado = agruparPorTurno(mesasPasado);

      elEstado().textContent = "";
      elContent().innerHTML =
        seccion("Check-ins de hoy", data.checkins, r => cardReserva(r, unidades), "Sin check-ins hoy.") +
        seccion("Check-outs de hoy", data.checkouts, r => cardReserva(r, unidades), "Sin check-outs hoy.") +
        seccion(tituloMesas("Mesas de hoy", turnosHoy), turnosHoy, cardTurnoHoy, "Sin reservas de mesa hoy.") +
        seccion(tituloMesas("Mesas de mañana", turnosManana), turnosManana, cardTurno, "Sin reservas de mesa mañana.") +
        seccion(tituloMesas("Mesas de pasado mañana", turnosPasado), turnosPasado, cardTurno, "Sin reservas de mesa pasado mañana.");
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
