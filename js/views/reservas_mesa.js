const ViewReservasMesa = (() => {
  const elEstado = () => document.getElementById("reservas-mesa-estado");
  const elContent = () => document.getElementById("reservas-mesa-content");

  let listenersAttached = false;
  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    elContent().addEventListener("click", (ev) => {
      const card = ev.target.closest(".card-clickable");
      if (!card) return;
      const detalle = card.querySelector(".card-detail");
      if (!detalle) return;
      detalle.hidden = !detalle.hidden;
    });
  }

  function agruparPorDia(mesas) {
    const porFecha = new Map();
    for (const m of mesas) {
      if (m.estado === "Cancelada") continue;
      const fecha = m.fecha;
      if (!porFecha.has(fecha)) porFecha.set(fecha, { fecha, personas: 0, ninios: 0, mesas: [] });
      const d = porFecha.get(fecha);
      d.personas += Number(m.personas) || 0;
      d.ninios += Number(m.ninios) || 0;
      d.mesas.push(m);
    }
    return Array.from(porFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  function totalPersonasDias(dias) {
    return dias.reduce((acc, d) => ({
      personas: acc.personas + d.personas,
      ninios: acc.ninios + d.ninios
    }), { personas: 0, ninios: 0 });
  }

  function tituloReservas(base, dias) {
    if (!dias.length) return base;
    const { personas, ninios } = totalPersonasDias(dias);
    return `${base} · ${personas} pers.${ninios ? ` · ${ninios} niños` : ""}`;
  }

  function filaReservaDetalle(m) {
    const partes = [`${m.personas ?? "?"} ad.`];
    if (m.ninios) partes.push(`${m.ninios} niños`);
    partes.push(`Tel: ${m.telefono || "—"}`);
    partes.push(`Seña: ${Utils.formatMonto(m.monto_sena || 0)}`);
    const sub = partes.map(Utils.escapeHtml).join(" · ");

    return `
      <div class="mesa-row">
        <div class="mesa-row-info">
          <div>${Utils.escapeHtml(m.hora || "—")} — ${Utils.escapeHtml(m.nombre || "Sin nombre")}</div>
          <div class="mesa-row-sub">${sub}</div>
        </div>
      </div>`;
  }

  function cardDia(d) {
    const reservas = [...d.mesas].sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
    const detalle = `<div class="card-detail" hidden>${reservas.map(filaReservaDetalle).join("")}</div>`;

    return `
      <div class="card card-clickable">
        <div class="card-row">
          <div class="card-main">
            <div class="card-title">${Utils.escapeHtml(Utils.fechaAbrev(d.fecha))} <span class="card-info-icon">ⓘ</span></div>
          </div>
          <div class="card-meta">
            <div class="card-hora">${d.personas} pers.${d.ninios ? ` · ${d.ninios} niños` : ""}</div>
          </div>
        </div>
        ${detalle}
      </div>`;
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    elContent().innerHTML = "";
    try {
      const hoy = Utils.todayISO();
      const horizonte = Utils.addDays(hoy, 29); // ventana de 30 días desde hoy
      const rango = await Api.ocupacion(hoy, horizonte);
      const mesasFuturas = (rango.mesas || []).filter(m => m.fecha >= hoy);
      const dias = agruparPorDia(mesasFuturas);

      elEstado().textContent = "";
      elContent().innerHTML = dias.length
        ? `<div class="section-title">${tituloReservas("Próximas reservas de mesa", dias)}</div>${dias.map(cardDia).join("")}`
        : `<div class="section-title">Próximas reservas de mesa</div><div class="empty-msg">Sin reservas de mesa próximas.</div>`;
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
