import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import PDFDocument from "pdfkit";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4_general_ci",
});

const ok = (res, data) => res.json({ ok: true, data });
const fail = (res, msg, code = 400) => res.status(code).json({ ok: false, msg });

/*HELPERS DB*/
const nn      = x => (x === undefined || x === null || x === "" ? null : x);
const nnInt   = x => (Number.isFinite(Number(x)) ? Number(x) : null);
const normFecha = v => {
  if (!v || typeof v !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

async function recalcFacturaTotal(conn, idFactura) {
  const [[s]] = await conn.query(
    `SELECT COALESCE(SUM(cantidad*precioUnitario),0) AS total
        FROM factura_detalle
      WHERE idFactura=?`, [idFactura]
  );
  const total = Number(s?.total || 0);
  await conn.query(`UPDATE facturas SET total=? WHERE idFactura=?`, [total, idFactura]);
  return total;
}

async function ensureFacturaForVehiculo(conn, idVehiculo) {
  const [[f]] = await conn.query(
    `SELECT idFactura
        FROM facturas
      WHERE idVehiculo=? AND estado IN ('emitida','pagada')
      ORDER BY idFactura DESC LIMIT 1`, [idVehiculo]
  );
  if (f?.idFactura) return f.idFactura;

  const [r] = await conn.query(
    `INSERT INTO facturas (fechaEmision, idVehiculo, estado, total)
      VALUES (CURDATE(), ?, 'emitida', 0)`, [idVehiculo]
  );
  return r.insertId;
}

/*LOGIN*/
app.post("/api/login", async (req, res) => {
  const { usuario, contrasena } = req.body;
  if (!usuario || !contrasena) return fail(res, "Faltan datos");
  try {
    const [rows] = await pool.query(
      `SELECT idUsuario AS id, nombre, rol
          FROM usuarios
        WHERE usuario=? AND \`contraseña\`=? LIMIT 1`,
      [usuario, contrasena]
    );
    if (!rows.length) return fail(res, "Credenciales inválidas", 401);
    ok(res, rows[0]);
  } catch (e) {
    console.error("POST /login", e);
    fail(res, "Error de servidor", 500);
  }
});

/*EVENTOS (calendario)*/
app.get("/api/eventos/:anio/:mes", async (req, res) => {
  const { anio, mes } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, texto
          FROM eventos
        WHERE YEAR(fecha)=? AND MONTH(fecha)=?
        ORDER BY fecha`,
      [anio, mes]
    );
    ok(res, rows);
  } catch (e) {
    console.error("GET /eventos", e);
    fail(res, "Error cargando eventos", 500);
  }
});

app.put("/api/eventos", async (req, res) => {
  const { fecha, texto } = req.body || {};
  if (!fecha) return fail(res, "Falta fecha");
  try {
    if (!texto) {
      await pool.query(`DELETE FROM eventos WHERE fecha=?`, [fecha]);
      return ok(res, { deleted: true });
    }
    await pool.query(
      `INSERT INTO eventos (fecha, texto) VALUES (?,?)
        ON DUPLICATE KEY UPDATE texto=VALUES(texto)`,
      [fecha, texto]
    );
    ok(res, { upserted: true });
  } catch (e) {
    console.error("PUT /eventos", e);
    fail(res, "Error guardando evento", 500);
  }
});

/*CLIENTES*/
app.get("/api/clientes", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT idCliente AS id, nombre, telefono, email
          FROM clientes
        ORDER BY idCliente DESC`
    );
    ok(res, rows);
  } catch (e) {
    console.error("GET /clientes", e);
    fail(res, "Error listando clientes", 500);
  }
});

app.post("/api/clientes", async (req, res) => {
  const { nombre, telefono, email } = req.body || {};
  if (!nombre) return fail(res, "Falta nombre");
  try {
    const [r] = await pool.query(
      `INSERT INTO clientes (nombre, telefono, email) VALUES (?,?,?)`,
      [nombre, telefono || null, email || null]
    );
    ok(res, { id: r.insertId });
  } catch (e) {
    console.error("POST /clientes", e);
    fail(res, e.sqlMessage || "No se pudo crear el cliente", 500);
  }
});

/*REPUESTOS*/
app.get("/api/repuestos", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT idRepuesto AS id, nombre, precioLista
          FROM repuestos
        ORDER BY nombre ASC`
    );
    ok(res, rows);
  } catch (e) {
    console.error("GET /repuestos", e);
    fail(res, "Error listando repuestos", 500);
  }
});

app.post("/api/repuestos", async (req, res) => {
  const { nombre, precioLista } = req.body || {};
  if (!nombre) return fail(res, "Falta nombre");
  try {
    const [r] = await pool.query(
      `INSERT INTO repuestos (nombre, precioLista) VALUES (?,?)`,
      [nombre, nnInt(precioLista) ?? 0]
    );
    ok(res, { id: r.insertId });
  } catch (e) {
    console.error("POST /repuestos", e);
    fail(res, e.sqlMessage || "Error creando repuesto", 500);
  }
});

app.put("/api/repuestos/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, precioLista } = req.body || {};
  try {
    await pool.query(
      `UPDATE repuestos SET nombre=?, precioLista=? WHERE idRepuesto=?`,
      [nn(nombre), nnInt(precioLista) ?? 0, id]
    );
    ok(res, { changed: true });
  } catch (e) {
    console.error("PUT /repuestos/:id", e);
    fail(res, "Error actualizando repuesto", 500);
  }
});

app.delete("/api/repuestos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM repuestos WHERE idRepuesto=?`, [id]);
    ok(res, { deleted: true });
  } catch (e) {
    console.error("DELETE /repuestos/:id", e);
    fail(res, "Error eliminando repuesto", 500);
  }
});

/*VEHÍCULOS*/
app.get("/api/vehiculos", async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT v.idVehiculo AS id,
              v.patente, v.marca, v.modelo,
              v.\`año\` AS anio,
              v.color,
              DATE_FORMAT(v.fechaIngreso,'%Y-%m-%d') AS fechaIngreso,
              DATE_FORMAT(v.fechaEntrega,'%Y-%m-%d') AS fechaEntrega,
              v.preAnalisis,
              v.idCliente AS id_cliente
        FROM vehiculo v
        ORDER BY v.idVehiculo DESC
    `);
    ok(res, rows);
  } catch (e) {
    console.error("GET /vehiculos", e);
    fail(res, "Error listando vehículos", 500);
  }
});

app.post("/api/vehiculos", async (req, res) => {
  let {
    patente, marca, modelo, anio, color,
    fechaIngreso, fechaEntrega, preAnalisis, id_cliente,
  } = req.body || {};

  if (!patente || !modelo) return fail(res, "Patente y modelo son obligatorios");

  marca = nn(marca);
  anio = nnInt(anio);
  color = nn(color);
  fechaIngreso = normFecha(fechaIngreso);
  fechaEntrega = normFecha(fechaEntrega);
  preAnalisis = nn(preAnalisis);
  id_cliente = nnInt(id_cliente);

  try {
    if (id_cliente !== null) {
      const [[cli]] = await pool.query(
        `SELECT idCliente FROM clientes WHERE idCliente=? LIMIT 1`,
        [id_cliente]
      );
      if (!cli) return fail(res, "El idCliente ingresado no existe", 400);
    }

    const [r] = await pool.query(
      `INSERT INTO vehiculo (patente, marca, modelo, \`año\`, color, fechaIngreso, fechaEntrega, preAnalisis, idCliente)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      [patente, marca, modelo, anio, color, fechaIngreso, fechaEntrega, preAnalisis, id_cliente]
    );
    ok(res, { id: r.insertId });
  } catch (e) {
    console.error("POST /vehiculos", e);
    fail(res, e.sqlMessage || "Error creando vehículo", 500);
  }
});

app.put("/api/vehiculos/:id", async (req, res) => {
  const { id } = req.params;
  let {
    patente, marca, modelo, anio, color,
    fechaIngreso, fechaEntrega, preAnalisis, id_cliente,
  } = req.body || {};

  marca = nn(marca);
  anio = nnInt(anio);
  color = nn(color);
  fechaIngreso = normFecha(fechaIngreso);
  fechaEntrega = normFecha(fechaEntrega);
  preAnalisis = nn(preAnalisis);
  id_cliente = nnInt(id_cliente);

  try {
    if (id_cliente !== null) {
      const [[cli]] = await pool.query(
        `SELECT idCliente FROM clientes WHERE idCliente=? LIMIT 1`,
        [id_cliente]
      );
      if (!cli) return fail(res, "El idCliente ingresado no existe", 400);
    }

    const [r] = await pool.query(
      `UPDATE vehiculo
          SET patente=?, marca=?, modelo=?, \`año\`=?, color=?, fechaIngreso=?, fechaEntrega=?, preAnalisis=?, idCliente=?
        WHERE idVehiculo=?`,
      [patente, marca, modelo, anio, color, fechaIngreso, fechaEntrega, preAnalisis, id_cliente, id]
    );
    ok(res, { changed: r.affectedRows });
  } catch (e) {
    console.error("PUT /vehiculos", e);
    fail(res, e.sqlMessage || "Error actualizando vehículo", 500);
  }
});

app.delete("/api/vehiculos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [r] = await pool.query(`DELETE FROM vehiculo WHERE idVehiculo=?`, [id]);
    ok(res, { deleted: r.affectedRows });
  } catch (e) {
    console.error("DELETE /vehiculos/:id", e);
    fail(res, "Error eliminando vehículo", 500);
  }
});

/*TRABAJOS + DETALLE*/
app.post("/api/trabajos", async (req, res) => {
  const { idVehiculo, descripcion, costoMO, repuestos } = req.body || {};
  if (!idVehiculo || !descripcion) return fail(res, "Faltan datos del trabajo");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rt] = await conn.query(
      `INSERT INTO trabajos (fecha, descripcion, costoMO, idUsuario, idVehiculo)
        VALUES (CURDATE(), ?, 0 + ?, NULL, ?)`,
      [descripcion, nnInt(costoMO) ?? 0, idVehiculo]
    );
    const idTrabajo = rt.insertId;

    const lista = Array.isArray(repuestos) ? repuestos : [];
    for (const it of lista) {
      if (!it?.idRepuesto || !Number(it?.cantidad)) continue;
      await conn.query(
        `INSERT INTO trabajo_repuestos (idTrabajo, idRepuesto, cantidad, precioUnitario)
          VALUES (?,?,?,?)`,
        [idTrabajo, it.idRepuesto, Number(it.cantidad), nnInt(it.precioUnitario) ?? 0]
      );
    }

    const idFactura = await ensureFacturaForVehiculo(conn, idVehiculo);

    const mo = nnInt(costoMO) ?? 0;
    if (mo > 0) {
      await conn.query(
        `INSERT INTO factura_detalle (idFactura, concepto, cantidad, precioUnitario)
          VALUES (?,?,1,?)`,
        [idFactura, `Mano de obra - ${descripcion}`, mo]
      );
    }
    for (const it of lista) {
      if (!it?.idRepuesto || !Number(it?.cantidad)) continue;
      const [[rN]] = await conn.query(
        `SELECT nombre FROM repuestos WHERE idRepuesto=? LIMIT 1`,
        [it.idRepuesto]
      );
      const nombre = rN?.nombre || "Repuesto";
      await conn.query(
        `INSERT INTO factura_detalle (idFactura, concepto, cantidad, precioUnitario)
          VALUES (?,?,?,?)`,
        [idFactura, `Repuesto: ${nombre}`, Number(it.cantidad), nnInt(it.precioUnitario) ?? 0]
      );
    }

    await recalcFacturaTotal(conn, idFactura);
    await conn.commit();
    ok(res, { idTrabajo, idFactura });
  } catch (e) {
    await conn.rollback();
    console.error("POST /trabajos", e);
    fail(res, e.sqlMessage || "Error creando trabajo", 500);
  }
});

/*FACTURACIÓN*/
app.get("/api/facturacion/vehiculos", async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT v.idVehiculo AS id,
              v.patente, v.modelo, v.preAnalisis,
              v.idCliente AS id_cliente,
              c.nombre AS cliente,
              EXISTS(SELECT 1 FROM facturas f
                      WHERE f.idVehiculo=v.idVehiculo
                        AND f.estado IN ('emitida','pagada')) AS tieneFactura,
              (SELECT MAX(idFactura) FROM facturas
                WHERE idVehiculo=v.idVehiculo
                  AND estado IN ('emitida','pagada')) AS idFactura,
              (SELECT estado FROM facturas
                WHERE idVehiculo=v.idVehiculo
                  AND estado IN ('emitida','pagada')
                ORDER BY idFactura DESC LIMIT 1) AS estadoFactura
        FROM vehiculo v
        LEFT JOIN clientes c ON c.idCliente=v.idCliente
        ORDER BY v.idVehiculo DESC
    `);
    ok(res, rows);
  } catch (e) {
    console.error("GET /facturacion/vehiculos", e);
    fail(res, "Error listando vehículos para facturar", 500);
  }
});

app.get("/api/facturacion/total", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(total),0) AS total FROM facturas`
    );
    ok(res, rows[0]);
  } catch (e) {
    console.error("GET /facturacion/total", e);
    fail(res, "Error facturación", 500);
  }
});

/*PDF estilado*/
app.get("/api/facturas/:id/pdf", async (req, res) => {
  const { id } = req.params;

  const moneda = (n) =>
    new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(Number(n || 0));

  const fechaLargaAR = (v) => {
    const d = v instanceof Date ? v : new Date(v);
    const texto = d.toString();
    return texto.replace("Argentina Standard Time", "hora estándar de Argentina");
  };

  try {
    const [[f]] = await pool.query(
      `SELECT f.idFactura, f.fechaEmision, f.total, f.estado,
              v.patente, v.marca, v.modelo, v.\`año\` AS anio, v.color,
              c.nombre AS cliente, c.telefono, c.email
          FROM facturas f
          JOIN vehiculo v ON v.idVehiculo=f.idVehiculo
          LEFT JOIN clientes c ON c.idCliente=v.idCliente
        WHERE f.idFactura=? LIMIT 1`,
      [id]
    );
    if (!f) return fail(res, "Factura no encontrada", 404);

    const [items] = await pool.query(
      `SELECT concepto, cantidad, precioUnitario, (cantidad*precioUnitario) AS total
          FROM factura_detalle
        WHERE idFactura=?
        ORDER BY idDetalle ASC`,
      [id]
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=factura_${f.idFactura}.pdf`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    const M = 40;
    const W = doc.page.width - M * 2;
    const H_HEADER = 72;

    doc.save();
    doc.rect(M, M, W, H_HEADER).fill("#1E40AF");
    doc.fillColor("#FFFFFF");
    doc.font("Helvetica-Bold").fontSize(18).text("Taller System", M + 16, M + 12);
    doc.font("Helvetica").fontSize(10);
    doc.text("Reconquista 1590 – Rosario", M + 16, M + 38);
    doc.text("Tel: 341 648 55-37", M + 16, M + 52);
    doc.text("facultirk@gmail.com", M + 150, M + 52);

    const label = f.estado === "pagada" ? "PAGADA" : "EMITIDA";
    const chipW = 90, chipH = 24, chipX = M + W - chipW - 14, chipY = M + 12;
    doc.roundedRect(chipX, chipY, chipW, chipH, 12)
        .fill(f.estado === "pagada" ? "#16A34A" : "#F59E0B");
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(11)
        .text(label, chipX, chipY + 6, { width: chipW, align: "center" });
    doc.restore();

    let y = M + H_HEADER + 16;
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(13).text(`Factura N° ${f.idFactura}`, M, y);
    y += 18;
    doc.font("Helvetica").fontSize(10)
        .text(`Fecha de emisión: ${fechaLargaAR(f.fechaEmision)} (hora estándar de Argentina)`, M, y);
    y += 18;

    const colW = W / 2 - 6;
    doc.font("Helvetica-Bold").fontSize(11).text("Cliente", M, y);
    doc.font("Helvetica-Bold").fontSize(11).text("Vehículo", M + colW + 12, y);
    y += 14;

    doc.font("Helvetica").fontSize(10);
    const cY = y;
    doc.text(`Nombre: ${f.cliente || "—"}`, M, y); y += 14;
    doc.text(`Teléfono: ${f.telefono || "—"}`, M, y); y += 14;
    doc.text(`Email: ${f.email || "—"}`, M, y);

    let y2 = cY;
    doc.text(`Marca/Modelo: ${(f.marca || "—")} ${(f.modelo || "")}`, M + colW + 12, y2); y2 += 14;
    doc.text(`Patente: ${f.patente || "—"}`, M + colW + 12, y2); y2 += 14;
    doc.text(`Año: ${f.anio || "—"}  |  Color: ${f.color || "—"}`, M + colW + 12, y2);

    y = Math.max(y, y2) + 16;

    doc.moveTo(M, y).lineTo(M + W, y).strokeColor("#E5E7EB").lineWidth(1).stroke();
    y += 10;

    const colConcepto = Math.floor(W * 0.54);
    const colCant = Math.floor(W * 0.10);
    const colPU = Math.floor(W * 0.18);
    const colSub = W - (colConcepto + colCant + colPU);

    const headH = 22;
    doc.save();
    doc.rect(M, y, W, headH).fill("#F3F4F6");
    doc.restore();
    doc.fillColor("#334155").font("Helvetica-Bold").fontSize(10);
    doc.text("Concepto", M + 6, y + 6, { width: colConcepto - 12 });
    doc.text("Cant.", M + colConcepto + 6, y + 6, { width: colCant - 12 });
    doc.text("Precio unit.", M + colConcepto + colCant + 6, y + 6, { width: colPU - 12 });
    doc.text("Subtotal", M + colConcepto + colCant + colPU + 6, y + 6, { width: colSub - 12 });
    y += headH;

    doc.font("Helvetica").fillColor("#111827").fontSize(10);
    const rowH = 20;
    items.forEach((it, idx) => {
      const subtotal = Number(it.total ?? (Number(it.cantidad) * Number(it.precioUnitario)));
      if (idx % 2 === 1) { doc.save(); doc.rect(M, y, W, rowH).fill("#FBFBFB"); doc.restore(); }
      doc.text(String(it.concepto || ""), M + 6, y + 5, { width: colConcepto - 12 });
      doc.text(String(it.cantidad || 0), M + colConcepto + 6, y + 5, { width: colCant - 12 });
      doc.text(`$ ${new Intl.NumberFormat("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(it.precioUnitario)}`, M + colConcepto + colCant + 6, y + 5, { width: colPU - 12 });
      doc.text(`$ ${new Intl.NumberFormat("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(subtotal)}`, M + colConcepto + colCant + colPU + 6, y + 5, { width: colSub - 12 });
      y += rowH;
    });

    y += 6;
    doc.moveTo(M, y).lineTo(M + W, y).strokeColor("#E5E7EB").lineWidth(1).stroke();
    y += 10;

    doc.font("Helvetica-Bold").fontSize(11).text("Total:", M + W - 180, y + 2, { width: 80, align: "right" });
    doc.fontSize(12).text(`$ ${new Intl.NumberFormat("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(f.total)}`, M + W - 90, y, { width: 90, align: "right" });
    y += 30;

    doc.fillColor("#6B7280").font("Helvetica").fontSize(9);
    doc.text("¡Gracias por confiar en nosotros!", M, y);
    doc.text("Seguinos: instagram.com/taller_system", M, y + 14);

    doc.end();
  } catch (e) {
    console.error("GET /facturas/:id/pdf", e);
    fail(res, "Error generando PDF", 500);
  }
});

/*Pagos*/
app.get("/api/facturas/:id/pagos", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT idPago AS id, DATE_FORMAT(fecha,'%Y-%m-%d') AS fecha, monto, medio
          FROM pagos WHERE idFactura=? ORDER BY idPago ASC`,
      [id]
    );
    ok(res, rows);
  } catch (e) {
    console.error("GET /facturas/:id/pagos", e);
    fail(res, "Error listando pagos", 500);
  }
});

app.post("/api/facturas/:id/pagos", async (req, res) => {
  const { id } = req.params;
  let { fecha, monto, medio } = req.body || {};
  fecha = normFecha(fecha);
  monto = nnInt(monto);
  medio = nn(medio);
  if (!fecha || !monto || !medio) return fail(res, "Faltan datos del pago");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO pagos (idFactura, fecha, monto, medio) VALUES (?,?,?,?)`,
      [id, fecha, monto, medio]
    );

    const [[ft]] = await conn.query(`SELECT total, estado FROM facturas WHERE idFactura=?`, [id]);
    const [[sp]] = await conn.query(`SELECT COALESCE(SUM(monto),0) AS pagado FROM pagos WHERE idFactura=?`, [id]);
    if (Number(sp.pagado) >= Number(ft.total) && ft.estado !== 'pagada') {
      await conn.query(`UPDATE facturas SET estado='pagada' WHERE idFactura=?`, [id]);
    }

    await conn.commit();
    ok(res, { inserted: true });
  } catch (e) {
    await conn.rollback();
    console.error("POST /facturas/:id/pagos", e);
    fail(res, e.sqlMessage || "Error registrando pago", 500);
  } finally {
    conn.release();
  }
});

/*NUEVO: Marcar como terminado*/
app.post("/api/facturas/:id/terminar", async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    const [[f]] = await conn.query(
      `SELECT f.idFactura, f.estado, f.idVehiculo, v.patente
          FROM facturas f
          JOIN vehiculo v ON v.idVehiculo = f.idVehiculo
        WHERE f.idFactura=? LIMIT 1`,
      [id]
    );
    if (!f) { conn.release(); return fail(res, "Factura no encontrada", 404); }
    if (f.estado !== "pagada") { conn.release(); return fail(res, "La factura aún no está pagada", 409); }

    const [[ya]] = await conn.query(
      `SELECT idTrabajo FROM trabajos
        WHERE idVehiculo=? AND descripcion LIKE 'Terminado%' LIMIT 1`,
      [f.idVehiculo]
    );
    if (ya?.idTrabajo) { conn.release(); return ok(res, { already: true }); }

    await conn.query(
      `INSERT INTO trabajos (fecha, descripcion, costoMO, idUsuario, idVehiculo)
        VALUES (CURDATE(), ?, 0, NULL, ?)`,
      [`Terminado - ${f.patente || "Vehículo"}`, f.idVehiculo]
    );

    conn.release();
    ok(res, { terminado: true });
  } catch (e) {
    conn.release();
    console.error("POST /facturas/:id/terminar", e);
    fail(res, "Error marcando como terminado", 500);
  }
});

/*REGISTRO DE USUARIOS*/
app.post("/api/usuarios/registrar", async (req, res) => {
  try {
    let { nombre, usuario, contrasena, rol } = req.body || {};
    if(!nombre || !usuario || !contrasena) return fail(res, "Faltan datos");
    rol = (rol||"empleado").toLowerCase();
    if(!["dueño","empleado"].includes(rol)) rol = "empleado";

    const [[ex]] = await pool.query(
      `SELECT idUsuario FROM usuarios WHERE usuario=? LIMIT 1`,
      [usuario]
    );
    if(ex?.idUsuario) return fail(res, "El usuario ya existe", 409);

    await pool.query(
      `INSERT INTO usuarios (nombre, usuario, \`contraseña\`, rol)
        VALUES (?,?,?,?)`,
      [nombre, usuario, contrasena, rol]
    );

    ok(res, { creado: true });
  } catch (e) {
    console.error("POST /usuarios/registrar", e);
    fail(res, e.sqlMessage || "Error creando usuario", 500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API escuchando en http://localhost:${PORT}`));
