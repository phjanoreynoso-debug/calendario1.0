
// Mock LocalStorage
const localStorageMock = (function() {
    let store = {};
    return {
        getItem: function(key) {
            return store[key] || null;
        },
        setItem: function(key, value) {
            store[key] = value.toString();
        },
        clear: function() {
            store = {};
        }
    };
})();
global.localStorage = localStorageMock;
// Mock document and window for Controller
global.document = {
    createElement: (tag) => ({ innerHTML: '', appendChild: () => {} }),
    getElementById: () => null,
    querySelector: () => null
};
global.window = {};

import { StorageService } from '../src/core/services/StorageService.js';
import { Personal } from '../src/core/models/Personal.js';
import { Turno } from '../src/core/models/Turno.js';
import { ReportController } from '../src/ui/controllers/ReportController.js';

console.log('Running Integration Tests...');

try {
    // 1. Test Models
    const p1 = new Personal({ nombre: 'Juan', apellido: 'Perez' });
    if (p1.nombre !== 'Juan') throw new Error('Personal model failed');
    console.log('Personal Model: OK');

    // 2. Test Storage Service
    StorageService.savePersonal([p1]);
    const loadedPersonal = StorageService.getPersonal();
    if (loadedPersonal.length !== 1 || loadedPersonal[0].nombre !== 'Juan') throw new Error('StorageService failed');
    console.log('StorageService: OK');

    // 3. Test Report Logic (Controller + Service)
    // Create some turnos
    const t1 = new Turno({ tipo: 'guardia_fija', compensatorioGenerado: 1 });
    const turnos = {
        '2026-01-01': {
            [p1.id]: t1
        }
    };
    StorageService.saveTurnos(turnos);

    // Instantiate Controller
    const controller = new ReportController();
    // Force reload data since constructor loads it once
    controller.personal = StorageService.getPersonal();
    controller.turnos = StorageService.getTurnos();

    // Mock DOM elements
    const tbody = { innerHTML: '', appendChild: () => {} };
    const yearSelect = { value: '2026' };
    const searchInput = { value: '' };

    controller.renderReports(tbody, yearSelect, searchInput);
    
    // Verify calculation logic inside controller
    const balance = controller.calculateCompensatoryBalance(p1.id);
    if (balance !== 1) throw new Error(`Balance calculation failed. Expected 1, got ${balance}`);
    console.log('ReportController Integration: OK');

    console.log('All tests passed!');
} catch (error) {
    console.error('Test Failed:', error);
    process.exit(1);
}
