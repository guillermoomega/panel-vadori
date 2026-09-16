(() => {
  const AREA_DEFAULT = {
    hoy: "hoy",
    suites: "checkins",
    administracion: "caja",
    mas: "mas"
  };

  const views = {
    hoy:                { area: "hoy",           section: document.getElementById("view-hoy"),              render: ViewHoy.render,             loaded: false },
    checkins:           { area: "suites",         section: document.getElementById("view-checkins"),         render: ViewCheckins.render,        loaded: false },
    calendario:         { area: "suites",         section: document.getElementById("view-calendario"),       render: ViewCalendario.render,      loaded: false },
    estado:             { area: "suites",         section: document.getElementById("view-limpieza"),         render: ViewLimpieza.render,        loaded: false },
    caja:               { area: "administracion", section: document.getElementById("view-caja"),             render: ViewCaja.render,            loaded: false },
    horas:              { area: "administracion", section: document.getElementById("view-horas"),            render: ViewHoras.render,           loaded: false },
    resumen:            { area: "administracion", section: document.getElementById("view-resumen"),          render: ViewResumenSemanal.render,  loaded: false },
    "cuenta-corriente": { area: "administracion", section: document.getElementById("view-cuenta-corriente"), render: ViewCuentaCorriente.render, loaded: false },
    proveedores:        { area: "administracion", section: document.getElementById("view-proveedores"),      render: null,                       loaded: true },
    mas:                { area: "mas",            section: document.getElementById("view-mas"),              render: null,                       loaded: true }
  };

  let seccionActiva = null;
  const ultimaSeccion = {}; // area -> seccion, para volver a la última pestaña usada de cada área

  function cargarUltimaSeccion() {
    try {
      Object.assign(ultimaSeccion, JSON.parse(localStorage.getItem("panel-vadori-secciones") || "{}"));
    } catch (_) {
      // localStorage corrupto o vacío: se ignora y queda el objeto vacío
    }
  }

  function guardarUltimaSeccion() {
    localStorage.setItem("panel-vadori-secciones", JSON.stringify(ultimaSeccion));
  }

  function showArea(area) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.area === area);
    });
    document.querySelectorAll(".area-tabs").forEach(nav => {
      nav.hidden = nav.dataset.area !== area;
    });

    localStorage.setItem("panel-vadori-area", area);
    showSeccion(ultimaSeccion[area] || AREA_DEFAULT[area]);
  }

  function showSeccion(seccion) {
    const view = views[seccion];
    if (!view) return;

    seccionActiva = seccion;
    Object.entries(views).forEach(([key, v]) => {
      v.section.hidden = key !== seccion;
    });
    document.querySelectorAll(".area-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.seccion === seccion);
    });

    if (view.render && !view.loaded) {
      view.render();
      view.loaded = true;
    }

    ultimaSeccion[view.area] = seccion;
    guardarUltimaSeccion();
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => showArea(btn.dataset.area));
  });

  document.querySelectorAll(".area-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => showSeccion(btn.dataset.seccion));
  });

  document.getElementById("fecha-hoy").textContent = Utils.fechaLarga(Utils.todayISO());

  cargarUltimaSeccion();
  const areaGuardada = localStorage.getItem("panel-vadori-area");
  showArea(AREA_DEFAULT.hasOwnProperty(areaGuardada) ? areaGuardada : "hoy");

  // Refresco automático liviano: al volver a foco la pestaña, recargar la sección activa.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const view = views[seccionActiva];
    if (view && view.render) view.render();
  });
})();
