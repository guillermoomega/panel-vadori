const ViewLimpieza = (() => {
  const elEstado = () => document.getElementById("limpieza-estado");
  const elGrid = () => document.getElementById("limpieza-grid");

  const ESTADOS = ["Lista", "ocupada", "desocupada", "fuera de servicio"];
  let listenersAttached = false;
  let reservasHoy = {}; // unidad_id -> { enCurso, llega, sale } (nombres), armado con las reservas activas asignadas

  const hoyARG = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Mismas reservas que el listado de Suites → Reservas (no canceladas, salida desde hoy), agrupadas por unidad
  function armarReservasHoy(reservas) {
    const hoy = hoyARG();
    const mapa = {};
    for (const r of reservas) {
      if (!r.unidad_id || !r.checkin || !r.checkout || r.checkin > hoy || r.checkout < hoy) continue;
      const m = mapa[r.unidad_id] || (mapa[r.unidad_id] = {});
      if (r.checkout === hoy) m.sale = r.nombre;
      else if (r.checkin === hoy) m.llega = r.nombre;
      else m.enCurso = r.nombre;
    }
    return mapa;
  }

  function textoEstado(u) {
    const h = reservasHoy[u.id] || {};
    if (u.estado === "ocupada") return h.enCurso || h.llega || u.huesped || u.estado;
    return u.estado || "\u2014";
  }

  function iconoTermo(u) {
    if (u.termo_online === false) {
      return `<span class="unidad-termo" title="Termo sin conexión">❓</span>`;
    }
    if (u.termo_encendido === true) {
      return `<span class="unidad-termo" title="Termo encendido">\u{1F975}</span>`;
    }
    if (u.termo_encendido === false) {
      return `<span class="unidad-termo" title="Termo apagado">\u{1F976}</span>`;
    }
    return "";
  }

  // Movimientos del día según las reservas: quién sale y quién llega hoy a la unidad
  function movimientosHoy(u) {
    const h = reservasHoy[u.id] || {};
    const partes = [];
    if (h.sale) partes.push(`Sale hoy: ${Utils.escapeHtml(h.sale)}`);
    if (h.llega) partes.push(`Llega hoy: ${Utils.escapeHtml(h.llega)}`);
    if (h.enCurso && u.estado !== "ocupada") partes.push(`Reservada: ${Utils.escapeHtml(h.enCurso)}`);
    return partes.length ? `<div class="unidad-mov">${partes.join("<br>")}</div>` : "";
  }

  function cardUnidad(u) {
    return `
      <div class="unidad-card ${Utils.claseCardLimpieza(u.estado)}">
        <div>
          <div class="unidad-nombre">${Utils.escapeHtml(u.nombre || "\u2014")} ${iconoTermo(u)}</div>
          <div class="unidad-tipo">${Utils.escapeHtml(Utils.tipoUnidadLabel(u.tipo) || "")}</div>
          ${movimientosHoy(u)}
        </div>
        <span class="badge ${Utils.badgeClaseLimpieza(u.estado)}">${Utils.escapeHtml(textoEstado(u))}</span>
        <div class="card-estado">
          <select class="select-estado">
            ${ESTADOS.map(e => `<option value="${Utils.escapeHtml(e)}"${e === u.estado ? " selected" : ""}>${Utils.escapeHtml(e)}</option>`).join("")}
          </select>
          <button type="button" class="btn-cambiar-estado" data-unidad-id="${Utils.escapeHtml(u.id)}">Guardar</button>
        </div>
      </div>`;
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    elGrid().addEventListener("click", async (ev) => {
      const btn = ev.target.closest(".btn-cambiar-estado");
      if (!btn) return;
      await handleCambiarEstado(btn);
    });
  }

  async function handleCambiarEstado(btn) {
    const unidadId = btn.dataset.unidadId;
    const select = btn.closest(".card-estado").querySelector(".select-estado");
    const estado = select.value;
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    select.disabled = true;
    btn.textContent = "Guardando\u2026";
    try {
      const res = await Api.cambiarEstadoUnidad(unidadId, estado);
      if (!res.ok) throw new Error(res.error || "No se pudo cambiar el estado.");
      await render();
    } catch (err) {
      btn.disabled = false;
      select.disabled = false;
      btn.textContent = textoOriginal;
      alert(err.message);
    }
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando\u2026";
    elEstado().classList.remove("error");
    elGrid().innerHTML = "";
    try {
      const [data, buscar] = await Promise.all([
        Api.limpieza(),
        Api.buscarReservas("").catch(() => ({ reservas: [] })) // si falla, la grilla se muestra igual sin los movimientos
      ]);
      reservasHoy = armarReservasHoy(buscar.reservas || []);
      elEstado().textContent = "";
      if (!data.unidades.length) {
        elGrid().innerHTML = `<div class="empty-msg">Sin unidades.</div>`;
        return;
      }
      elGrid().innerHTML = data.unidades.map(cardUnidad).join("");
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
