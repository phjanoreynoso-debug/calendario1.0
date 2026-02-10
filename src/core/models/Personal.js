export class Personal {
    constructor(data = {}) {
        this.id = data.id || crypto.randomUUID();
        this.nombre = data.nombre || '';
        this.apellido = data.apellido || '';
        this.dni = data.dni || '';
        this.legajo = data.legajo || '';
        this.fechaIngreso = data.fechaIngreso || '';
        this.email = data.email || '';
        this.telefono = data.telefono || '';
        this.modalidadTrabajo = data.modalidadTrabajo || 'semana'; // 'semana' | 'sadofe'
        this.turnoPreferente = data.turnoPreferente || 'manana';
        this.color = data.color || '#3b82f6';
        this.diasVacaciones = Number(data.diasVacaciones) || 0;
        this.diasEstres = Number(data.diasEstres) || 0;
        this.workSchedule = data.workSchedule || {}; 
        this.active = data.active !== false; // Default true
    }
}
