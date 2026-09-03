const ViewCheckins = (() => {
  const elEstado = () => document.getElementById("checkins-estado");
  const elContent = () => document.getElementById("checkins-content");

  let rangoModo = "semana"; // 'semana' | 'mes' | 'personalizado'
  let diasPersonalizado = 14;
  let listenersAttached = false;

  function calcularRango(modo, dias) {
    const desde = Utils.todayISO();
    const n = modo === "semana" ? 7 : modo === "mes" ? 30 : dias;
    const hasta = Utils.addDays(desde, n - 1);
    return { desde, hasta };
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    elContent().addEventListener("click", async (ev) => {
      const btnRango = ev.target.closest(".rango-tab");
      if (btnRango) {
        const modo = btnRango.dataset.modo;
        if (modo === "personalizado") {
          const form = document.getElementById("checkins-personalizado-form");
          form.hidden = !form.hidden;
          if (!form.hidden) form.querySelector(".input-adultos").focus();
          return;
        }
        rangoModo = modo;
        render();
        return;
      }
      const btnAplicar = ev.target.closest("#checkins-btn-aplicar");
      if (btnAplicar) {
        const input = document.getElementById("checkins-input-dias");
        const dias = parseInt(input.value) || 0;
        if (dias <= 0) {
          input.focus();
          return;
        }
        diasPersonalizado = dias;
        rangoModo = "personalizado";
        render();
        return;
      }
      const btnAsignar = ev.target.closest(".btn-asignar");
      if (btnAsignar) {
        await handleAsignar(btnAsignar);
        return;
      }
      if (ev.target.closest(".card-walkin-form") || ev.target.closest(".card-asignar")) return;
      const card = ev.target.closest(".card-clickable");
      if (!card) return;
      const detalle = card.querySelector(".card-detail");
      if (!detalle) return;
      detalle.hidden = !detalle.hidden;
    });
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

  function cardCheckin(r, unidades = []) {
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

  function agruparPorDia(reservas) {
    const porDia = new Map();
    for (const r of reservas) {
      if (!porDia.has(r.checkin)) porDia.set(r.checkin, []);
      porDia.get(r.checkin).push(r);
    }
    return Array.from(porDia.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  function toolbarRango() {
    return `
      <div class="rango-tabs">
        <button type="button" class="rango-tab${rangoModo === "semana" ? " active" : ""}" data-modo="semana">Semana</button>
        <button type="button" class="rango-tab${rangoModo === "mes" ? " active" : ""}" data-modo="mes">Mes</button>
        <button type="button" class="rango-tab${rangoModo === "personalizado" ? " active" : ""}" data-modo="personalizado">Personalizado</button>
      </div>
      <div id="checkins-personalizado-form" class="card-walkin-form" hidden>
        <input type="number" class="input-adultos" id="checkins-input-dias" inputmode="numeric" min="1" value="${diasPersonalizado}" placeholder="Días">
        <button type="button" id="checkins-btn-aplicar" class="btn-walkin-confirmar">Aplicar</button>
      </div>`;
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    try {
      const { desde, hasta } = calcularRango(rangoModo, diasPersonalizado);
      const [data, limpieza] = await Promise.all([Api.ocupacion(desde, hasta), Api.limpieza()]);
      const unidades = limpieza.unidades || [];
      const checkins = (data.suites || [])
        .filter(r => r.checkin >= desde && r.checkin <= hasta)
        .sort((a, b) => a.checkin.localeCompare(b.checkin) || (a.huesped || "").localeCompare(b.huesped || ""));

      const grupos = agruparPorDia(checkins);
      const contenido = grupos.length
        ? grupos.map(([fecha, items]) =>
            `<div class="section-title">${Utils.escapeHtml(Utils.fechaLarga(fecha))}</div>${items.map(r => cardCheckin(r, unidades)).join("")}`
          ).join("")
        : `<div class="empty-msg">Sin check-ins en este período.</div>`;

      elEstado().textContent = "";
      elContent().innerHTML = toolbarRango() + contenido;
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
