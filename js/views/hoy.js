const ViewHoy = (() => {
  const elEstado = () => document.getElementById("hoy-estado");
  const elContent = () => document.getElementById("hoy-content");

  function cardReserva(r) {
    const estado = Utils.estadoReservaSuite(r);
    const unidad = r.sin_asignar ? "sin asignar" : (r.unidad || "—");
    const subPartes = [unidad];
    if (r.tipo_unidad) subPartes.push(r.tipo_unidad);
    if (r.adultos) subPartes.push(`${r.adultos} ad.`);
    if (r.paquete) subPartes.push(r.paquete);
    const sub = subPartes.map(Utils.escapeHtml).join(" · ");

    const tieneObs = !!(r.observaciones && r.observaciones.trim());
    const detalle = tieneObs
      ? `<div class="card-detail" hidden><div class="card-detail-label">Observaciones</div><div>${Utils.escapeHtml(r.observaciones)}</div></div>`
      : "";

    return `
      <div class="card${tieneObs ? " card-clickable" : ""}"${tieneObs ? ' onclick="this.querySelector(\'.card-detail\').hidden = !this.querySelector(\'.card-detail\').hidden"' : ""}>
        <div class="card-row">
          <div class="card-main">
            <div class="card-title">${Utils.escapeHtml(r.huesped || "Sin nombre")}${tieneObs ? ' <span class="card-info-icon">ⓘ</span>' : ""}</div>
            <div class="card-sub">${sub}</div>
          </div>
          <div class="card-meta">
            <span class="badge ${Utils.badgeClaseReserva(estado)}">${Utils.escapeHtml(estado || "—")}</span>
          </div>
        </div>
        ${detalle}
      </div>`;
  }

  function cardMesa(m) {
    return `
      <div class="card">
        <div class="card-row">
          <div class="card-main">
            <div class="card-title">${Utils.escapeHtml(m.nombre || "Sin nombre")}</div>
            <div class="card-sub">${m.personas ?? "?"} pers.${m.ninios ? ` (${m.ninios} niños)` : ""}${m.notas ? ` · ${Utils.escapeHtml(m.notas)}` : ""}</div>
          </div>
          <div class="card-meta">
            <div class="card-hora">${Utils.escapeHtml(m.hora || "")}</div>
            <span class="badge ${Utils.badgeClaseReserva(m.estado)}">${Utils.escapeHtml(m.estado || "—")}</span>
          </div>
        </div>
      </div>`;
  }

  function seccion(titulo, items, renderCard, vacioMsg) {
    if (!items.length) {
      return `<div class="section-title">${titulo}</div><div class="empty-msg">${vacioMsg}</div>`;
    }
    return `<div class="section-title">${titulo}</div>${items.map(renderCard).join("")}`;
  }

  async function render() {
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    elContent().innerHTML = "";
    try {
      const data = await Api.hoy();
      elEstado().textContent = "";
      elContent().innerHTML =
        seccion("Check-ins de hoy", data.checkins, cardReserva, "Sin check-ins hoy.") +
        seccion("Check-outs de hoy", data.checkouts, cardReserva, "Sin check-outs hoy.") +
        seccion("Mesas de hoy", data.mesas_hoy, cardMesa, "Sin reservas de mesa hoy.");
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
