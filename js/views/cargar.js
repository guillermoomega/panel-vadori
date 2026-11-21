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

  // Gastos cargados en los últimos 7 días, para corregir lo que se leyó mal
  const CATEGORIAS = ["insumos cocina", "insumos suites", "bebidas", "limpieza", "mantenimiento", "servicios", "sueldos cocina", "sueldos salon", "otros"];
  const MEDIOS = { gv: "Caja GV", go: "Caja GO", cc: "Cuenta corriente" };

  // Monto escrito a mano: "161.974", "161,974", "$ 161.974,50" o "1234.5". Un separador seguido
  // de grupos de exactamente 3 dígitos es de miles; si están los dos, el último es el decimal.
  // Vacío → null; ilegible → NaN.
  function leerMonto(texto) {
    let t = String(texto || "").replace(/[$\s]/g, "");
    if (!t) return null;
    if (!/^[0-9.,]+$/.test(t)) return NaN;
    const ultPunto = t.lastIndexOf("."), ultComa = t.lastIndexOf(",");
    if (ultPunto >= 0 && ultComa >= 0) {
      const dec = ultPunto > ultComa ? "." : ",";
      const miles = dec === "." ? "," : ".";
      t = t.split(miles).join("").replace(dec, ".");
    } else {
      const sep = ultPunto >= 0 ? "." : ultComa >= 0 ? "," : null;
      if (sep) {
        const grupos = sep === "." ? /^\d{1,3}(\.\d{3})+$/ : /^\d{1,3}(,\d{3})+$/;
        t = grupos.test(t) ? t.split(sep).join("") : (t.split(sep).length === 2 ? t.replace(sep, ".") : "x");
      }
    }
    const n = Number(t);
    return isNaN(n) ? NaN : Math.round(n * 100) / 100;
  }

  function vistaMonto(texto) {
    const n = leerMonto(texto);
    if (n === null) return "";
    return isNaN(n) ? "No se entiende el monto" : "Se guarda: " + Utils.formatMonto(n);
  }
  let recientes = [];
  let recientesError = null;
  let editandoId = null;
  let mensajeEdicion = null; // { id, ok, texto }

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
      } else if (ev.target.classList.contains("cargar-foto-input")) {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        try {
          foto = await achicar(file);
          resultado = null;
        } catch (err) {
          foto = null;
          alert(err.message);
        }
        ev.target.value = "";
        renderFoto();
      }
    });

    elContent().addEventListener("input", (ev) => {
      if (ev.target.name !== "monto") return;
      const vista = ev.target.closest(".form-field").querySelector(".cargar-monto-vista");
      if (vista) vista.textContent = vistaMonto(ev.target.value);
    });

    elContent().addEventListener("click", (ev) => {
      if (ev.target.closest("[data-accion='quitar-foto']")) {
        foto = null;
        renderFoto();
        return;
      }
      const btnEditar = ev.target.closest("[data-accion='editar-comprobante']");
      if (btnEditar) {
        editandoId = editandoId === btnEditar.dataset.id ? null : btnEditar.dataset.id;
        mensajeEdicion = null;
        renderRecientes();
        return;
      }
      if (ev.target.closest("[data-accion='cancelar-edicion']")) {
        editandoId = null;
        renderRecientes();
      }
    });

    elContent().addEventListener("submit", async (ev) => {
      if (ev.target.closest("#cargar-form")) {
        ev.preventDefault();
        await enviar(ev.target);
      } else if (ev.target.closest(".cargar-editar-form")) {
        ev.preventDefault();
        await guardarCorreccion(ev.target);
      }
    });
  }

  async function cargarRecientes() {
    try {
      const res = await Api.comprobantesRecientes();
      if (!res.ok) throw new Error(res.error || "No se pudieron leer los comprobantes cargados.");
      recientes = res.items || [];
      recientesError = null;
    } catch (err) {
      recientesError = err.message;
    }
  }

  async function guardarCorreccion(form) {
    const id = form.dataset.id;
    const campo = (n) => form.querySelector(`[name="${n}"]`).value;
    const datos = {
      id,
      fecha: campo("fecha"),
      proveedor_id: campo("proveedor_id"),
      descripcion: campo("descripcion").trim(),
      monto: campo("monto"),
      categoria: campo("categoria"),
      medio: campo("medio"),
      negocio: campo("negocio")
    };
    if (!datos.fecha) return alert("Poné la fecha del comprobante.");
    if (!datos.proveedor_id) return alert("Elegí el proveedor.");
    const monto = leerMonto(datos.monto);
    if (Number.isNaN(monto)) return alert("No se entiende el monto. Escribilo así: 161.974 o 161974,50");
    if (!(monto > 0)) return alert("El monto tiene que ser mayor a cero.");
    datos.monto = String(monto);

    const btn = form.querySelector("[type='submit']");
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      datos.email = await obtenerEmail();
      const res = await Api.editarComprobante(datos);
      if (!res.ok) throw new Error(res.error || "No se pudo guardar la corrección.");
      mensajeEdicion = { id, ok: true, texto: res.respuesta };
      editandoId = null;
      await cargarRecientes();
    } catch (err) {
      mensajeEdicion = { id, ok: false, texto: err.message };
    }
    renderRecientes();
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
      const monto = leerMonto(body.monto);
      if (Number.isNaN(monto)) return alert("No se entiende el monto. Escribilo así: 161.974 o 161974,50");
      body.monto = monto === null ? "" : String(monto);
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
      // Los datos salen de leer la foto: siempre se pide revisarlos
      resultado = { ok: true, texto: res.respuesta, aviso: "Revisá que los datos cargados sean correctos (fecha, monto, proveedor). Si algo está mal, avisá a administración." };
      foto = null;
      if (tipo === "gasto") {
        form.reset();
        // El gasto recién cargado queda abierto abajo para corregirlo ahí mismo
        await cargarRecientes();
        if (res.comprobante_id && recientes.some(c => c.id === res.comprobante_id)) {
          editandoId = res.comprobante_id;
          mensajeEdicion = null;
          resultado.aviso = "Revisá que los datos cargados sean correctos (fecha, monto, proveedor, cómo se pagó). Quedó abierto abajo, en Últimos cargados: si algo está mal, corregilo y tocá Guardar corrección.";
        }
      }
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
        <input type="text" inputmode="decimal" autocomplete="off" id="cargar-monto" name="monto" placeholder="Si hay foto, se lee de la foto">
        <div class="card-sub cargar-monto-vista" aria-live="polite"></div>
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

  // Dos botones: en Android el selector sin "capture" a veces solo ofrece la galería
  function botonesFoto(textoCamara) {
    return `
      <label class="btn-secundario cargar-foto-btn" for="cargar-foto-camara">${textoCamara}</label>
      <label class="btn-secundario cargar-foto-btn" for="cargar-foto-galeria">🖼 Elegir de la galería</label>
      <input type="file" id="cargar-foto-camara" class="cargar-foto-input" accept="image/*" capture="environment" hidden>
      <input type="file" id="cargar-foto-galeria" class="cargar-foto-input" accept="image/*" hidden>`;
  }

  function fotoHtml() {
    if (!foto) {
      return `<div class="reserva-buscar-fila cargar-foto-botones">${botonesFoto("📷 Sacar foto")}</div>`;
    }
    return `
      <img class="cargar-foto-preview" src="${foto.url}" alt="Foto del comprobante">
      <div class="reserva-buscar-fila cargar-foto-botones">
        ${botonesFoto("📷 Sacar otra")}
        <button type="button" class="btn-peligro" data-accion="quitar-foto">Quitar</button>
      </div>`;
  }

  function renderFoto() {
    const el = document.getElementById("cargar-foto-zona");
    if (el) el.innerHTML = fotoHtml();
  }

  function resultadoHtml() {
    if (!resultado) return "";
    const aviso = resultado.aviso ? `<div class="form-aviso cargar-revisar">⚠ ${Utils.escapeHtml(resultado.aviso)}</div>` : "";
    return `<div class="card cargar-resultado${resultado.ok ? "" : " error"}">${Utils.escapeHtml(resultado.texto || "")}${aviso}</div>`;
  }

  function fechaDMA(iso) {
    if (!iso) return "sin fecha";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  // Fecha del ticket muy lejos de la de carga: probable error de lectura de la foto
  function fechaSospechosa(c) {
    if (!c.fecha) return true;
    const carga = new Date(c.creado.slice(0, 10) + "T00:00:00");
    const ticket = new Date(c.fecha + "T00:00:00");
    const dias = (carga - ticket) / 86400000;
    return dias > 60 || dias < 0;
  }

  function opciones(lista, actual) {
    return lista.map(([valor, texto]) =>
      `<option value="${Utils.escapeHtml(valor)}"${valor === actual ? " selected" : ""}>${Utils.escapeHtml(texto)}</option>`).join("");
  }

  function editorHtml(c) {
    const provs = proveedores.filter(p => p.id).map(p => [p.id, p.Nombre]);
    if (c.proveedor_id && !provs.some(([id]) => id === c.proveedor_id)) provs.unshift([c.proveedor_id, c.proveedor || "Proveedor actual"]);
    return `
      <form class="reserva-form cargar-editar-form" data-id="${Utils.escapeHtml(c.id)}">
        <div class="form-row">
          <div class="form-field">
            <label>Fecha del comprobante *</label>
            <input type="date" name="fecha" value="${Utils.escapeHtml(c.fecha || "")}" max="${Utils.todayISO()}" required>
          </div>
          <div class="form-field">
            <label>Proveedor *</label>
            <select name="proveedor_id" required><option value=""></option>${opciones(provs, c.proveedor_id)}</select>
          </div>
          <div class="form-field">
            <label>Descripción</label>
            <input type="text" name="descripcion" value="${Utils.escapeHtml(c.descripcion || "")}">
          </div>
          <div class="form-field">
            <label>Monto ($) *</label>
            <input type="text" inputmode="decimal" autocomplete="off" name="monto" value="${c.monto ?? ""}" required>
            <div class="card-sub cargar-monto-vista" aria-live="polite">${c.monto != null ? vistaMonto(c.monto) : ""}</div>
          </div>
          <div class="form-field">
            <label>Categoría</label>
            <select name="categoria">${opciones(CATEGORIAS.map(x => [x, x]), c.categoria)}</select>
          </div>
          <div class="form-field">
            <label>Cómo se pagó *</label>
            <select name="medio">${opciones(Object.entries(MEDIOS), c.medio)}</select>
          </div>
          <div class="form-field">
            <label>Negocio</label>
            <select name="negocio">${opciones([["GV", "Gran Vadori"], ["VV", "Villa Vadori Suites"]], c.negocio)}</select>
          </div>
          <div class="form-aviso">En cuenta corriente el vencimiento se recalcula con el plazo del proveedor.</div>
        </div>
        <div class="reserva-buscar-fila">
          <button type="submit" class="btn-crear-reserva">Guardar corrección</button>
          <button type="button" class="btn-secundario" data-accion="cancelar-edicion">Cancelar</button>
        </div>
      </form>`;
  }

  function reciente(c) {
    const titulo = `${c.proveedor || "Sin proveedor"}${c.descripcion ? " · " + c.descripcion : ""}`;
    const pago = c.medio === "cc"
      ? `Cuenta corriente${c.fecha_vencimiento ? ", vence " + Utils.fechaCorta(c.fecha_vencimiento) : ""}`
      : MEDIOS[c.medio];
    const sospechosa = fechaSospechosa(c);
    const abierto = editandoId === c.id;
    const msg = mensajeEdicion && mensajeEdicion.id === c.id
      ? `<div class="cargar-resultado${mensajeEdicion.ok ? "" : " error"}">${Utils.escapeHtml(mensajeEdicion.texto)}</div>` : "";
    const accion = c.editable
      ? `<button type="button" class="btn-secundario" data-accion="editar-comprobante" data-id="${Utils.escapeHtml(c.id)}">${abierto ? "Cerrar" : "Editar"}</button>`
      : `<span class="card-sub">${Utils.escapeHtml(c.motivo || "")}</span>`;
    return `
      <div class="card cargar-reciente${abierto ? " abierto" : ""}">
        <div class="card-row">
          <div class="card-main">
            <div class="card-title">${Utils.escapeHtml(titulo)}</div>
            <div class="card-sub">
              <span class="${sospechosa ? "badge badge-warn" : ""}">Fecha ${fechaDMA(c.fecha)}${sospechosa ? " — revisar" : ""}</span>
              · ${Utils.escapeHtml(pago)} · ${Utils.escapeHtml(c.categoria)} · ${c.negocio === "VV" ? "Villa Vadori" : "Gran Vadori"}
            </div>
            <div class="card-meta">Cargó ${Utils.escapeHtml(c.registrado_por || "?")} el ${Utils.escapeHtml(fechaDMA(c.creado.slice(0, 10)).slice(0, 5))} ${Utils.escapeHtml(c.creado.slice(11))}${c.corregido_por ? " · corrigió " + Utils.escapeHtml(c.corregido_por) : ""}</div>
          </div>
          <div class="card-right">
            <div class="card-title">${c.monto != null ? Utils.formatMonto(c.monto) : "—"}</div>
            ${accion}
          </div>
        </div>
        ${msg}
        ${abierto ? editorHtml(c) : ""}
      </div>`;
  }

  function recientesHtml() {
    if (recientesError) return `<div class="estado-msg error">${Utils.escapeHtml(recientesError)}</div>`;
    if (!recientes.length) return `<div class="card-sub">No hay gastos cargados en los últimos 7 días.</div>`;
    return recientes.map(reciente).join("");
  }

  function renderRecientes() {
    const el = document.getElementById("cargar-recientes");
    if (el) el.innerHTML = recientesHtml();
    const abierto = editandoId && el && el.querySelector(".cargar-reciente.abierto");
    if (abierto) abierto.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
      <div class="form-aviso cargar-usuario">Se registra a nombre de ${email ? Utils.escapeHtml(email) : "tu usuario del panel"} (el teléfono cargado para ese email en Equipo).</div>
      <div class="section-title">Últimos cargados (gastos de los últimos 7 días)</div>
      <div id="cargar-recientes">${recientesHtml()}</div>`;
    if (editandoId) renderRecientes();
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    resultado = null;
    foto = null;
    editandoId = null;
    mensajeEdicion = null;
    try {
      const [res] = await Promise.all([Api.configListar("proveedores"), obtenerEmail().catch(() => null), cargarRecientes()]);
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
