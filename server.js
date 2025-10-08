import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

// Cargar variables del .env
dotenv.config();

// Inicializar app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // sirve los archivos del frontend

// Conexión a MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4_general_ci"
});

// Helpers
const ok = (res, data) => res.json({ ok: true, data });
const fail = (res, msg, code = 400) => res.status(code).json({ ok: false, msg });

// Ruta de prueba
app.post("/api/login", async (req, res) => {
    const { usuario, contrasena } = req.body;
    if (!usuario || !contrasena) return fail(res, "Faltan datos");
    try {
    const [rows] = await pool.query(
        `SELECT idUsuario AS id, usuario AS nombre, rol
        FROM usuarios
        WHERE usuario=? AND \`contraseña\`=?
        LIMIT 1`,
        [usuario, contrasena]
    );
    if (!rows.length) return fail(res, "Credenciales inválidas", 401);
    ok(res, rows[0]);
    } catch (e) { console.error(e); fail(res, "Error de servidor", 500); }
});

// Listar vehículos
app.get("/api/vehiculos", async (_req, res) => {
    try {
    const [rows] = await pool.query(`
        SELECT idVehiculo AS id, patente, modelo, idCliente
        FROM vehiculo
        ORDER BY idVehiculo DESC
    `);
    ok(res, rows);
    } catch (e) {
    console.error(e);
    fail(res, "Error listando vehículos", 500);
    }
});

// Crear vehículo
app.post("/api/vehiculos", async (req, res) => {
    const { patente, modelo, idCliente } = req.body;
    if (!patente || !modelo) return fail(res, "Patente y modelo son obligatorios");
    try {
    const [r] = await pool.query(
        "INSERT INTO vehiculo (patente, modelo, idCliente) VALUES (?,?,?)",
        [patente, modelo, idCliente ?? null]
    );
    ok(res, { id: r.insertId });
    } catch (e) {
    console.error(e);
    fail(res, "Error creando vehículo", 500);
    }
});

// Actualizar vehículo
app.put("/api/vehiculos/:id", async (req, res) => {
    const { id } = req.params;
    const { patente, modelo, idCliente } = req.body;
    try {
    const [r] = await pool.query(
        "UPDATE vehiculo SET patente=?, modelo=?, idCliente=? WHERE idVehiculo=?",
        [patente, modelo, idCliente ?? null, id]
    );
    ok(res, { changed: r.affectedRows });
    } catch (e) {
    console.error(e);
    fail(res, "Error actualizando vehículo", 500);
    }
});

// Eliminar vehículo
app.delete("/api/vehiculos/:id", async (req, res) => {
    const { id } = req.params;
    try {
    const [r] = await pool.query("DELETE FROM vehiculo WHERE idVehiculo=?", [id]);
    ok(res, { deleted: r.affectedRows });
    } catch (e) {
    console.error(e);
    fail(res, "Error eliminando vehículo", 500);
    }
});

// Eventos del calendario
app.get("/api/eventos/:anio/:mes", async (req, res) => {
    const { anio, mes } = req.params;
    try {
    const [rows] = await pool.query(
        "SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, texto FROM eventos WHERE YEAR(fecha)=? AND MONTH(fecha)=? ORDER BY fecha",
        [anio, mes]
    );
    ok(res, rows);
    } catch (e) {
    console.error(e);
    fail(res, "Error cargando eventos", 500);
    }
});

// Facturación total
app.get("/api/facturacion/total", async (_req, res) => {
    try {
    const [rows] = await pool.query(`
      SELECT COALESCE(NULLIF(SUM(fd.total), 0), SUM(fd.precioUnitario * fd.cantidad)) AS total
        FROM factura_detalle fd
    `);
    ok(res, rows[0]);
    } catch (e) {
    console.error(e);
    fail(res, "Error facturación", 500);
    }
});

// Historial
app.get("/api/historial", async (_req, res) => {
    try {
    const [rows] = await pool.query(`
        SELECT t.idTrabajo AS id, DATE_FORMAT(t.fecha, '%Y-%m-%d') AS fecha, v.patente AS patente, t.descripcion AS descripcion
        FROM trabajos t
        JOIN vehiculo v ON v.idVehiculo = t.idVehiculo
        ORDER BY t.fecha DESC
        LIMIT 50
    `);
    ok(res, rows);
    } catch (e) {
    console.error(e);
    fail(res, "Error historial", 500);
    }
    });

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API escuchando en http://localhost:${PORT}`));
