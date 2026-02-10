# Documentación del Flujo de Compensatorios

Este documento describe el funcionamiento del sistema de gestión de días compensatorios en la aplicación.

## Conceptos Básicos

El sistema mantiene un saldo de días compensatorios para cada personal ("Comp. a favor"). Este saldo se calcula en tiempo real basándose en dos tipos de eventos:
1.  **Generación**: Cuando se carga una Guardia Fija en fin de semana o feriado.
2.  **Uso**: Cuando se asigna un turno de tipo Compensatorio.

**Fórmula:** `Saldo = Total Generados - Total Usados`

## Flujo de Trabajo

### 1. Generación de Compensatorios
Para otorgar días compensatorios a un personal:
1.  Abra el modal para asignar un turno.
2.  Seleccione el tipo de turno **"Guardia (G)"**.
3.  Seleccione una fecha que sea **Sábado, Domingo o Feriado**.
4.  El sistema habilitará automáticamente el checkbox **"Genera día compensatorio"**.
5.  Marque el checkbox.
6.  Indique la cantidad de días a generar (por defecto 1, pero puede ser 0.5 o más).
7.  Guarde el turno.

> **Nota:** El sistema valida que la fecha corresponda a un fin de semana o feriado registrado. Si no cumple esta condición, la opción aparecerá deshabilitada.

### 2. Uso de Compensatorios
Para descontar días del saldo (cuando el personal se toma el día):
1.  Abra el modal para asignar un turno en la fecha que el personal no trabajará.
2.  Seleccione el tipo de turno **"Compensatorio (CP)"**.
3.  El sistema verificará automáticamente el **saldo disponible**.
    *   Si el saldo es menor a 1 día, **no permitirá guardar el turno** y mostrará un mensaje de error.
4.  Seleccione la **"Fecha del Día Realizado"** desde el desplegable. Esto vincula el uso con el día que generó el crédito (opcional pero recomendado para trazabilidad).
5.  Guarde el turno.
6.  El saldo se descontará automáticamente en 1 unidad.

### 3. Visualización de Saldos
El saldo actual se puede consultar en:
*   **Modal de Turno**: Al seleccionar "Compensatorio" o "Guardia", se muestra el saldo disponible en tiempo real.
*   **Reportes**: En el modal "Reporte de Horas", la columna **"Comp. a favor"** muestra el saldo neto disponible.

### 4. Historial y Auditoría
Para ver el detalle de movimientos:
1.  Abra el modal de Reportes (botón "Reportes" en el menú).
2.  Haga clic en el número de la columna "Comp. a favor" o "Comp. Usados".
3.  Se desplegará un historial detallado en formato de árbol:
    *   **Generados (Verde)**: Muestra la fecha y cantidad generada.
    *   **Usados (Rojo)**: Muestra cuándo se tomó el día.

### 5. Reseteo de Saldos (Solo Administradores)
En casos excepcionales (ej. cambio de año fiscal, pago de días adeudados), el administrador puede resetear el saldo a cero:
1.  Abra el modal de Reportes.
2.  Haga clic en el **nombre del personal** (resaltado en azul).
3.  Confirme la acción en el cuadro de diálogo.
4.  Esto establecerá una "Fecha de Corte". Todos los movimientos anteriores a esa fecha dejarán de sumar/restar al saldo actual, aunque permanecerán en el calendario histórico.
5.  Los ítems reseteados aparecerán con la etiqueta `(Reset)` en el historial.

## Validaciones del Sistema
*   **Saldos Negativos**: El sistema impide terminantemente operaciones que resulten en un saldo negativo.
*   **Edición**: Si edita un turno compensatorio existente, el sistema considera ese día como disponible para la validación (evitando bloqueos al modificar detalles).
