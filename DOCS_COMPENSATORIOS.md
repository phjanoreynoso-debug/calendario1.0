# Documentación de Lógica de Compensatorios

## Objetivo
Gestionar la generación de días compensatorios para turnos de tipo "Guardia Fija". Anteriormente restringido a fines de semana y feriados, **ahora se permite la generación en cualquier día (incluidos días hábiles)** a discreción del usuario.

## Lógica de Decisión

El checkbox "Genera día compensatorio" está **siempre habilitado** para turnos de Guardia Fija, independientemente de la fecha seleccionada.

El sistema identifica y notifica el tipo de día:

1. **Fin de Semana**: Sábado o Domingo.
2. **Feriado**: Fecha registrada en la lista de feriados.
3. **Día Hábil**: Cualquier otro día (Lunes a Viernes no feriado).

## Comportamiento del Sistema

### 1. Estado Inicial (Default)
- Al abrir el modal para un nuevo turno, el checkbox aparece **siempre habilitado**.
- El usuario decide manualmente si corresponde generar compensatorio marcando la casilla.

### 2. Edición de Turnos
- Se mantiene el estado guardado del turno.
- El usuario puede modificar la generación de compensatorio en cualquier momento.

### 3. Indicadores Visuales
El texto junto al checkbox cambia según el tipo de día para dar contexto:
- **Fin de Semana**: "Genera día compensatorio (Fin de semana)" (Texto Verde)
- **Feriado**: "Genera día compensatorio (Feriado)" (Texto Verde)
- **Día Hábil**: "Genera día compensatorio (Día hábil)" (Texto Verde)

## Implementación Técnica
- **Archivo**: `app.js`
- **Función Principal**: `updateCompensatoryCheckboxState()`
- **Validación**: No hay bloqueo lógico. Se confía en la entrada del usuario.
- **Persistencia**: El valor se guarda en `turno.compensatorioGenerado`.
