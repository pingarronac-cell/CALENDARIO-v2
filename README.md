# Calendario de Producción · Ferralia v4
## Piera & Viladecans

---

## Contenido del paquete

```
transportes_v4/
  ├── start.bat          ← Doble clic para arrancar
  ├── server.js          ← Servidor
  ├── database.json      ← Base de datos (se crea automáticamente)
  ├── obras_data.json    ← Obras importadas de Gotel (237 obras)
  ├── public/
  │   └── index.html     ← Aplicación web
  └── README.md          ← Este archivo
```

---

## Instalación en tu portátil (para probar)

### Paso 1 — Instalar Node.js
1. Ve a https://nodejs.org
2. Descarga el instalador **Windows (.msi) — versión LTS**
3. Instálalo: siguiente → siguiente → finalizar

### Paso 2 — Arrancar
1. Doble clic en `start.bat`
2. Verás una ventana negra con el servidor en marcha
3. Abre el navegador: **http://localhost:3000**

---

## Instalación en el servidor de la empresa

1. Instala Node.js en el servidor (igual que arriba)
2. Copia la carpeta `transportes_v4/` en tu carpeta del servidor
3. Doble clic en `start.bat` desde el servidor
4. Todos acceden desde el navegador: **http://[IP-SERVIDOR]:3000**

### Para que arranque automáticamente con Windows:
1. Pulsa `Win + R` → escribe `shell:startup` → Enter
2. Crea un acceso directo de `start.bat` en esa carpeta

---

## Usuarios y PINs iniciales

| Nombre           | Rol           | PIN inicial |
|------------------|---------------|-------------|
| ALBERTO          | Admin         | admin123    |
| JORDI PEDROSA    | Admin         | admin123    |
| ANGEL BORDONADA  | Técnico       | 0000        |
| ASIEL CARMONA    | Técnico       | 0000        |
| CRISTINA         | Técnico       | 0000        |
| GALO             | Técnico       | 0000        |
| GREGORY LAMOTHE  | Técnico       | 0000        |
| JOAN LLADOS      | Técnico       | 0000        |
| JORDI CASTILLO   | Técnico       | 0000        |
| RAUL MORIANO     | Técnico       | 0000        |
| ROSA             | Técnico       | 0000        |
| CARLOS           | Enc. Taller   | 0000        |
| ANDRIY           | Enc. Taller   | 0000        |
| ANTONIO          | Enc. Taller   | 0000        |
| ROBERTO          | Enc. Taller   | 0000        |

**Cada usuario debe cambiar su PIN al entrar por primera vez**
(icono de usuario arriba a la derecha → Cambiar PIN)

**Si un técnico olvida su PIN:** un admin lo resetea desde ⚙️ Ajustes → Usuarios → Resetear PIN

---

## Permisos por rol

| Acción                              | Admin | Técnico | Enc. Taller |
|-------------------------------------|-------|---------|-------------|
| Ver calendario                      |  ✅   |   ✅    |     ✅      |
| Crear pedido                        |  ✅   |   ✅    |     ❌      |
| Editar datos del pedido             |  ✅   |   ❌    |     ❌      |
| Eliminar pedido                     |  ✅   |   ❌    |     ❌      |
| Mover pedido (drag & drop)          |  ✅   |   ❌    |     ❌      |
| Cambiar fecha del pedido            |  ✅   |   ❌    |     ❌      |
| Estado: Planificado/Aprobado/Impreso|  ✅   |   ✅    |     ❌      |
| Estado: En producción/Acabado/Ruta  |  ✅   |   ❌    |     ✅      |
| Añadir observaciones                |  ✅   |   ✅    |     ✅      |
| Superar capacidad de producción     |  ✅   |   ❌    |     ❌      |
| Gestionar usuarios/listas/capacidad |  ✅   |   ❌    |     ❌      |

---

## Estados del pedido

| Estado         | Quién lo pone             | Color    |
|----------------|---------------------------|----------|
| 📋 Planificado  | Técnico / Admin           | Gris     |
| ✅ Aprobado     | Técnico / Admin           | Morado   |
| 🖨️ Impreso      | Técnico / Admin           | Amarillo |
| ⚙️ En producción| Enc. Taller / Admin       | Azul     |
| ✔️ Acabado      | Enc. Taller / Admin       | Verde    |
| 🚛 En ruta      | Enc. Taller / Admin       | Cyan     |

---

## Capacidad de producción

- Los admins definen los **KG máximos por día** para cada planta (Elaborado y Soldado por separado)
- Se configura en ⚙️ Ajustes → Capacidad
- Si un técnico supera el límite, se **bloquea** y se muestran días alternativos disponibles
- Un admin puede superar el límite previa confirmación

---

## Festivos

- Se configuran por planta en ⚙️ Ajustes → Festivos
- Los días festivos aparecen en rojo y nadie puede añadir pedidos

---

## Obras

- Las 237 obras activas de Gotel ya están cargadas
- Se pueden añadir manualmente en ⚙️ Ajustes → Obras
- Próximamente: importación directa desde Excel de Gotel

---

## Navegación

- **Flechas** Anterior / Siguiente para cambiar de semana
- **Scroll vertical** del ratón sobre el calendario para cambiar de semana
- **Buscador** (lupa arriba a la derecha) para encontrar un pedido por número
