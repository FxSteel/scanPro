# DeliveryExpress - Notas del Proyecto

## Descripcion General

Aplicacion movil para **DeliveryExpress**, empresa de delivery/courier.
Permite escanear encomiendas de Mercado Libre, Falabella, Ripley y cualquier tienda que genere QRs con direcciones de envio.

## Respuestas del Cliente

### Operacion actual
- Manejan todo con **Excel**
- Procesan **~200 paquetes/dia**
- Tienen **6 conductores**

### Escaneo
- Los QR de las tiendas traen **datos completos**
- Escanean en **multiples ubicaciones** (no solo bodega)

### Rutas y comunas
- Solo **Region Metropolitana**
- **34 comunas + Colina y Padre Hurtado**
- Zonas/comunas **ya las tienen definidas** (pendiente confirmar el detalle de agrupacion)
- Usan **SimpliRoute o Beetrack** actualmente

### Usuarios y roles
- **Conductores** (6) + **1 administrador**
- Admin necesita acceso desde **celular y PC** (panel web necesario)

### Entrega y confirmacion
- Datos al confirmar: **Foto + nombre de quien recibe + RUT** (RUT opcional por temas de seguridad)
- GPS al entregar: **por definir** (recomendamos incluirlo, es trivial con Expo)
- Notificaciones al cliente final: **No**

### Prioridad y plazos
- MVP: todo lo mencionado en las funcionalidades principales
- Fecha objetivo: **~1 Junio o 1 Julio 2026**
- Dispositivos conductores: **principalmente Android**

## Arquitectura Definida

| Capa | Tecnologia |
|------|-----------|
| Frontend movil | React Native (Expo) |
| Backend/DB | Supabase (Auth + PostgreSQL + Storage) |
| Escaneo QR | expo-camera / expo-barcode-scanner |
| Fotos de entrega | expo-image-picker + Supabase Storage |
| GPS | expo-location |
| Panel admin web | React (Expo Web o app separada) |
| Integracion rutas | API REST hacia SimpliRoute (prioridad) |

## Estructura de DB

- `users` - conductores y admin (rol, nombre, email, telefono)
- `packages` - paquetes escaneados (direccion, comuna, estado, tienda_origen, qr_data, conductor_asignado)
- `routes` - rutas agrupadas por comuna/zona (conductor, fecha, estado)
- `delivery_confirmations` - foto_url, timestamp, gps_location, nombre_receptor, rut_receptor
- `zones` - definicion de zonas con sus comunas asignadas

## MVP - Alcance Propuesto

### Fase 1 - Core (Semanas 1-2)
1. **Setup proyecto** - Expo + Supabase + Auth basico
2. **Escaneo QR** - Leer QR y extraer datos del paquete
3. **Registro de paquetes** - Guardar en DB con direccion, comuna, tienda
4. **Lista de paquetes** - Ver paquetes escaneados con filtros basicos

### Fase 2 - Rutas y asignacion (Semanas 3-4)
5. **Agrupacion por zona/comuna** - Agrupar paquetes por las zonas definidas
6. **Asignacion a conductor** - Admin asigna paquetes/rutas a conductores
7. **Vista conductor** - Conductor ve sus paquetes asignados del dia
8. **Estados de paquete** - En bodega > En reparto > Entregado

### Fase 3 - Entrega y confirmacion (Semanas 5-6)
9. **Confirmacion de entrega** - Foto + nombre receptor + RUT opcional
10. **GPS de entrega** - Capturar ubicacion al confirmar
11. **Historial** - Ver entregas realizadas

### Fase 4 - Admin y extras (Semanas 7-8)
12. **Panel web admin** - Dashboard basico para ver/gestionar rutas y paquetes
13. **Integracion SimpliRoute** - Exportar rutas a SimpliRoute
14. **Reportes basicos** - Paquetes por dia, por conductor, por estado

## Puntos Pendientes por Confirmar

1. Detalle de como agrupan las 34+2 comunas en zonas/rutas
2. SimpliRoute vs Beetrack: cual priorizamos para integracion
3. Formato exacto de los datos en los QR de cada tienda (ML, Falabella, Ripley)
4. Si el panel web admin entra en MVP o se posterga

## Costos

### Fase 1 - MVP (Desarrollo + Testing): $0
- Supabase Free, Expo Free, herramientas de desarrollo gratuitas

### Fase 2 - Publicacion Android: $25 unico
- Google Play registro

### Fase 3 - Produccion (mensual): ~$133-153/mes
- Supabase Pro: $25/mes
- SimpliRoute/Beetrack: variable segun plan
- Google Maps API: ~$0-20/mes

## Estado

- [x] Definicion del proyecto
- [x] Arquitectura propuesta
- [x] Tabla de costos
- [x] Preguntas para el cliente enviadas
- [x] Respuestas del cliente recibidas
- [x] Definicion del MVP
- [ ] Confirmar puntos pendientes
- [ ] Inicio del desarrollo
