const KEYS = {
    PERSONAL: 'vigilancia-personal',
    TURNOS: 'vigilancia-turnos',
    HOLIDAYS: 'vigilancia-holidays',
    SETTINGS: 'vigilancia-settings',
    CUSTOM_TYPES: 'vigilancia-custom-types'
};

export class StorageService {
    static getPersonal() {
        try {
            const data = localStorage.getItem(KEYS.PERSONAL);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error loading personal:', e);
            return [];
        }
    }

    static savePersonal(personal) {
        try {
            localStorage.setItem(KEYS.PERSONAL, JSON.stringify(personal));
        } catch (e) {
            console.error('Error saving personal:', e);
        }
    }

    static getTurnos() {
        try {
            const data = localStorage.getItem(KEYS.TURNOS);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error loading turnos:', e);
            return {};
        }
    }

    static saveTurnos(turnos) {
        try {
            localStorage.setItem(KEYS.TURNOS, JSON.stringify(turnos));
        } catch (e) {
            console.error('Error saving turnos:', e);
        }
    }

    static getHolidays() {
        try {
            const data = localStorage.getItem(KEYS.HOLIDAYS);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error loading holidays:', e);
            return {};
        }
    }

    static saveHolidays(holidays) {
        try {
            localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(holidays));
        } catch (e) {
            console.error('Error saving holidays:', e);
        }
    }

    static getSettings() {
         try {
            const data = localStorage.getItem(KEYS.SETTINGS);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error loading settings:', e);
            return {};
        }
    }
    
    static saveSettings(settings) {
        try {
            localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
        } catch (e) {
            console.error('Error saving settings:', e);
        }
    }
    
    static getCustomTypes() {
        try {
            const data = localStorage.getItem(KEYS.CUSTOM_TYPES);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error loading custom types:', e);
            return [];
        }
    }

    static saveCustomTypes(types) {
        try {
            localStorage.setItem(KEYS.CUSTOM_TYPES, JSON.stringify(types));
        } catch (e) {
            console.error('Error saving custom types:', e);
        }
    }
}
