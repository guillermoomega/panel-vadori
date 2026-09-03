const ViewLimpieza = (() => {
  const elEstado = () => document.getElementById("limpieza-estado");
  const elGrid = () => document.getElementById("limpieza-grid");

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
      </div>`;
  }

  async function render() {
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
