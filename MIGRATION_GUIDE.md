# Guía de Migración a Arquitectura Modular

Esta guía detalla los pasos para continuar la migración del código monolítico (`app.js`) a la nueva arquitectura modular en `src/`.

## Estado Actual
Se ha establecido la infraestructura base:
- **Modelos**: `src/core/models/` (Personal, Turno)
- **Servicios**: `src/core/services/` (StorageService para persistencia)
- **Utilidades**: `src/utils/` (DateUtils, StringUtils)
- **Configuración**: `src/config/` (AppConfig)
- **Controladores**: `src/ui/controllers/` (ReportController como ejemplo)
- **Tests**: `tests/integration_test.js` verifica que los módulos funcionen juntos.

## Pasos Siguientes

### 1. Migración de Utilidades
Reemplazar las funciones globales en `app.js` con importaciones de `src/utils/`.
*Acción*: En futuras versiones modulares, importar `parseDateLocal`, `formatDate` desde `DateUtils`.

### 2. Migración de Lógica de Negocio (Servicios)
Crear servicios específicos para lógica compleja:
- `TurnoService.js`: Lógica de validación de turnos, creación de rangos, cálculo de horas.
- `HolidayService.js`: Lógica de feriados.

### 3. Migración de UI (Controladores y Componentes)
Dividir el manejo de eventos de `app.js` en controladores:
- `CalendarController.js`: Renderizado del calendario y navegación.
- `FormController.js`: Validación y envío de formularios (Turnos, Personal).

### 4. Punto de Entrada (Main)
Crear un `src/main.js` que inicialice la aplicación importando los controladores necesarios y asignando los eventos al DOM.

## Ejemplo de Uso
Ver `tests/integration_test.js` para entender cómo instanciar los modelos y usar el servicio de almacenamiento.

## Ejecución de Tests
Para verificar la integridad de los módulos:
```bash
node tests/integration_test.js
```
