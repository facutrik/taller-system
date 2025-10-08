// ====== CONFIG ======
const API = "http://localhost:3000/api"; // evita hardcodear localhost:3000

// ====== ESTADO ======
let usuarioActual = null;
let fechaActual = new Date();
let eventosMes = {}; // { 'YYYY-MM-DD': 'texto' }
let editandoVehiculoId = null;

// ====== HELPERS ======
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => document.querySelectorAll(sel);

const formJSON = (obj) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj)
});

const putJSON = (obj) => ({
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj)
});

async function apiGET(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return r.json();
}
async function apiPOST(url, data){
  const r = await fetch(url, formJSON(data));
  if(!r.ok) throw new Error(`POST ${url} -> ${r.status}`);
  return r.json();
}
async function apiPUT(url, data){
  const r = await fetch(url, putJSON(data));
  if(!r.ok) throw new Error(`PUT ${url} -> ${r.status}`);
  return r.json();
}
async function apiDELETE(url){
  const r = await fetch(url, { method:"DELETE" });
  if(!r.ok) throw new Error(`DELETE ${url} -> ${r.status}`);
  return r.json();
}

// ====== LOGIN ======
$("#btn-ingresar").addEventListener("click", async ()=>{
  const usuario = $("#usuario").value.trim();
  const contrasenia = $("#contrasenia").value.trim();
  if(!usuario || !contrasenia) return $("#msj-login").textContent = "Completá usuario y contraseña";
  try{
    const res = await apiPOST(`${API}/login`, { usuario, contrasena: contrasenia });
    if(!res.ok) return $("#msj-login").textContent = "Credenciales inválidas";
    usuarioActual = res.data;
    // UI
    $("#inicio-sesion").classList.add("oculto");
    $("#app").classList.remove("oculto");
    $("#usuario-activo").textContent = usuarioActual.nombre;
    $("#usuario-rol").textContent = usuarioActual.rol;

    cambiarVista("calendario");
    renderCalendario();
  }catch(e){
    $("#msj-login").textContent = "No se pudo conectar con el servidor";
    console.error(e);
  }
});

$("#btn-salir").addEventListener("click", ()=>{
  usuarioActual = null;
  $("#app").classList.add("oculto");
  $("#inicio-sesion").classList.remove("oculto");
});

// ====== SIDEBAR ======
const barra = $("#barra");
$("#btn-toggle-barra").addEventListener("click", ()=>{
  barra.classList.toggle("colapsado");
});

$all(".item[data-vista]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    cambiarVista(btn.getAttribute("data-vista"));
  });
});

function cambiarVista(v){
  $all(".vista").forEach(vs => vs.classList.add("oculto"));
  const mapa = {
    calendario: "Calendario",
    vehiculos: "Vehículos",
    facturacion: "Facturación",
    historial: "Historial"
  };
  $("#titulo-vista").textContent = mapa[v] || "";
  $(`#vista-${v}`).classList.remove("oculto");

  if(v === "vehiculos") cargarVehiculos();
  if(v === "facturacion") cargarFacturacion();
  if(v === "historial") cargarHistorial();
}

// ====== CALENDARIO ======
$("#btn-mes-anterior").onclick = ()=>{ fechaActual.setMonth(fechaActual.getMonth()-1); renderCalendario(); };
$("#btn-mes-siguiente").onclick = ()=>{ fechaActual.setMonth(fechaActual.getMonth()+1); renderCalendario(); };

async function renderCalendario(){
  const anio = fechaActual.getFullYear();
  const mes = fechaActual.getMonth(); // 0..11
  $("#etiqueta-mes").textContent = fechaActual.toLocaleString("es-ES", { month:"long", year:"numeric" });

  // cargar eventos del mes
  try{
    const res = await apiGET(`${API}/eventos/${anio}/${mes+1}`);
    eventosMes = {};
    (res.data || []).forEach(e => { eventosMes[e.fecha] = e.texto; });
  }catch(e){ console.error(e); eventosMes = {}; }

  const grilla = $("#grilla-calendario");
  grilla.innerHTML = "";

  // cabecera
  ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].forEach(d=>{
    const c = document.createElement("div");
    c.className = "cab";
    c.textContent = d;
    grilla.appendChild(c);
  });

  const firstDay = new Date(anio, mes, 1).getDay();
  const lastDate = new Date(anio, mes+1, 0).getDate();

  for(let i=0; i<firstDay; i++) grilla.appendChild(document.createElement("div"));

  for(let d=1; d<=lastDate; d++){
    const key = `${anio}-${String(mes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const celda = document.createElement("div");
    celda.className = "dia";
    celda.innerHTML = `<strong>${d}</strong><span>${eventosMes[key] || ""}</span>`;
    celda.onclick = ()=> abrirModalEvento(key, eventosMes[key] || "");
    grilla.appendChild(celda);
  }
}

function abrirModalEvento(fechaISO, texto){
  $("#texto-dia").textContent = fechaISO;
  $("#inp-evento").value = texto;
  $("#modal-evento").showModal();

  $("#btn-guardar-evento").onclick = async ()=>{
    const valor = $("#inp-evento").value.trim();
    try{
      await apiPUT(`${API}/eventos`, { fecha: fechaISO, texto: valor });
      $("#modal-evento").close();
      renderCalendario();
    }catch(e){
      alert("No se pudo guardar el evento");
      console.error(e);
    }
  };
  $("#btn-cancelar-evento").onclick = ()=> $("#modal-evento").close();
}

// ====== VEHÍCULOS ======
$("#btn-agregar-vehiculo").addEventListener("click", ()=> abrirModalVehiculo());

async function cargarVehiculos(){
  try{
    const res = await apiGET(`${API}/vehiculos`);
    const tbody = $("#tabla-vehiculos");
    tbody.innerHTML = "";
    (res.data || []).forEach(v=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.patente || ""}</td>
        <td>${v.modelo || ""}</td>
        <td>${v.id_cliente ?? ""}</td>
        <td>
          <button class="btn" data-accion="editar">Editar</button>
          <button class="btn" data-accion="eliminar">Eliminar</button>
        </td>
      `;
      tr.querySelector('[data-accion="editar"]').onclick = ()=> abrirModalVehiculo(v);
      tr.querySelector('[data-accion="eliminar"]').onclick = ()=> eliminarVehiculo(v.id);
      tbody.appendChild(tr);
    });
  }catch(e){
    console.error(e);
    alert("No se pudo cargar la lista de vehículos");
  }
}

function abrirModalVehiculo(v=null){
  editandoVehiculoId = v?.id ?? null;
  $("#titulo-modal-vehiculo").textContent = editandoVehiculoId ? "Editar vehículo" : "Nuevo vehículo";
  $("#inp-patente").value = v?.patente ?? "";
  $("#inp-modelo").value = v?.modelo ?? "";
  $("#inp-idcliente").value = v?.id_cliente ?? "";

  $("#modal-vehiculo").showModal();

  $("#btn-cancelar-vehiculo").onclick = ()=> $("#modal-vehiculo").close();
  $("#btn-guardar-vehiculo").onclick = async ()=>{
    const patente = $("#inp-patente").value.trim();
    const modelo  = $("#inp-modelo").value.trim();
    const id_cliente = $("#inp-idcliente").value.trim() || null;
    if(!patente || !modelo) return alert("Completá patente y modelo");

    try{
      if(editandoVehiculoId){
        await apiPUT(`${API}/vehiculos/${editandoVehiculoId}`, { patente, modelo, id_cliente });
      }else{
        await apiPOST(`${API}/vehiculos`, { patente, modelo, id_cliente });
      }
      $("#modal-vehiculo").close();
      cargarVehiculos();
    }catch(e){
      console.error(e);
      alert("No se pudo guardar el vehículo");
    }
  };
}

async function eliminarVehiculo(id){
  if(!confirm("¿Eliminar vehículo?")) return;
  try{
    await apiDELETE(`${API}/vehiculos/${id}`);
    cargarVehiculos();
  }catch(e){
    console.error(e);
    alert("No se pudo eliminar");
  }
}

// ====== FACTURACIÓN ======
async function cargarFacturacion(){
  try{
    const res = await apiGET(`${API}/facturacion/total`);
    const total = res.data?.total ?? 0;
    $("#total-facturado").textContent = "$ " + Number(total).toLocaleString("es-AR");
  }catch(e){
    console.error(e);
    $("#total-facturado").textContent = "$ 0";
  }
}

// ====== HISTORIAL ======
async function cargarHistorial(){
  try{
    const res = await apiGET(`${API}/historial`);
    const ul = $("#lista-historial");
    ul.innerHTML = "";
    (res.data || []).forEach(it=>{
      const li = document.createElement("li");
      li.textContent = `${it.fecha} - ${it.patente}: ${it.descripcion}`;
      ul.appendChild(li);
    });
  }catch(e){
    console.error(e);
    alert("No se pudo cargar el historial");
  }
}
