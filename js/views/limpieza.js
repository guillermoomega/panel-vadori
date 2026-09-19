const ViewLimpieza = (() => {
  const elEstado = () => document.getElementById("limpieza-estado");
  const elGrid = () => document.getElementById("limpieza-grid");

  const ESTADOS = ["Lista", "ocupada", "desocupada", "fuera de servicio"];
  let listenersAttached = false;

  function textoEstado(u) {
    if (u.estado === "ocupada" && u.huesped) return u.huesped;
    return u.estado || "\u2014";
  }

  function cardUnidad(u) {
    return `
      <div class="unidad-card ${Utils.claseCardLimpieza(u.estado)}">
        <div>
          <div class="unidad-nombre">${Utils.escapeHtml(u.nombre || "\u2014")}</div>
          <div class="unidad-tipo">${Utils.escapeHtml(u.tipo || "")}</div>
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
      const data = await Api.limpieza();
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
