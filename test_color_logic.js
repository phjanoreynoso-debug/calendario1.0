
// Simple Unit Test for Color Visualization Logic

// Mock Data
const mockTurnos = [
    { tipo: 'guardia_fija', rolCG: null, expected: 'guardia_fija' },
    { tipo: 'cambios_guardia', rolCG: 'cubre', expected: 'guardia_fija' },
    { tipo: 'cambios_guardia', rolCG: 'devuelve', expected: 'guardia_fija' },
    { tipo: 'cambios_guardia', rolCG: 'solicita', expected: 'cambios_guardia' },
    { tipo: 'ausente', rolCG: null, expected: 'ausente' }
];

// Logic under test
function getEffectiveType(turno) {
    let effectiveType = turno.tipo;
    if (turno.tipo === 'cambios_guardia' && (turno.rolCG === 'cubre' || turno.rolCG === 'devuelve')) {
        effectiveType = 'guardia_fija';
    }
    return effectiveType;
}

// Test Runner
console.log('Running Color Visualization Logic Tests...');
let passed = 0;
let failed = 0;

mockTurnos.forEach((t, i) => {
    const result = getEffectiveType(t);
    if (result === t.expected) {
        console.log(`Test ${i + 1} PASSED: ${t.tipo} (${t.rolCG}) -> ${result}`);
        passed++;
    } else {
        console.error(`Test ${i + 1} FAILED: ${t.tipo} (${t.rolCG}) -> Expected ${t.expected}, got ${result}`);
        failed++;
    }
});

// Mock Settings and Style Application Logic
const mockSettings = {
    codeMap: {
        'guardia_fija': { style: { bg: 'red', text: 'white' } },
        'ausente': { style: { bg: 'black', text: 'yellow' } } // User custom
    },
    customTypes: []
};

function getStyleForTipo(tipo) {
    // Mocked getSettings behavior
    const s = mockSettings;
    if (s.codeMap && s.codeMap[tipo] && s.codeMap[tipo].style) {
        return s.codeMap[tipo].style;
    }
    return null;
}

// Test Style Retrieval
console.log('\nTesting Style Retrieval...');
const styleTests = [
    { tipo: 'guardia_fija', expectedBg: 'red' },
    { tipo: 'ausente', expectedBg: 'black' },
    { tipo: 'vacaciones', expectedBg: undefined } // No custom style
];

styleTests.forEach((t, i) => {
    const style = getStyleForTipo(t.tipo);
    const bg = style ? style.bg : undefined;
    if (bg === t.expectedBg) {
        console.log(`Style Test ${i + 1} PASSED: ${t.tipo} -> ${bg}`);
        passed++;
    } else {
        console.error(`Style Test ${i + 1} FAILED: ${t.tipo} -> Expected ${t.expectedBg}, got ${bg}`);
        failed++;
    }
});

console.log(`\nTotal Tests: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);

if (failed === 0) {
    console.log('ALL TESTS PASSED');
} else {
    console.error('SOME TESTS FAILED');
    process.exit(1);
}
