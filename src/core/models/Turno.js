export class Turno {
    constructor(data = {}) {
        this.tipo = data.tipo || 'vacio';
        this.horaEntrada = data.horaEntrada || '';
        this.horaSalida = data.horaSalida || '';
        this.observaciones = data.observaciones || '';
        
        // Conditional fields
        if (data.fechaInicio) this.fechaInicio = data.fechaInicio;
        if (data.fechaFin) this.fechaFin = data.fechaFin;
        if (data.fechaInicioCarpeta) this.fechaInicioCarpeta = data.fechaInicioCarpeta;
        if (data.fechaAlta) this.fechaAlta = data.fechaAlta;

        // Compensatorio specific
        if (data.fechaTrabajoRealizado) this.fechaTrabajoRealizado = data.fechaTrabajoRealizado;
        
        // Guardia specific
        if (data.compensatorioGenerado !== undefined) this.compensatorioGenerado = Number(data.compensatorioGenerado);
        if (data.horasExtras !== undefined) this.horasExtras = Number(data.horasExtras);
        
        // Cambios Guardia specific
        if (data.companeroCambio) this.companeroCambio = data.companeroCambio;
        if (data.fechaDevolucion) this.fechaDevolucion = data.fechaDevolucion;
        if (data.fechaCambio) this.fechaCambio = data.fechaCambio;
        if (data.rolCG) this.rolCG = data.rolCG;
        
        // Motivo (ausencia)
        if (data.motivo) this.motivo = data.motivo;
    }
}
