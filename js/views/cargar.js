const ViewCargar = (() => {
  const elEstado = () => document.getElementById("cargar-estado");
  const elContent = () => document.getElementById("cargar-content");

  // Mismos tipos que por WhatsApp (palabra clave en el comentario de la foto)
  const TIPOS = [
    { id: "gasto", label: "Gasto / factura de proveedor" },
    { id: "arqueo", label: "Arqueo (reporte de caja)" },
    { id: "cierrelote", label: "Cierre de lote / voucher de propina" },
    { id: "deposito", label: "Depósito" }
  ];
  const AYUDA = {
    gasto: "Foto de la factura o ticket. Sin foto se puede cargar poniendo el monto.",
    arqueo: "Foto del ticket de cierre de caja del turno.",
    cierrelote: "Foto del cierre de lote del posnet. Los vouchers de propina tienen que tener escrito a mano Prop.",
    deposito: "Foto del comprobante del depósito."
  };
  const LADO_MAX = 2000; // px: suficiente para leer el ticket y liviano para subir

  let listenersAttached = false;
  let email = null;
  let proveedores = [];
  let tipo = "gasto";
  let foto = null; // { base64, mime, url }
  let resultado = null; // { ok, texto }

  async function obtenerEmail() {
    if (email) return email;
    // Cloudflare Access expone la identidad del login en el mismo dominio del panel
    const res = await fetch("/cdn-cgi/access/get-identity", { credentials: "include" });
    if (!res.ok) throw new Error("No se pudo saber con qué usuario entraste al panel. Volvé a entrar.");
    const data = await res.json();
    if (!data || !data.email) throw new Error("No se pudo saber con qué usuario entraste al panel. Volvé a entrar.");
    email = String(data.email).trim().toLowerCase();
    return email;
  }

  function achicar(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * escala);
        canvas.height = Math.round(img.naturalHeight * escala);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ base64: dataUrl.split(",")[1], mime: "image/jpeg", url: dataUrl });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo abrir la imagen. Probá sacando la foto de nuevo."));
      };
      img.src = url;
    });
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    elContent().addEventListener("change", async (ev) => {
      if (ev.target.name === "tipo") {
        tipo = ev.target.value;
        resultado = null;
        renderTodo();
      } else if (ev.target.id === "cargar-foto") {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        try {
          foto = await achicar(file);
          resultado = null;
        } catch (err) {
          foto = null;
          alert(err.message);
        }
        renderFoto();
      }
    });

    elContent().addEventListener("click", (ev) => {
      if (ev.target.closest("[data-accion='quitar-foto']")) {
        foto = null;
        renderFoto();
      }
    });

    elContent().addEventListener("submit", async (ev) => {
      if (!ev.target.closest("#cargar-form")) return;
      ev.preventDefault();
      await enviar(ev.target);
    });
  }

  function datosGasto(form) {
    return {
      proveedor: form.querySelector('[name="proveedor"]').value,
      descripcion: form.querySelector('[name="descripcion"]').value.trim(),
      monto: form.querySelector('[name="monto"]').value,
      medio: form.querySelector('[name="medio"]').value,
      negocio: form.querySelector('[name="negocio"]').value
    };
  }

  async function enviar(form) {
    const body = { tipo };
    if (tipo === "gasto") {
      Object.assign(body, datosGasto(form));
      if (!body.proveedor) return alert("Elegí el proveedor.");
      if (!body.medio) return alert("Elegí cómo se pagó.");
      if (!foto && !body.monto) return alert("Sin foto hay que poner el monto.");
    } else if (!foto) {
      return alert("Falta la foto.");
    }
    if (foto) {
      body.base64_imagen = foto.base64;
      body.mime_type = foto.mime;
    }

    const btn = form.querySelector(".btn-crear-reserva");
    btn.disabled = true;
    btn.textContent = "Procesando… (puede tardar hasta un minuto)";
    try {
      body.email = await obtenerEmail();
      const res = await Api.cargarComprobante(body);
      if (!res.ok) throw new Error(res.error || "No se pudo procesar el comprobante.");
      resultado = { ok: true, texto: res.respuesta };
      foto = null;
      if (tipo === "gasto") form.reset();
    } catch (err) {
      resultado = { ok: false, texto: err.message };
    }
    renderTodo();
  }

  function campoGasto() {
    const opts = proveedores.map(p => `<option value="${Utils.escapeHtml(p.Nombre)}">${Utils.escapeHtml(p.alias ? `${p.Nombre} (${p.alias})` : p.Nombre)}</option>`).join("");
    return `
      <div class="form-field">
        <label for="cargar-proveedor">Proveedor *</label>
        <select id="cargar-proveedor" name="proveedor" required>
          <option value=""></option>
          ${opts}
        </select>
      </div>
      <div class="form-field">
        <label for="cargar-descripcion">Descripción</label>
        <input type="text" id="cargar-descripcion" name="descripcion" placeholder="Ej: verdura">
      </div>
      <div class="form-field">
        <label for="cargar-monto">Monto ($)</label>
        <input type="number" id="cargar-monto" name="monto" step="0.01" min="0" placeholder="Si hay foto, se lee de la foto">
      </div>
      <div class="form-field">
        <label for="cargar-medio">Cómo se pagó *</label>
        <select id="cargar-medio" name="medio" required>
          <option value=""></option>
          <option value="gv">Caja GV</option>
          <option value="go">Caja GO</option>
          <option value="cc">Cuenta corriente (a pagar)</option>
        </select>
      </div>
      <div class="form-field">
        <label for="cargar-negocio">Negocio</label>
        <select id="cargar-negocio" name="negocio">
          <option value="">Según el comprobante</option>
          <option value="GV">Gran Vadori</option>
          <option value="VV">Villa Vadori Suites</option>
        </select>
      </div>
      <div class="form-aviso">Si el proveedor no está en la lista, primero agregalo en Administración → Proveedores.</div>`;
  }

  function fotoHtml() {
    if (!foto) {
      return `
        <label class="btn-secundario cargar-foto-btn" for="cargar-foto">📷 Sacar o elegir foto</label>
        <input type="file" id="cargar-foto" accept="image/*" hidden>`;
    }
    return `
      <img class="cargar-foto-preview" src="${foto.url}" alt="Foto del comprobante">
      <div class="reserva-buscar-fila">
        <label class="btn-secundario cargar-foto-btn" for="cargar-foto">Cambiar foto</label>
        <button type="button" class="btn-peligro" data-accion="quitar-foto">Quitar</button>
      </div>
      <input type="file" id="cargar-foto" accept="image/*" hidden>`;
  }

  function renderFoto() {
    const el = document.getElementById("cargar-foto-zona");
    if (el) el.innerHTML = fotoHtml();
  }

  function resultadoHtml() {
    if (!resultado) return "";
    return `<div class="card cargar-resultado${resultado.ok ? "" : " error"}">${Utils.escapeHtml(resultado.texto || "")}</div>`;
  }

  function renderTodo() {
    const radios = TIPOS.map(t => `
      <label class="checkbox-inline">
        <input type="radio" name="tipo" value="${t.id}"${t.id === tipo ? " checked" : ""}>
        ${Utils.escapeHtml(t.label)}
      </label>`).join("");
    elContent().innerHTML = `
      <div class="section-title">Cargar comprobante</div>
      ${resultadoHtml()}
      <form id="cargar-form" class="reserva-form">
        <div class="form-row">
          <div class="form-field form-field-wide">
            <label>Tipo</label>
            <div class="checkbox-group cargar-tipos">${radios}</div>
          </div>
          <div class="form-aviso">${Utils.escapeHtml(AYUDA[tipo])}</div>
          ${tipo === "gasto" ? campoGasto() : ""}
          <div class="form-field form-field-wide" id="cargar-foto-zona">${fotoHtml()}</div>
        </div>
        <div class="reserva-buscar-fila">
          <button type="submit" class="btn-crear-reserva">Enviar</button>
        </div>
      </form>
      <div class="form-aviso cargar-usuario">Se registra a nombre de ${email ? Utils.escapeHtml(email) : "tu usuario del panel"} (el teléfono cargado para ese email en Equipo).</div>`;
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    resultado = null;
    foto = null;
    try {
      const [res] = await Promise.all([Api.configListar("proveedores"), obtenerEmail().catch(() => null)]);
      if (!res.ok) throw new Error(res.error || "No se pudieron cargar los proveedores.");
      proveedores = (res.items || []).filter(p => p.Nombre)
        .sort((a, b) => a.Nombre.localeCompare(b.Nombre, "es", { sensitivity: "base" }));
      elEstado().textContent = "";
      renderTodo();
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
