const ViewHoras = (() => {
  const elEstado = () => document.getElementById("horas-estado");
  const elContent = () => document.getElementById("horas-content");

  let rangoOverride = null; // { desde, hasta } en YYYY-MM-DD, o null = rango por defecto del backend
  let listenersAttached = false;

  function formatFechaHora(iso) {
    const d = new Date(iso);
    const fecha = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });
    const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
    return `${fecha} ${hora}`;
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    elContent().addEventListener("click", (ev) => {
      const btnToggle = ev.target.closest("#horas-btn-rango");
      if (btnToggle) {
        const form = document.getElementById("horas-rango-form");
        form.hidden = !form.hidden;
        return;
      }
      const btnAplicar = ev.target.closest("#horas-btn-aplicar");
      if (btnAplicar) {
        const desde = document.getElementById("horas-input-desde").value;
        const hasta = document.getElementById("horas-input-hasta").value;
        if (!desde || !hasta) return;
        rangoOverride = { desde, hasta };
        render();
        return;
      }
      const btnReset = ev.target.closest("#horas-btn-reset");
      if (btnReset) {
        rangoOverride = null;
        render();
      }
    });
  }

  function cardPersona(p) {
    const montoTxt = p.sin_tarifa
      ? `<span class="badge badge-warn">Sin tarifa</span>`
      : `<span class="card-hora">${Utils.formatMonto(p.monto)}</span>`;
    return `
      <div class="card card-row">
        <div class="card-main">
          <div class="card-title">${Utils.escapeHtml(p.nombre)}</div>
          <div class="card-sub">${p.horas_texto}</div>
        </div>
        <div class="card-meta">${montoTxt}</div>
      </div>`;
  }

  function filaSinResolver(w) {
    const tipoTxt = w.tipo === "Entrada" ? "entrada sin salida" : "salida sin entrada";
    return `
      <div class="mesa-row">
        <div class="mesa-row-info">
          <div>${Utils.escapeHtml(w.nombre)} — ${tipoTxt}</div>
          <div class="mesa-row-sub">${formatFechaHora(w.timestamp)}</div>
        </div>
      </div>`;
  }

  function renderContent(data) {
    const desdeStr = data.desde.slice(0, 10);
    const hastaStr = data.hasta.slice(0, 10);

    const personasHtml = data.personas.length
      ? data.personas.map(cardPersona).join("")
      : `<div class="empty-msg">Sin fichajes registrados en este período.</div>`;

    const totalTxt = data.personas.length ? Utils.formatMonto(data.total_monto) : "—";

    const sinResolverHtml = data.sin_resolver.length
      ? `
        <div class="section-title">Sin resolver</div>
        <div class="card">
          ${data.sin_resolver.map(filaSinResolver).join("")}
        </div>`
      : "";

    elContent().innerHTML = `
      <div class="horas-periodo">
        Período: <strong>${formatFechaHora(data.desde)}</strong> → <strong>${formatFechaHora(data.hasta)}</strong>
        <button type="button" id="horas-btn-rango" class="btn-link">Cambiar rango</button>
      </div>
      <div id="horas-rango-form" class="card-walkin-form" hidden>
        <input type="date" id="horas-input-desde" class="input-fecha" value="${desdeStr}">
        <span>a</span>
        <input type="date" id="horas-input-hasta" class="input-fecha" value="${hastaStr}">
        <button type="button" id="horas-btn-aplicar" class="btn-walkin-confirmar">Aplicar</button>
        ${rangoOverride ? `<button type="button" id="horas-btn-reset" class="btn-link">Por defecto</button>` : ""}
      </div>

      <div class="section-title">Horas por persona</div>
      ${personasHtml}
      <div class="card card-row">
        <div class="card-main">
          <div class="card-title">Total</div>
        </div>
        <div class="card-meta"><span class="card-hora">${totalTxt}</span></div>
      </div>

      ${sinResolverHtml}
    `;
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    try {
      const data = await Api.horas(rangoOverride);
      elEstado().textContent = "";
      renderContent(data);
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
