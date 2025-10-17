-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: taller_system
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clientes` (
  `idCliente` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `email` varchar(120) DEFAULT NULL,
  PRIMARY KEY (`idCliente`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clientes`
--

LOCK TABLES `clientes` WRITE;
/*!40000 ALTER TABLE `clientes` DISABLE KEYS */;
INSERT INTO `clientes` VALUES (1,'facundo','3416485537','fa@gmail.com');
/*!40000 ALTER TABLE `clientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `eventos`
--

DROP TABLE IF EXISTS `eventos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `eventos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fecha` date NOT NULL,
  `texto` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_evento_fecha` (`fecha`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `eventos`
--

LOCK TABLES `eventos` WRITE;
/*!40000 ALTER TABLE `eventos` DISABLE KEYS */;
INSERT INTO `eventos` VALUES (1,'2025-10-01','peugeot 308');
/*!40000 ALTER TABLE `eventos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `factura_detalle`
--

DROP TABLE IF EXISTS `factura_detalle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `factura_detalle` (
  `idDetalle` int(11) NOT NULL AUTO_INCREMENT,
  `idFactura` int(11) NOT NULL,
  `concepto` varchar(255) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `precioUnitario` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total` decimal(14,2) GENERATED ALWAYS AS (`cantidad` * `precioUnitario`) STORED,
  PRIMARY KEY (`idDetalle`),
  KEY `idx_fd_factura` (`idFactura`),
  CONSTRAINT `fk_fd_fac` FOREIGN KEY (`idFactura`) REFERENCES `facturas` (`idFactura`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `factura_detalle`
--

LOCK TABLES `factura_detalle` WRITE;
/*!40000 ALTER TABLE `factura_detalle` DISABLE KEYS */;
INSERT INTO `factura_detalle` (`idDetalle`, `idFactura`, `concepto`, `cantidad`, `precioUnitario`) VALUES (1,1,'Mano de obra - cambio de aceite',1,10000.00),(2,1,'Repuesto: aceite',1,30000.00);
/*!40000 ALTER TABLE `factura_detalle` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `facturas`
--

DROP TABLE IF EXISTS `facturas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `facturas` (
  `idFactura` int(11) NOT NULL AUTO_INCREMENT,
  `fechaEmision` date NOT NULL,
  `idVehiculo` int(11) NOT NULL,
  `estado` enum('emitida','pagada') NOT NULL DEFAULT 'emitida',
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`idFactura`),
  KEY `idx_fac_veh` (`idVehiculo`),
  CONSTRAINT `fk_fac_veh` FOREIGN KEY (`idVehiculo`) REFERENCES `vehiculo` (`idVehiculo`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `facturas`
--

LOCK TABLES `facturas` WRITE;
/*!40000 ALTER TABLE `facturas` DISABLE KEYS */;
INSERT INTO `facturas` VALUES (1,'2025-10-16',1,'pagada',40000.00);
/*!40000 ALTER TABLE `facturas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pagos`
--

DROP TABLE IF EXISTS `pagos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pagos` (
  `idPago` int(11) NOT NULL AUTO_INCREMENT,
  `idFactura` int(11) NOT NULL,
  `fecha` date NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `medio` varchar(40) DEFAULT NULL,
  PRIMARY KEY (`idPago`),
  KEY `fk_pagos_facturas` (`idFactura`),
  CONSTRAINT `fk_pagos_facturas` FOREIGN KEY (`idFactura`) REFERENCES `facturas` (`idFactura`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pagos`
--

LOCK TABLES `pagos` WRITE;
/*!40000 ALTER TABLE `pagos` DISABLE KEYS */;
INSERT INTO `pagos` VALUES (1,1,'2025-10-17',40000.00,'efectivo');
/*!40000 ALTER TABLE `pagos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `repuestos`
--

DROP TABLE IF EXISTS `repuestos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `repuestos` (
  `idRepuesto` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `precioLista` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`idRepuesto`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `repuestos`
--

LOCK TABLES `repuestos` WRITE;
/*!40000 ALTER TABLE `repuestos` DISABLE KEYS */;
INSERT INTO `repuestos` VALUES (1,'aceite',30000.00);
/*!40000 ALTER TABLE `repuestos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trabajo_repuestos`
--

DROP TABLE IF EXISTS `trabajo_repuestos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trabajo_repuestos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idTrabajo` int(11) NOT NULL,
  `idRepuesto` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `precioUnitario` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `fk_trrep_trab` (`idTrabajo`),
  KEY `fk_trrep_rep` (`idRepuesto`),
  CONSTRAINT `fk_trrep_rep` FOREIGN KEY (`idRepuesto`) REFERENCES `repuestos` (`idRepuesto`) ON UPDATE CASCADE,
  CONSTRAINT `fk_trrep_trab` FOREIGN KEY (`idTrabajo`) REFERENCES `trabajos` (`idTrabajo`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trabajo_repuestos`
--

LOCK TABLES `trabajo_repuestos` WRITE;
/*!40000 ALTER TABLE `trabajo_repuestos` DISABLE KEYS */;
INSERT INTO `trabajo_repuestos` VALUES (1,1,1,1,30000.00);
/*!40000 ALTER TABLE `trabajo_repuestos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trabajos`
--

DROP TABLE IF EXISTS `trabajos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trabajos` (
  `idTrabajo` int(11) NOT NULL AUTO_INCREMENT,
  `fecha` date NOT NULL,
  `descripcion` varchar(255) NOT NULL,
  `costoMO` decimal(12,2) NOT NULL DEFAULT 0.00,
  `idUsuario` int(11) DEFAULT NULL,
  `idVehiculo` int(11) NOT NULL,
  PRIMARY KEY (`idTrabajo`),
  KEY `fk_trab_veh` (`idVehiculo`),
  CONSTRAINT `fk_trab_veh` FOREIGN KEY (`idVehiculo`) REFERENCES `vehiculo` (`idVehiculo`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trabajos`
--

LOCK TABLES `trabajos` WRITE;
/*!40000 ALTER TABLE `trabajos` DISABLE KEYS */;
INSERT INTO `trabajos` VALUES (1,'2025-10-16','cambio de aceite',10000.00,NULL,1),(2,'2025-10-16','Terminado - dada',0.00,NULL,1);
/*!40000 ALTER TABLE `trabajos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `idUsuario` int(11) NOT NULL AUTO_INCREMENT,
  `usuario` varchar(50) NOT NULL,
  `contraseña` varchar(100) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `rol` enum('dueño','empleado') NOT NULL DEFAULT 'empleado',
  PRIMARY KEY (`idUsuario`),
  UNIQUE KEY `usuario` (`usuario`),
  UNIQUE KEY `uq_usuarios_usuario` (`usuario`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,'dueno','1234','Dueño','dueño'),(2,'empleado','1234','Empleado','empleado'),(4,'ftrik','1234','trik','empleado'),(5,'jcala','1234','cala','empleado'),(6,'ani','1234','anibal','dueño');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehiculo`
--

DROP TABLE IF EXISTS `vehiculo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehiculo` (
  `idVehiculo` int(11) NOT NULL AUTO_INCREMENT,
  `patente` varchar(20) NOT NULL,
  `marca` varchar(80) DEFAULT NULL,
  `modelo` varchar(80) NOT NULL,
  `año` int(11) DEFAULT NULL,
  `color` varchar(40) DEFAULT NULL,
  `fechaIngreso` date DEFAULT NULL,
  `fechaEntrega` date DEFAULT NULL,
  `preAnalisis` varchar(255) DEFAULT NULL,
  `idCliente` int(11) DEFAULT NULL,
  PRIMARY KEY (`idVehiculo`),
  UNIQUE KEY `uq_vehiculo_patente` (`patente`),
  KEY `fk_vehiculo_cliente` (`idCliente`),
  CONSTRAINT `fk_vehiculo_cliente` FOREIGN KEY (`idCliente`) REFERENCES `clientes` (`idCliente`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehiculo`
--

LOCK TABLES `vehiculo` WRITE;
/*!40000 ALTER TABLE `vehiculo` DISABLE KEYS */;
INSERT INTO `vehiculo` VALUES (1,'dada','dada','dada',3232,'dada','2025-10-16','2025-10-17','cambio de aceite',1);
/*!40000 ALTER TABLE `vehiculo` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-16 22:58:08
