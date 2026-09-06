(() => {
  const views = {
    hoy: { section: document.getElementById("view-hoy"), render: ViewHoy.render, loaded: false },
    calendario: { section: document.getElementById("view-calendario"), render: ViewCalendario.render, loaded: false },
    limpieza: { section: document.getElementById("view-limpieza"), render: ViewLimpieza.render, loaded: false },
    horas: { section: document.getElementById("view-horas"), render: ViewHoras.render, loaded: false },
    checkins: { section: document.getElementById("view-checkins"), render: ViewCheckins.render, loaded: false },
    caja: { section: document.getElementById("view-caja"), render: ViewCaja.render, loaded: false }
  };

  function showView(name) {
    Object.entries(views).forEach(([key, v]) => {
      v.section.hidden = key !== name;
    });
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === name);
    });

    const view = views[name];
    view.render();
    view.loaded = true;

    localStorage.setItem("panel-vadori-tab", name);
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  document.getElementById("fecha-hoy").textContent = Utils.fechaLarga(Utils.todayISO());

  const tabGuardada = localStorage.getItem("panel-vadori-tab");
  showView(views[tabGuardada] ? tabGuardada : "hoy");

  // Refresco automático liviano: al volver a foco la pestaña, recargar la vista activa.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const activo = document.querySelector(".tab-btn.active");
    if (activo) views[activo.dataset.view].render();
  });
})();
