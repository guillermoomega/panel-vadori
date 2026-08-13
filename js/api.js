const Api = (() => {
  async function get(path, params = {}) {
    const url = new URL(window.PANEL_CONFIG.apiBase + path);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "X-Panel-Key": window.PANEL_CONFIG.panelKey }
    });

    if (res.status === 403) {
      throw new Error("Acceso rechazado (403) — clave del panel inválida o faltante.");
    }
    if (!res.ok) {
      throw new Error(`Error del servidor (${res.status})`);
    }
    return res.json();
  }

  return {
    ocupacion: (desde, hasta) => get("/ocupacion", { desde, hasta }),
    hoy: () => get("/hoy"),
    limpieza: () => get("/limpieza")
  };
})();
