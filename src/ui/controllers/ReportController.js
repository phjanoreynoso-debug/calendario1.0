import { StorageService } from '../../core/services/StorageService.js';
import { parseDateLocal } from '../../utils/DateUtils.js';

function timeStrToMinutes(t) {
    if (!t || typeof t !== 'string') return null;
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

export class ReportController {
    constructor() {
        this.personal = StorageService.getPersonal();
        this.turnos = StorageService.getTurnos();
    }

    renderReports(tbodyElement, yearSelectElement, searchInputElement) {
        if (!tbodyElement) return;
        tbodyElement.innerHTML = '';
        
        const selectedYear = yearSelectElement ? parseInt(yearSelectElement.value, 10) : new Date().getFullYear();
        const searchTerm = searchInputElement ? searchInputElement.value.toLowerCase() : '';
        
        if (!this.personal || this.personal.length === 0) {
            tbodyElement.innerHTML = '<tr><td colspan="5">No hay personal registrado.</td></tr>';
            return;
        }

        this.personal.forEach(p => {
            const fullName = (p.nombre + ' ' + p.apellido).toLowerCase();
            if (searchTerm && !fullName.includes(searchTerm)) return;
            
            let horasExtras = 0;
            let compGenerado = 0;
            let compUsado = 0;
            let lateCount = 0;
            let lateMinutes = 0;
            let earlyCount = 0;
            let earlyMinutes = 0;
            
            Object.keys(this.turnos).forEach(dateStr => {
                const date = parseDateLocal(dateStr);
                if (!date || date.getFullYear() !== selectedYear) return;
                
                const t = this.turnos[dateStr][p.id];
                if (t) {
                    if (t.horasExtras) {
                        horasExtras += parseFloat(t.horasExtras) || 0;
                    }
                    if (t.compensatorioGenerado) {
                        compGenerado += parseFloat(t.compensatorioGenerado) || 0;
                    }
                    if (t.tipo === 'compensatorio') {
                        compUsado += 1;
                    }

                    // Late Arrival
                    if (t.horaEntrada && t.horaProgramadaEntrada) {
                        const actual = timeStrToMinutes(t.horaEntrada);
                        const scheduled = timeStrToMinutes(t.horaProgramadaEntrada);
                        if (actual !== null && scheduled !== null && actual > scheduled) {
                            lateCount++;
                            lateMinutes += (actual - scheduled);
                        }
                    }

                    // Early Departure
                    if (t.horaSalida && t.horaProgramadaSalida) {
                        const actual = timeStrToMinutes(t.horaSalida);
                        const scheduled = timeStrToMinutes(t.horaProgramadaSalida);
                        if (actual !== null && scheduled !== null && actual < scheduled) {
                            earlyCount++;
                            earlyMinutes += (scheduled - actual);
                        }
                    }
                }
            });
            
            const saldoReal = this.calculateCompensatoryBalance(p.id);
            const totalAnomalies = lateCount + earlyCount;
            const totalMinutes = lateMinutes + earlyMinutes;
            
            const anomalyText = totalAnomalies > 0 
                ? `${totalAnomalies} (${totalMinutes} min)` 
                : '-';
            
            const anomalyStyle = totalAnomalies > 0 
                ? 'text-align: center; color: #dc3545; font-weight: bold; cursor: pointer; text-decoration: underline;' 
                : 'text-align: center;';
                
            const anomalyOnClick = totalAnomalies > 0
                ? `onclick="showReportAnomalyDetails('${p.id}', '${selectedYear}')"`
                : '';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.apellido}, ${p.nombre}</td>
                <td style="text-align: center; font-weight: bold; color: #d97706;">${horasExtras}</td>
                <td style="text-align: center; font-weight: bold; color: ${saldoReal < 0 ? '#ef4444' : '#166534'}; cursor: pointer; text-decoration: underline;" onclick="showReportCompensatoryDetails('${p.id}', 'balance')">${saldoReal}</td>
                <td style="text-align: center; cursor: pointer; text-decoration: underline;" onclick="showReportCompensatoryDetails('${p.id}', 'usage_year', '${selectedYear}')">${compUsado}</td>
                <td style="${anomalyStyle}" ${anomalyOnClick}>${anomalyText}</td>
            `;
            tbodyElement.appendChild(tr);
        });
    }

    calculateCompensatoryBalance(personalId) {
         let generated = 0;
         let taken = 0;
         
         if (!this.turnos) return 0;
         
         Object.keys(this.turnos).forEach(date => {
            if (this.turnos[date]) {
                 const t = this.turnos[date][personalId];
                 if (t) {
                     if (t.tipo === 'guardia_fija' && t.compensatorioGenerado) {
                         generated += parseFloat(t.compensatorioGenerado) || 0;
                     }
                     if (t.tipo === 'compensatorio') {
                         taken += 1;
                     }
                 }
             }
         });
         return generated - taken;
    }
}
