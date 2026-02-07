
const assert = {
    strictEqual: (actual, expected, message) => {
        if (actual !== expected) {
            console.error(`❌ FAIL: ${message} - Expected '${expected}', got '${actual}'`);
            process.exit(1);
        } else {
            console.log(`✅ PASS: ${message}`);
        }
    },
    deepStrictEqual: (actual, expected, message) => {
        const strActual = JSON.stringify(actual);
        const strExpected = JSON.stringify(expected);
        if (strActual !== strExpected) {
            console.error(`❌ FAIL: ${message} - Expected '${strExpected}', got '${strActual}'`);
            process.exit(1);
        } else {
            console.log(`✅ PASS: ${message}`);
        }
    }
};

// --- Mocking app.js functions ---

function timeStrToMinutes(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || '0', 10);
    if (!Number.isInteger(h) || h < 0 || h > 23) return null;
    if (!Number.isInteger(m) || m < 0 || m > 59) return null;
    return h * 60 + m;
}

function validatePdfObservations(text) {
    if (!text) return { valid: true };
    
    if (/[<>{}]/.test(text)) {
        return { valid: false, message: 'El texto contiene caracteres no permitidos (<, >, {, }).' };
    }
    
    if (text.length > 500) {
        return { valid: false, message: 'El texto excede los 500 caracteres.' };
    }

    return { valid: true };
}

// --- Tests ---

console.log("Starting PDF Feature Tests...");

// 1. Validate PDF Observations
assert.deepStrictEqual(validatePdfObservations("Valid text"), { valid: true }, "Simple valid text");
assert.deepStrictEqual(validatePdfObservations(""), { valid: true }, "Empty text is valid");
assert.deepStrictEqual(validatePdfObservations(null), { valid: true }, "Null text is valid");
assert.deepStrictEqual(validatePdfObservations("Invalid < text"), { valid: false, message: 'El texto contiene caracteres no permitidos (<, >, {, }).' }, "Injection chars invalid");

let longText = "a".repeat(501);
assert.deepStrictEqual(validatePdfObservations(longText), { valid: false, message: 'El texto excede los 500 caracteres.' }, "Length limit exceeded");

longText = "a".repeat(500);
assert.deepStrictEqual(validatePdfObservations(longText), { valid: true }, "Length limit exact");


// 2. Anomaly Detection Logic Simulation
console.log("Testing Anomaly Detection Logic...");

function detectAnomalies(t, expectedSchedule) {
    let include = false;
    let finalText = "";
    
    let scheduledStart = t.horaProgramadaEntrada;
    let scheduledEnd = t.horaProgramadaSalida;

    if (!scheduledStart || !scheduledEnd) {
        if (expectedSchedule) {
            if (!scheduledStart) scheduledStart = expectedSchedule.start;
            if (!scheduledEnd) scheduledEnd = expectedSchedule.end;
        }
    }

    if (t.horaEntrada && scheduledStart) {
        const actual = timeStrToMinutes(t.horaEntrada);
        const scheduled = timeStrToMinutes(scheduledStart);
        
        if (actual !== null && scheduled !== null) {
            const diff = actual - scheduled;
            if (diff > 0) {
                const lateText = `⚠️ LLEGADA TARDÍA: ${diff} min (Entrada: ${t.horaEntrada} vs ${scheduledStart})`;
                finalText = finalText ? `${finalText}\n${lateText}` : lateText;
                include = true;
            }
        }
    }
    
    if (t.horaSalida && scheduledEnd) {
        const actual = timeStrToMinutes(t.horaSalida);
        const scheduled = timeStrToMinutes(scheduledEnd);
        
        if (actual !== null && scheduled !== null) {
            const diff = scheduled - actual; 
            if (diff > 0) {
                const earlyText = `⚠️ SALIDA ANTICIPADA: ${diff} min (Salida: ${t.horaSalida} vs ${scheduledEnd})`;
                finalText = finalText ? `${finalText}\n${earlyText}` : earlyText;
                include = true;
            }
        }
    }
    return { include, finalText };
}

// Case 1: On time
let result = detectAnomalies(
    { horaEntrada: "08:00", horaSalida: "16:00", horaProgramadaEntrada: "08:00", horaProgramadaSalida: "16:00" },
    null
);
assert.strictEqual(result.include, false, "On time should not include anomaly");

// Case 2: Late Arrival (Saved Schedule)
result = detectAnomalies(
    { horaEntrada: "08:15", horaSalida: "16:00", horaProgramadaEntrada: "08:00", horaProgramadaSalida: "16:00" },
    null
);
assert.strictEqual(result.include, true, "Late arrival should be included");
assert.strictEqual(result.finalText.includes("LLEGADA TARDÍA: 15 min"), true, "Correct late text");

// Case 3: Early Departure (Profile Schedule)
result = detectAnomalies(
    { horaEntrada: "08:00", horaSalida: "15:50" },
    { start: "08:00", end: "16:00" }
);
assert.strictEqual(result.include, true, "Early departure should be included (profile fallback)");
assert.strictEqual(result.finalText.includes("SALIDA ANTICIPADA: 10 min"), true, "Correct early departure text");

// Case 4: Both Anomalies
result = detectAnomalies(
    { horaEntrada: "08:05", horaSalida: "15:55", horaProgramadaEntrada: "08:00", horaProgramadaSalida: "16:00" },
    null
);
assert.strictEqual(result.include, true, "Both anomalies");
assert.strictEqual(result.finalText.includes("LLEGADA TARDÍA: 5 min"), true, "Includes late");
assert.strictEqual(result.finalText.includes("SALIDA ANTICIPADA: 5 min"), true, "Includes early");

console.log("All tests passed!");
