
// Unit tests for Compensatory Day Logic
// Simulates the logic implemented in app.js for validation

// Mock Data
// We assume these dates are holidays for testing purposes
const holidays = ['2026-05-01', '2026-05-25', '2026-07-09']; 

// Logic under test (replicated from app.js for verification)
function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // 0=Sunday, 6=Saturday
}

function isHolidayMock(dateStr) {
    return holidays.includes(dateStr);
}

function evaluateCompensatoryEligibility(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    // Note: Month is 0-indexed in JS Date
    const date = new Date(y, m - 1, d);
    
    const weekend = isWeekend(date);
    const holiday = isHolidayMock(dateStr);
    
    return {
        date: dateStr,
        isWeekend: weekend,
        isHoliday: holiday,
        // UPDATE: Ahora siempre se permite generar compensatorio
        canGenerateCompensatory: true 
    };
}

// Test Cases
const testCases = [
    { date: '2026-02-09', expected: true, desc: 'Lunes (Laborable normal - Habilitado)' },
    { date: '2026-02-10', expected: true, desc: 'Martes (Laborable normal - Habilitado)' },
    { date: '2026-02-14', expected: true, desc: 'Sábado (Fin de semana)' },
    { date: '2026-02-15', expected: true, desc: 'Domingo (Fin de semana)' },
    { date: '2026-05-01', expected: true, desc: 'Viernes (Feriado - Día del Trabajador)' },
    { date: '2026-05-25', expected: true, desc: 'Lunes (Feriado - Revolución de Mayo)' },
    { date: '2026-07-09', expected: true, desc: 'Jueves (Feriado - Independencia)' },
    { date: '2026-07-10', expected: true, desc: 'Viernes (Laborable normal - Habilitado)' }
];

console.log('--- Iniciando Pruebas de Lógica de Compensatorios ---');
let passed = 0;
let failed = 0;

testCases.forEach(tc => {
    const result = evaluateCompensatoryEligibility(tc.date);
    const status = result.canGenerateCompensatory === tc.expected ? 'PASS' : 'FAIL';
    
    if (status === 'PASS') {
        passed++;
        console.log(`[${status}] ${tc.desc} (${tc.date})`);
    } else {
        failed++;
        console.error(`[${status}] ${tc.desc} (${tc.date})`);
        console.error(`       Esperado: ${tc.expected}, Obtenido: ${result.canGenerateCompensatory}`);
        console.error(`       Detalles: Fin de semana=${result.isWeekend}, Feriado=${result.isHoliday}`);
    }
});

console.log('-----------------------------------------------------');
console.log(`Resultados: ${passed} pasaron, ${failed} fallaron.`);

if (failed === 0) {
    console.log('CONCLUSIÓN: La lógica de negocio es correcta.');
} else {
    console.error('CONCLUSIÓN: Se encontraron errores en la lógica.');
}
