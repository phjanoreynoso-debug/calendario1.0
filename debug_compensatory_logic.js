
const personal = [
    { id: 'p1', nombre: 'Javier', apellido: 'Reynoso', compensatoryResetDate: '2026-02-09' }
];

const turnos = {
    '2026-02-01': { // Before reset
        'p1': { tipo: 'guardia_fija', compensatorioGenerado: 10 }
    },
    '2026-02-09': { // On reset day
        'p1': { tipo: 'compensatorio', fechaTrabajoRealizado: '2026-02-01' } 
    },
    '2026-02-10': { // After reset
        'p1': { tipo: 'guardia_fija', compensatorioGenerado: 5 }
    }
};

function formatDateShort(d) { return d; }
function timeStrToMinutes(t) { return 0; }

function calculatePersonalReportStats(personalId, yearFilter) {
    let horasExtras = 0;
    let compGenerados = 0;
    let compUsados = 0;
    let anomaliesCount = 0;
    let totalLateMinutes = 0;
    let totalEarlyMinutes = 0;
    
    // Contadores Globales (para saldo histórico)
    let globalCompGenerados = 0;
    let globalCompUsados = 0;
    
    // Arrays para detalles
    const compDetails = []; 
    const anomalyDetails = []; 
    const globalCompDetails = [];

    // Get personal reset date if exists
    const p = personal.find(x => x.id === personalId);
    const resetDate = p && p.compensatoryResetDate ? p.compensatoryResetDate : null;

    Object.keys(turnos).forEach(dateStr => {
        let isInFilter = true; // simplified

        const t = turnos[dateStr][personalId];
        if (!t) return;

        // Compensatorios (Logic for Global Balance AND Filtered View)
        if (t.tipo === 'guardia_fija' && t.compensatorioGenerado) {
            const amount = parseFloat(t.compensatorioGenerado) || 0;
            
            // Global Tracking (check reset date)
            let isAfterReset = true;
            if (resetDate && dateStr < resetDate) {
                isAfterReset = false;
            }

            if (isAfterReset) {
                globalCompGenerados += amount;
                const detailItem = {
                    date: dateStr,
                    type: 'generated',
                    amount: amount,
                    desc: `Generado (${amount} día/s)`
                };
                globalCompDetails.push(detailItem);
            }
        }
        if (t.tipo === 'compensatorio') {
            // Global Tracking (check reset date)
            let isAfterReset = true;
            if (resetDate && dateStr < resetDate) {
                isAfterReset = false;
            }

            if (isAfterReset) {
                globalCompUsados += 1;
                const detailItem = {
                    date: dateStr,
                    type: 'taken',
                    amount: 1,
                    desc: 'Tomado',
                };
                globalCompDetails.push(detailItem);
            }
        }
    });

    return { 
        globalCompGenerados, globalCompUsados, globalBalance: globalCompGenerados - globalCompUsados
    };
}

const stats = calculatePersonalReportStats('p1', '2026');
console.log('Reset Date:', personal[0].compensatoryResetDate);
console.log('Stats:', stats);
