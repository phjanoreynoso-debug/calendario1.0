
// Unit tests for Compensatory Balance System
// Simulates the logic in app.js for balance calculation and validation

// Mock State
let turnos = {};
let personal = [
    { id: 'p1', nombre: 'Test', apellido: 'User', compensatoryResetDate: null }
];

// Helper functions (simplified from app.js)
function getCompensatoryBalance(personalId) {
    let generated = 0;
    let taken = 0;
    const p = personal.find(x => x.id === personalId);
    const resetDate = p && p.compensatoryResetDate ? p.compensatoryResetDate : null;
    
    if (!turnos) return 0;
    
    Object.keys(turnos).forEach(date => {
        if (turnos[date]) {
            const t = turnos[date][personalId];
            if (t) {
                // Check reset date
                let isAfterReset = true;
                if (resetDate && date < resetDate) {
                    isAfterReset = false;
                }

                if (isAfterReset) {
                    if (t.tipo === 'guardia_fija' && t.compensatorioGenerado) {
                        generated += parseFloat(t.compensatorioGenerado) || 0;
                    }
                    if (t.tipo === 'compensatorio') {
                        taken += 1;
                    }
                }
            }
        }
    });
    return generated - taken;
}

// Validation Logic
function canTakeCompensatory(personalId, amountToTake = 1) {
    const balance = getCompensatoryBalance(personalId);
    return balance >= amountToTake;
}

// Test Runner
console.log('--- Compensatory Balance System Tests ---');
let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`[PASS] ${message}`);
        passed++;
    } else {
        console.error(`[FAIL] ${message}`);
        failed++;
    }
}

// Reset state
turnos = {};

// Test 1: Initial Balance
assert(getCompensatoryBalance('p1') === 0, 'Initial balance should be 0');

// Test 2: Generate Compensatory
turnos['2026-01-01'] = { 'p1': { tipo: 'guardia_fija', compensatorioGenerado: 1 } };
assert(getCompensatoryBalance('p1') === 1, 'Balance should be 1 after generating 1 day');

// Test 3: Generate More
turnos['2026-01-02'] = { 'p1': { tipo: 'guardia_fija', compensatorioGenerado: 0.5 } };
assert(getCompensatoryBalance('p1') === 1.5, 'Balance should be 1.5 after generating 0.5 day');

// Test 4: Take Compensatory
turnos['2026-01-05'] = { 'p1': { tipo: 'compensatorio' } };
assert(getCompensatoryBalance('p1') === 0.5, 'Balance should be 0.5 after taking 1 day');

// Test 5: Validation - Can take?
assert(canTakeCompensatory('p1') === false, 'Should NOT be able to take 1 day with 0.5 balance');

// Test 6: Generate More to Allow Taking
turnos['2026-01-06'] = { 'p1': { tipo: 'guardia_fija', compensatorioGenerado: 1 } };
// Balance is now 1.5
assert(getCompensatoryBalance('p1') === 1.5, 'Balance restored to 1.5');
assert(canTakeCompensatory('p1') === true, 'Should be able to take 1 day with 1.5 balance');

// Test 7: Take Another
turnos['2026-01-10'] = { 'p1': { tipo: 'compensatorio' } };
assert(getCompensatoryBalance('p1') === 0.5, 'Balance reduced to 0.5');

// Test 8: Reset Logic
personal[0].compensatoryResetDate = '2026-02-01';
// All previous transactions are before 2026-02-01, so balance should be 0
assert(getCompensatoryBalance('p1') === 0, 'Balance should be 0 after reset');

// Test 9: Mixed History (User Scenario)
// Day 1: Taken (Before Reset) -> Ignored
// Day 2: Taken (After Reset) -> Counted
turnos['2026-01-15'] = { 'p1': { tipo: 'compensatorio' } }; // Before reset
turnos['2026-02-15'] = { 'p1': { tipo: 'compensatorio' } }; // After reset
// Total taken: 2. But effective taken: 1 (only the one after reset)
// Generated: 0 (since reset).
// Balance: 0 - 1 = -1.
assert(getCompensatoryBalance('p1') === -1, 'Balance should be -1 (ignoring pre-reset usage)');

// Test 10: Transaction After Reset
turnos['2026-02-05'] = { 'p1': { tipo: 'guardia_fija', compensatorioGenerado: 1 } };
// Balance: -1 (from prev) + 1 = 0
assert(getCompensatoryBalance('p1') === 0, 'Balance should be 0 after new generation post-reset');

// Test 11: Same Day Reset Logic (Edge Case)
// If reset is 2026-02-01, a transaction ON 2026-02-01 should count
turnos['2026-02-01'] = { 'p1': { tipo: 'guardia_fija', compensatorioGenerado: 2 } };
// Total: 0 (from above) + 2 (from Feb 1) = 2
assert(getCompensatoryBalance('p1') === 2, 'Transaction on reset day should count');


console.log('-----------------------------------------');
console.log(`Total: ${passed} Passed, ${failed} Failed`);
if (failed === 0) {
    console.log('All tests passed successfully.');
} else {
    console.error('Some tests failed.');
}
