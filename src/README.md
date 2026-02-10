# Arquitectura Modular del Proyecto Calendario 2026

Este proyecto ha sido reestructurado siguiendo principios SOLID y una arquitectura modular para facilitar el mantenimiento y la escalabilidad.

## Estructura de Directorios

- `src/core/models/`: Definiciones de estructuras de datos (Personal, Turno).
- `src/core/services/`: Lógica de negocio y acceso a datos (StorageService).
- `src/ui/controllers/`: Controladores de interfaz de usuario (ReportController).
- `src/ui/components/`: Componentes visuales reutilizables (HTML/CSS).
- `src/utils/`: Funciones de utilidad puras (DateUtils, StringUtils).
- `src/config/`: Configuración centralizada (AppConfig).

## Módulos

### Utils
Funciones puras sin dependencias de estado.
- `DateUtils.js`: Manejo de fechas (parseo local, formato).
- `StringUtils.js`: Sanitización de cadenas.

### Core
Lógica central de la aplicación.
- `StorageService.js`: Capa de abstracción sobre LocalStorage. Implementa el patrón Repository para Personal, Turnos, y Configuración.
- `models/`: Clases ES6 que definen la forma de los datos.

### UI
Lógica de presentación.
- `ReportController.js`: Lógica para la generación y visualización de reportes. Desacoplada del DOM global tanto como sea posible.

## Migración

Para continuar con la migración desde `app.js`:
1.  Identificar una funcionalidad aislada.
2.  Crear el Modelo correspondiente en `src/core/models`.
3.  Crear/Actualizar el Servicio en `src/core/services`.
4.  Crear el Controlador en `src/ui/controllers`.
5.  Reemplazar la lógica en `app.js` importando el módulo (o refactorizar `app.js` para ser un punto de entrada modular).

## Tests

Se recomienda agregar pruebas unitarias en `tests/` para cada módulo nuevo.
