const ViewHoy = (() => {
  const elEstado = () => document.getElementById("hoy-estado");
  const elContent = () => document.getElementById("hoy-content");

  function cardReserva(r) {
    const estado = Utils.estadoReservaSuite(r);
    const unidad = r.sin_asignar ? "sin asignar" : (r.unidad || "—");
    return `
      <div class="card">
        <div class="card-main">
          <div class="card-title">${Utils.escapeHtml(r.huesped || "Sin nombre")}</div>
          <div class="card-sub">${Utils.escapeHtml(unidad)}${r.adultos ? ` · ${r.adultos} ad.` : ""}</div>
        </div>
        <div class="card-meta">
          <span class="badge ${Utils.badgeClaseReserva(estado)}">${Utils.escapeHtml(estado || "—")}</span>
        </div>
      </div>`;
  }

  function cardMesa(m) {
    return `
      <div class="card">
        <div class="card-main">
          <div class="card-title">${Utils.escapeHtml(m.nombre || "Sin nombre")}</div>
          <div class="card-sub">${m.personas ?? "?"} pers.${m.ninios ? ` (${m.ninios} niños)` : ""}${m.notas ? ` · ${Utils.escapeHtml(m.notas)}` : ""}</div>
        </div>
        <div class="card-meta">
          <div class="card-hora">${Utils.escapeHtml(m.hora || "")}</div>
          <span class="badge ${Utils.badgeClaseReserva(m.estado)}">${Utils.escapeHtml(m.estado || "—")}</span>
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
