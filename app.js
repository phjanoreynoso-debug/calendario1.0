// Variables globales
let personal = [];
let turnos = {}
let currentUser = null; // sesión actual: { username, role }
let adminIdleTimer = null; // temporizador de inactividad para admin
let adminActivityHandler = null; // handler para reiniciar temporizador

// Silenciar logs en consola por defecto (se pueden reactivar con localStorage 'vigilancia-debug-logs')
(function() {
    const original = {
        log: console.log,
        info: console.info,
        debug: console.debug,
        table: console.table,
        trace: console.trace
    };
    const noop = function(){};
    const enabled = localStorage.getItem('vigilancia-debug-logs') === 'true';
    function silence() {
        console.log = noop;
        console.info = noop;
        console.debug = noop;
        console.table = noop;
        console.trace = noop;
    }
    function restore() {
        console.log = original.log;
        console.info = original.info;
        console.debug = original.debug;
        console.table = original.table;
        console.trace = original.trace;
    }
    if (!enabled) silence();
    window.setDebugLogging = function(on) {
        localStorage.setItem('vigilancia-debug-logs', on ? 'true' : 'false');
        if (on) restore(); else silence();
    };
})();

// Función para manejar el cambio de tipo de turno y mostrar campos condicionales
function handleTipoTurnoChange() {
    const tipoTurno = document.getElementById('turno-tipo').value;
    const horarioGroup = document.querySelector('.horario-group');
    
    hideAllConditionalFields();
    
    const tiposSinHorario = ['vacaciones', 'estres', 'dia_estudio', 'ausente', 'compensatorio'];
    const s = getSettings();
    const cfg = getCustomTypeConfig(tipoTurno);
    const isCustom = !!cfg;
    if (tiposSinHorario.includes(tipoTurno)) {
        horarioGroup.style.display = 'none';
    } else if (isCustom) {
        horarioGroup.style.display = cfg && cfg.requireTime ? 'block' : 'none';
    } else {
        horarioGroup.style.display = 'block';
    }
    
    switch(tipoTurno) {
        case 'vacaciones':
        case 'estres':
            document.getElementById('campos-vacaciones-estres').style.display = 'block';
            updateVacacionesDiasContador();
            break;
        case 'carpeta_medica':
            document.getElementById('campos-carpeta-medica').style.display = 'block';
            break;
        case 'compensatorio':
            document.getElementById('campos-compensatorio').style.display = 'block';
            break;
        case 'cambios_guardia':
            document.getElementById('campos-cambios-guardia').style.display = 'block';
            break;
        case 'articulo26':
            document.getElementById('campos-articulo26').style.display = 'block';
            updateArticulo26Counter();
            break;
        default:
            if (isCustom && cfg && cfg.requireDateRange) {
                document.getElementById('campos-vacaciones-estres').style.display = 'block';
                updateVacacionesDiasContador();
            }
        }
}

// Contador de días seleccionados para Vacaciones/Estrés
function updateVacacionesDiasContador() {
    const contadorEl = document.getElementById('vacaciones-dias-contador');
    if (!contadorEl) return;
    const tipoTurno = document.getElementById('turno-tipo').value;
    // Solo actualizar cuando el tipo sea Vacaciones o Estrés
    if (tipoTurno !== 'vacaciones' && tipoTurno !== 'estres') {
        contadorEl.textContent = 'Días seleccionados: 0';
        return;
    }
    const startStr = document.getElementById('fecha-inicio').value;
    const endStr = document.getElementById('fecha-fin').value;
    let days = 0;
    if (startStr && endStr) {
        const s = new Date(startStr);
        const e = new Date(endStr);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e) {
            const cur = new Date(s);
            while (cur <= e) {
                days += 1;
                cur.setDate(cur.getDate() + 1);
            }
        }
    }
    contadorEl.textContent = `Días seleccionados: ${days}`;
}

// Parseo seguro de fecha en formato 'YYYY-MM-DD' usando tiempo local (evita desfasaje por zona horaria)
function parseDateLocal(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
    return new Date(y, m - 1, d);
}

// Función para ocultar todos los campos condicionales
function hideAllConditionalFields() {
    const conditionalFields = document.querySelectorAll('.conditional-fields');
    conditionalFields.forEach(field => {
        field.style.display = 'none';
    });
}
// Poblar el selector de compañero con el listado actual de personal
function populateCompaneroSelect() {
    const select = document.getElementById('companero-cambio');
    if (!select) return;
    const previous = select.value;
    select.innerHTML = '<option value="">Seleccione un compañero…</option>';
    personal.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.apellido}, ${p.nombre}`;
        select.appendChild(opt);
    });
    if (previous && personal.some(p => p.id === previous)) {
        select.value = previous;
    }
}

// Función para actualizar el contador de Artículo 26 (por persona y mes seleccionado)
function updateArticulo26Counter() {
    const personaIdEl = document.getElementById('turno-personal-id');
    const fechaEl = document.getElementById('turno-fecha');
    const refDate = (fechaEl && fechaEl.value) ? parseDateLocal(fechaEl.value) : new Date();
    const currentYear = refDate.getFullYear();
    const currentMonth = refDate.getMonth();
    const personalId = personaIdEl ? personaIdEl.value : null;

    // Contar días de Artículo 26 utilizados este año por la persona seleccionada
    let diasUtilizados = 0;
    let mesUtilizado = false;

    if (personalId) {
        Object.keys(turnos).forEach(fecha => {
            const fechaTurno = parseDateLocal(fecha);
            if (!fechaTurno) return;
            if (fechaTurno.getFullYear() === currentYear) {
                const t = turnos[fecha][personalId];
                if (t && t.tipo === 'articulo26') {
                    diasUtilizados++;
                    if (fechaTurno.getMonth() === currentMonth) {
                        mesUtilizado = true;
                    }
                }
            }
        });
    }

    // Actualizar la interfaz
    const diasEl = document.getElementById('dias-utilizados');
    const mesEl = document.getElementById('mes-utilizado');
    if (diasEl) diasEl.textContent = diasUtilizados;
    if (mesEl) mesEl.textContent = mesUtilizado ? 'Sí' : 'No';

    // Cambiar color si se acerca al límite
    const contadorElement = document.getElementById('articulo26-contador');
    if (contadorElement) {
        if (diasUtilizados >= 6) {
            contadorElement.style.color = '#dc3545'; // Rojo
        } else if (diasUtilizados >= 4) {
            contadorElement.style.color = '#ffc107'; // Amarillo
        } else {
            contadorElement.style.color = '#6c757d'; // Gris normal
        }
    }
}

// Función para validar Artículo 26
function validateArticulo26(fecha, personalId) {
    const currentDate = parseDateLocal(fecha);
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    let diasUtilizados = 0;
    let mesUtilizado = false;

    Object.keys(turnos).forEach(fechaTurno => {
        const fechaTurnoDate = parseDateLocal(fechaTurno);
        if (!fechaTurnoDate) return;
        if (fechaTurnoDate.getFullYear() === currentYear) {
            const t = turnos[fechaTurno] ? turnos[fechaTurno][personalId] : null;
            if (t && t.tipo === 'articulo26') {
                diasUtilizados++;
                if (fechaTurnoDate.getMonth() === currentMonth && fechaTurno !== fecha) {
                    mesUtilizado = true;
                }
            }
        }
    });

    if (diasUtilizados >= 6) {
        return { valid: false, message: 'Esta persona ya utilizó los 6 días anuales de Artículo 26' };
    }

    if (mesUtilizado) {
        return { valid: false, message: 'Esta persona ya utilizó un día de Artículo 26 en este mes' };
    }

    return { valid: true };
}

// Función para cargar datos de campos condicionales al editar
function loadConditionalFieldsData(turno) {
    switch(turno.tipo) {
        case 'vacaciones':
        case 'estres':
            if (turno.fechaInicio) document.getElementById('fecha-inicio').value = turno.fechaInicio;
            if (turno.fechaFin) document.getElementById('fecha-fin').value = turno.fechaFin;
            updateVacacionesDiasContador();
            break;
        case 'carpeta_medica':
            if (turno.fechaInicioCarpeta) document.getElementById('fecha-inicio-carpeta').value = turno.fechaInicioCarpeta;
            if (turno.fechaAlta) document.getElementById('fecha-alta').value = turno.fechaAlta;
            break;
        case 'compensatorio':
            if (turno.fechaTrabajoRealizado) document.getElementById('fecha-trabajo-realizado').value = turno.fechaTrabajoRealizado;
            break;
        case 'cambios_guardia': {
            const select = document.getElementById('companero-cambio');
            if (turno.companeroCambio && select) {
                const hasId = personal.some(p => p.id === turno.companeroCambio);
                if (hasId) {
                    select.value = turno.companeroCambio;
                } else {
                    const opt = Array.from(select.options).find(o => o.textContent === turno.companeroCambio);
                    if (opt) select.value = opt.value;
                }
            }
            const fechaDevolucionInput = document.getElementById('fecha-devolucion');
            if (fechaDevolucionInput && turno.fechaDevolucion) {
                fechaDevolucionInput.value = turno.fechaDevolucion;
            }
            break;
        }
    }
}

// Función para limpiar campos condicionales
function clearConditionalFields() {
    // Limpiar campos de vacaciones/estrés
    document.getElementById('fecha-inicio').value = '';
    document.getElementById('fecha-fin').value = '';
    const contadorEl = document.getElementById('vacaciones-dias-contador');
    if (contadorEl) contadorEl.textContent = 'Días seleccionados: 0';
    
    // Limpiar campos de carpeta médica
    document.getElementById('fecha-inicio-carpeta').value = '';
    document.getElementById('fecha-alta').value = '';
    
    // Limpiar campos de compensatorio
    document.getElementById('fecha-trabajo-realizado').value = '';
    
    // Limpiar campos de cambios de guardia
    document.getElementById('companero-cambio').value = '';
    const fechaDevolucionInput = document.getElementById('fecha-devolucion');
    if (fechaDevolucionInput) fechaDevolucionInput.value = '';
    // Limpiar campos de otros
    const motivoSel = document.getElementById('motivo-otros');
    if (motivoSel) motivoSel.value = '';
    const fs = document.getElementById('fecha-solicitud-otros');
    if (fs) fs.value = '';
    const fr = document.getElementById('fecha-regreso-otros');
    if (fr) fr.value = '';
}; // Cambiar de array a objeto para almacenar turnos por fecha
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let isSubmitting = false; // Flag para prevenir múltiples envíos

// Referencias a elementos del DOM
const personalList = document.getElementById('personal-list');
const personalForm = document.getElementById('personal-form');
const personalModal = document.getElementById('personal-modal');
const personalSection = document.getElementById('personal-section');
const addPersonalBtn = document.getElementById('add-personal-btn');
const managePersonalBtn = document.getElementById('manage-personal-btn');
const closePersonalBtn = document.getElementById('close-personal-btn');
const closeButtons = document.querySelectorAll('.close, .cancel-btn');
const deletePersonalBtn = document.getElementById('delete-personal-btn');
const turnoModal = document.getElementById('turno-modal');
const turnoForm = document.getElementById('turno-form');
const deleteTurnoBtn = document.getElementById('delete-turno-btn');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const currentMonthElement = document.getElementById('current-month');
const calendarDays = document.getElementById('calendar-days');
const calendarBody = document.getElementById('calendar-body');
const viewStatsBtn = document.getElementById('view-stats-btn');
const statsSection = document.getElementById('stats-section');
const closeStatsBtn = document.getElementById('close-stats-btn');
const statsList = document.getElementById('stats-list');
const statsNameSelect = document.getElementById('stats-name-select');
// Controles de sesión y login
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const sessionInfo = document.getElementById('session-info');
const userRoleLabel = document.getElementById('user-role-label');
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const closeLoginModalBtn = document.getElementById('close-login-modal');
const cancelLoginBtn = document.getElementById('cancel-login');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const exportDataBtn = document.getElementById('export-data-btn');
const importDataBtn = document.getElementById('import-data-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const cancelSettingsBtn = document.getElementById('cancel-settings');
const settingsForm = document.getElementById('settings-form');
const importFileInput = document.getElementById('import-file-input');
const downloadPdfBtn = document.getElementById('download-pdf-btn');
// const downloadExcelBtn = document.getElementById('download-excel-btn'); // eliminado de la UI
// Elementos del menú hamburguesa
const hamburgerBtn = document.getElementById('hamburger-btn');
const hamburgerMenu = document.getElementById('hamburger-menu');
const closeMenuBtn = document.getElementById('close-menu-btn');
const menuOverlay = document.getElementById('menu-overlay');
// Utilidad: cerrar el menú hamburguesa si está abierto
function closeHamburgerMenu() {
    if (hamburgerMenu && hamburgerMenu.classList.contains('open')) {
        hamburgerMenu.classList.remove('open');
        if (menuOverlay) menuOverlay.classList.remove('visible');
        document.body.classList.remove('menu-open');
        hamburgerMenu.setAttribute('aria-hidden', 'true');
        if (menuOverlay) menuOverlay.setAttribute('aria-hidden', 'true');
        // Desactivar interactividad del panel y overlay
        if (hamburgerMenu) hamburgerMenu.setAttribute('inert', '');
        if (menuOverlay) menuOverlay.setAttribute('inert', '');
        // Devolver el foco al botón hamburguesa
        if (hamburgerBtn) hamburgerBtn.focus();
    }
}
// Enlaces de recuperación/creación removidos de la UI

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    loadSession();
    updateSessionUI();
    setupEventListeners();
    // Mostrar mensajes de cierre previo si aplica
    try {
        const reason = sessionStorage.getItem('logout-reason');
        if (reason) {
            if (reason === 'idle') {
                showNotification('Sesión cerrada por inactividad (3 min).');
            }
            sessionStorage.removeItem('logout-reason');
        }
        // Limpiar flag de recarga (si quedó marcado por beforeunload)
        sessionStorage.removeItem('reloading');
    } catch (e) { /* ignorar */ }
    renderPersonalList();
    populateCompaneroSelect();
    renderCalendar();
    // Overlay de bienvenida: mostrar solo en la primera carga de la sesión
    const welcomeOverlay = document.getElementById('welcome-overlay');
    if (welcomeOverlay) {
        const alreadyShown = sessionStorage.getItem('welcome-shown');
        if (!alreadyShown) {
            sessionStorage.setItem('welcome-shown', '1');
            welcomeOverlay.style.display = 'flex';
            const hide = () => {
                welcomeOverlay.classList.add('fade-out');
                setTimeout(() => { welcomeOverlay.style.display = 'none'; welcomeOverlay.classList.remove('fade-out'); }, 320);
            };
            // Ocultar por tiempo o clic
            setTimeout(hide, 1200);
            welcomeOverlay.addEventListener('click', hide, { once: true });
        } else {
            welcomeOverlay.style.display = 'none';
        }
    }
    
    // Verificar si localStorage está disponible
    if (typeof(Storage) === "undefined") {
        showNotification('Advertencia: Su navegador no soporta localStorage. Los datos no se guardarán.');
    } else {
        console.log('localStorage disponible');
    }
    
    // Verificar si es necesario hacer reset anual
    checkAnnualReset();
});

// Configuración de event listeners
function setupEventListeners() {
    // --- Menú hamburguesa ---
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            hamburgerMenu.classList.add('open');
            menuOverlay.classList.add('visible');
            document.body.classList.add('menu-open');
            hamburgerMenu.setAttribute('aria-hidden', 'false');
            menuOverlay.setAttribute('aria-hidden', 'false');
            // Activar interactividad del panel y overlay
            if (hamburgerMenu) hamburgerMenu.removeAttribute('inert');
            if (menuOverlay) menuOverlay.removeAttribute('inert');
            // Pasar foco al botón de cerrar para accesibilidad
            const toFocus = document.getElementById('close-menu-btn');
            if (toFocus) toFocus.focus();
        });
    }
    if (closeMenuBtn) {
        closeMenuBtn.addEventListener('click', () => {
            hamburgerMenu.classList.remove('open');
            menuOverlay.classList.remove('visible');
            document.body.classList.remove('menu-open');
            hamburgerMenu.setAttribute('aria-hidden', 'true');
            menuOverlay.setAttribute('aria-hidden', 'true');
            if (hamburgerMenu) hamburgerMenu.setAttribute('inert', '');
            if (menuOverlay) menuOverlay.setAttribute('inert', '');
            if (hamburgerBtn) hamburgerBtn.focus();
        });
    }
    if (menuOverlay) {
        menuOverlay.addEventListener('click', () => {
            hamburgerMenu.classList.remove('open');
            menuOverlay.classList.remove('visible');
            document.body.classList.remove('menu-open');
            hamburgerMenu.setAttribute('aria-hidden', 'true');
            menuOverlay.setAttribute('aria-hidden', 'true');
            if (hamburgerMenu) hamburgerMenu.setAttribute('inert', '');
            if (menuOverlay) menuOverlay.setAttribute('inert', '');
            if (hamburgerBtn) hamburgerBtn.focus();
        });
    }

    // Eventos para el personal
    addPersonalBtn.addEventListener('click', () => {
        if (!isAdmin()) {
            showNotification('Acción restringida. Solo el admin puede gestionar personal.');
            return;
        }
        openPersonalModal();
    });
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', function() {
            closeModal(this.closest('.modal'));
        });
    });
    document.getElementById('cancel-btn').addEventListener('click', () => closeModal(personalModal));
    personalForm.addEventListener('submit', handlePersonalSubmit);

    // Eventos para los turnos
    document.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            closeModal(this.closest('.modal'));
        });
    });
    turnoForm.addEventListener('submit', handleTurnoSubmit);
    deleteTurnoBtn.addEventListener('click', handleDeleteTurno);
    
    // Eventos para observaciones
    document.getElementById('observaciones-btn').addEventListener('click', showObservacionesEditMode);
    document.getElementById('save-observaciones').addEventListener('click', saveObservaciones);
    document.getElementById('cancel-observaciones').addEventListener('click', cancelObservacionesEdit);
    
    // Evento para cambio de tipo de turno (campos condicionales)
    document.getElementById('turno-tipo').addEventListener('change', handleTipoTurnoChange);
    // Refrescar contador Artículo 26 al cambiar persona o fecha
    const personalSelect = document.getElementById('turno-personal-id');
    const fechaInput = document.getElementById('turno-fecha');
    if (personalSelect) personalSelect.addEventListener('change', updateArticulo26Counter);
    if (fechaInput) fechaInput.addEventListener('change', updateArticulo26Counter);
    // Contador de días de Vacaciones/Estrés
    const fechaInicioInput = document.getElementById('fecha-inicio');
    const fechaFinInput = document.getElementById('fecha-fin');
    if (fechaInicioInput) fechaInicioInput.addEventListener('change', updateVacacionesDiasContador);
    if (fechaFinInput) fechaFinInput.addEventListener('change', updateVacacionesDiasContador);

    // Autofocus entre pares de fechas (Inicio → Fin/Alta)
    const bindAutoFocusDate = (fromEl, toEl) => {
        if (fromEl && toEl && !fromEl.dataset.focusBoundDate) {
            const isCompleteDate = () => {
                try {
                    const v = (fromEl.value || '').trim();
                    let y = null;
                    if (fromEl.type === 'date') {
                        const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                        y = m ? parseInt(m[1], 10) : null;
                    } else {
                        const m = v.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
                        y = m ? parseInt(m[3], 10) : null;
                    }
                    return y !== null && Number.isInteger(y) && y >= 1900;
                } catch { return false; }
            };
            const goNext = () => { if (isCompleteDate()) { try { toEl.focus(); } catch {} } };
            fromEl.addEventListener('change', goNext);
            fromEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goNext(); } });
            fromEl.dataset.focusBoundDate = '1';
        }
    };
    bindAutoFocusDate(fechaInicioInput, fechaFinInput);
    const fechaInicioCarpeta = document.getElementById('fecha-inicio-carpeta');
    const fechaAlta = document.getElementById('fecha-alta');
    bindAutoFocusDate(fechaInicioCarpeta, fechaAlta);
    const fechaSolicitudOtros = document.getElementById('fecha-solicitud-otros');
    const fechaRegresoOtros = document.getElementById('fecha-regreso-otros');
    bindAutoFocusDate(fechaSolicitudOtros, fechaRegresoOtros);

    // Eventos para el calendario
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));
    // Arrastre para desplazar el calendario como táctil (clic izquierdo)
    const calendarContainer = document.querySelector('.calendar-container');
    if (calendarContainer && !calendarContainer.dataset.dragBound) {
        let isDraggingScroll = false;
        let startX = 0;
        let startY = 0;
        let startScrollLeft = 0;
        let startScrollTop = 0;
        let moved = false;

        const onMouseDown = (e) => {
            if (e.button !== 0) return;
            // No interferir con arrastre de filas por el administrador
            if (e.target && e.target.closest && e.target.closest('.name-cell')) return;
            isDraggingScroll = true;
            startX = e.clientX;
            startY = e.clientY;
            startScrollLeft = calendarContainer.scrollLeft;
            startScrollTop = calendarContainer.scrollTop;
            moved = false;
            calendarContainer.classList.add('dragging');
        };

        const onMouseMove = (e) => {
            if (!isDraggingScroll) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
            calendarContainer.scrollLeft = startScrollLeft - dx;
            calendarContainer.scrollTop = startScrollTop - dy;
            e.preventDefault();
        };

        const endDrag = () => {
            if (!isDraggingScroll) return;
            isDraggingScroll = false;
            calendarContainer.classList.remove('dragging');
        };

        const maybeCancelClick = (e) => {
            if (moved) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        calendarContainer.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', endDrag);
        calendarContainer.addEventListener('mouseleave', endDrag);
        // Evitar que un arrastre dispare clicks accidentales
        calendarContainer.addEventListener('click', maybeCancelClick, true);
        calendarContainer.dataset.dragBound = '1';
    }
    
    // Eventos para el personal y secciones
    if (managePersonalBtn) {
        managePersonalBtn.addEventListener('click', () => {
            if (!isAdmin()) {
                showNotification('Acción restringida. Solo el admin puede gestionar personal.');
                return;
            }
            closeHamburgerMenu();
            personalSection.style.display = 'block';
            renderPersonalList();
            // Bloquear scroll del fondo cuando se abre la sección de Personal
            lockBodyScroll();
            // Cerrar al hacer clic en overlay
            const overlayHandler = (ev) => {
                if (ev.target === personalSection) {
                    closeModal(personalSection);
                    personalSection.removeEventListener('click', overlayHandler);
                }
            };
            personalSection.addEventListener('click', overlayHandler);
        });
    }

    // Evento para Configuraciones (resolver posibles null si el DOM aún no estaba)
    const settingsBtnEl = document.getElementById('settings-btn');
    const settingsModalEl = document.getElementById('settings-modal');
    const closeSettingsBtnEl = document.getElementById('close-settings-btn');
    const cancelSettingsBtnEl = document.getElementById('cancel-settings');
    const settingsFormEl = document.getElementById('settings-form');
    if (settingsBtnEl && !settingsBtnEl.dataset.boundClick) {
        settingsBtnEl.addEventListener('click', () => {
            if (!isSuperAdmin()) {
                showNotification('Acción restringida. Solo el superadmin puede abrir configuraciones.');
                return;
            }
            openSettingsModal();
        });
        settingsBtnEl.dataset.boundClick = '1';
    }
    if (closeSettingsBtnEl && !closeSettingsBtnEl.dataset.boundClick) {
        closeSettingsBtnEl.addEventListener('click', () => settingsModalEl && closeModal(settingsModalEl));
        closeSettingsBtnEl.dataset.boundClick = '1';
    }
    if (cancelSettingsBtnEl && !cancelSettingsBtnEl.dataset.boundClick) {
        cancelSettingsBtnEl.addEventListener('click', () => settingsModalEl && closeModal(settingsModalEl));
        cancelSettingsBtnEl.dataset.boundClick = '1';
    }
    if (settingsFormEl && !settingsFormEl.dataset.boundSubmit) {
        settingsFormEl.addEventListener('submit', (e) => {
            e.preventDefault();
            showConfirmModal({
                title: 'Confirmar guardado',
                message: '¿Desea guardar los cambios de configuraciones?',
                onAccept: async () => {
                    if (!isSuperAdmin()) { showNotification('Acción restringida. Solo el superadmin puede guardar configuraciones.'); return; }
                    const tzInput = document.getElementById('settings-timezone');
                    const base = getDefaultCodeMap();
                    const s = getSettings();
                    const codeMap = {};
                    Object.keys(base).forEach(k => {
                        const inp = document.getElementById(`code-${k}`);
                        const v = inp ? inp.value.trim() : '';
                        const nameInp = document.getElementById(`name-${k}`);
                        const nm = nameInp ? nameInp.value.trim() : '';
                        codeMap[k] = { code: v || base[k], name: nm };
                    });
                    const list = document.getElementById('custom-types-list');
                    const customTypes = [];
                    if (list) {
                        Array.from(list.querySelectorAll('.custom-type-row')).forEach(row => {
                            const idI = row.querySelector('.ct-id');
                            const nameI = row.querySelector('.ct-name');
                            const codeI = row.querySelector('.ct-code');
                            const bgI = row.querySelector('.ct-bg');
                            const brI = row.querySelector('.ct-border');
                            const txI = row.querySelector('.ct-text');
                            const timeCk = row.querySelector('.ct-time');
                            const rangeCk = row.querySelector('.ct-range');
                            const idRaw = (idI && idI.value.trim()) || '';
                            const id = sanitizeTypeId(idRaw);
                            const name = (nameI && nameI.value.trim()) || '';
                            const code = (codeI && codeI.value.trim()) || '';
                            if (id && code) {
                                const style = {
                                    bg: (bgI && bgI.value) || '',
                                    border: (brI && brI.value) || '',
                                    text: (txI && txI.value) || ''
                                };
                                const ct = { id, name, code, style, requireTime: !!(timeCk && timeCk.checked), requireDateRange: !!(rangeCk && rangeCk.checked) };
                                const nameOverride = document.getElementById(`name-${id}`);
                                const codeOverride = document.getElementById(`code-${id}`);
                                if (nameOverride) ct.name = nameOverride.value.trim() || ct.name;
                                if (codeOverride) ct.code = codeOverride.value.trim() || ct.code;
                                customTypes.push(ct);
                                codeMap[id] = { code: ct.code, name: ct.name };
                            }
                        });
                    }
                    const newS = {
                        timezone: tzInput ? tzInput.value.trim() || 'America/Argentina/Buenos_Aires' : 'America/Argentina/Buenos_Aires',
                        codeMap,
                        customTypes
                    };
                    const npAdminEl = document.getElementById('new-admin-password');
                    const npSuperEl = document.getElementById('new-superadmin-password');
                    let updatedAdmin = false;
                    let updatedSuper = false;
                    if (npAdminEl && npAdminEl.value.trim()) {
                        newS.adminPassHash = await sha256Hex(npAdminEl.value.trim());
                        updatedAdmin = true;
                    }
                    if (npSuperEl && npSuperEl.value.trim()) {
                        newS.superAdminPassHash = await sha256Hex(npSuperEl.value.trim());
                        updatedSuper = true;
                    }
                    saveSettings(newS);
                    addMovementLog({
                        action: 'password_update',
                        entity: 'settings',
                        user: currentUser ? { username: currentUser.username, role: currentUser.role } : null,
                        timestamp: new Date().toISOString(),
                        details: { updatedAdmin: updatedAdmin, updatedSuperadmin: updatedSuper }
                    });
                    if (settingsModalEl) closeModal(settingsModalEl);
                    showNotification('Configuraciones guardadas');
                    renderCalendar();
                }
            });
        });
        settingsFormEl.dataset.boundSubmit = '1';
    }
    
    if (closePersonalBtn) {
        closePersonalBtn.addEventListener('click', () => {
            // Usar closeModal para asegurar desbloqueo del scroll
            closeModal(personalSection);
        });
    }
    
    // Eventos para estadísticas
    if (viewStatsBtn) {
        viewStatsBtn.addEventListener('click', () => {
            if (!isAdmin()) {
                showNotification('Acción restringida. Solo el admin puede ver estadísticas.');
                return;
            }
            closeHamburgerMenu();
            statsSection.style.display = 'block';
            // Estado inicial limpio al abrir
            if (typeof cleanupStatsModal === 'function') {
                cleanupStatsModal();
            }
            // Poblar selector de nombres
            populateStatsNameOptions();
            renderStats();
            // Mostrar mensaje de guía en el panel de fechas
            renderStatsDates();
            loadAnnualLogs();
            // Bloquear scroll del fondo cuando se abre la sección de Estadísticas
            lockBodyScroll();
            // Cerrar al hacer clic en overlay
            const overlayHandlerStats = (ev) => {
                if (ev.target === statsSection) {
                    // Limpieza específica de la sección de estadísticas
                    if (typeof cleanupStatsModal === 'function') {
                        cleanupStatsModal();
                    }
                    closeModal(statsSection);
                    statsSection.removeEventListener('click', overlayHandlerStats);
                }
            };
            statsSection.addEventListener('click', overlayHandlerStats);
        });
    }
    
    if (closeStatsBtn) {
        closeStatsBtn.addEventListener('click', () => {
            // Usar closeModal para asegurar desbloqueo del scroll
            // Limpieza específica de la sección de estadísticas
            if (typeof cleanupStatsModal === 'function') {
                cleanupStatsModal();
            }
            closeModal(statsSection);
        });
    }
    
    // Event listeners para tabs de estadísticas
    document.getElementById('current-stats-tab').addEventListener('click', function() {
        switchStatsTab('current');
    });

    document.getElementById('annual-logs-tab').addEventListener('click', function() {
        switchStatsTab('logs');
        loadAnnualLogs();
    });

    const movementTabBtn = document.getElementById('movement-logs-tab');
    if (movementTabBtn) {
        movementTabBtn.addEventListener('click', function() {
            switchStatsTab('movements');
            // Poblar opciones de personal para filtro
            const sel = document.getElementById('movement-log-personal-filter');
            if (sel) {
                // Limpiar manteniendo opción "Todos"
                const keepFirst = sel.querySelector('option[value=""]');
                sel.innerHTML = '';
                const optAll = document.createElement('option');
                optAll.value = '';
                optAll.textContent = 'Todos';
                sel.appendChild(optAll);
                // Agregar personal
                personal.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = String(p.id);
                    opt.textContent = `${p.nombre} ${p.apellido}`;
                    sel.appendChild(opt);
                });
                // Cambiar recarga al cambiar selección
                sel.addEventListener('change', () => {
                    loadMovementLogs();
                }, { once: false });
            }
            loadMovementLogs();
        });
    }

    // Event listener para reset manual (removido del UI; proteger por si no existe)
    const manualResetBtn = document.getElementById('manual-reset-btn');
    if (manualResetBtn) {
        manualResetBtn.addEventListener('click', function() {
            if (!isAdmin()) {
                showNotification('Acción restringida. Solo el admin puede hacer reset manual.');
                return;
            }
            closeHamburgerMenu();
            document.getElementById('reset-confirmation-modal').style.display = 'block';
            lockBodyScroll();
        });
    }

    // Búsqueda por selección de nombre

    // Cambio de selección de nombre
    if (statsNameSelect) {
        statsNameSelect.addEventListener('change', () => {
            renderStats();
            renderStatsDates();
        });
    }

    // Event listeners para modal de confirmación de reset
    document.getElementById('cancel-reset-btn').addEventListener('click', function() {
        const resetM = document.getElementById('reset-confirmation-modal');
        closeModal(resetM);
    });

    document.getElementById('confirm-reset-btn').addEventListener('click', function() {
        const resetM = document.getElementById('reset-confirmation-modal');
        closeModal(resetM);
        
        const resetSuccess = resetAnnualData('manual');
        if (resetSuccess) {
            const currentYear = new Date().getFullYear();
            localStorage.setItem('vigilancia-last-reset-year', currentYear.toString());
            renderStats();
            loadAnnualLogs();
        }
    });

    // Cerrar modal al hacer clic fuera de él
    window.addEventListener('click', function(event) {
        const resetModal = document.getElementById('reset-confirmation-modal');
        if (event.target === resetModal) {
            closeModal(resetModal);
        }
    });

    // Eventos de sesión
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            closeHamburgerMenu();
            if (loginModal) {
                loginModal.style.display = 'block';
                lockBodyScroll();
            }
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    if (closeLoginModalBtn) {
        closeLoginModalBtn.addEventListener('click', () => closeModal(loginModal));
    }
    if (cancelLoginBtn) {
        cancelLoginBtn.addEventListener('click', () => closeModal(loginModal));
    }
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    // Enlaces de login removidos, no se agregan handlers

    // Auto-logout por inactividad (solo admin)
    initAdminIdleLogout();

    // Exportación / Importación de datos
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', () => {
            exportAllData();
        });
    }
    if (importDataBtn && importFileInput) {
        importDataBtn.addEventListener('click', () => {
            importFileInput.value = '';
            importFileInput.click();
        });
        importFileInput.addEventListener('change', (e) => {
            const f = e.target.files && e.target.files[0];
            if (f) importAllDataFromFile(f);
        });
    }

    // Exportar calendario a PDF
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => {
            exportCalendarToPDF();
        });
    }

    // Exportar calendario a Excel (botón eliminado)
}
    
// Función para renderizar las estadísticas
function renderStats() {
    const statsList = document.getElementById('stats-list');
    if (!statsList) return;
    
    statsList.innerHTML = '';
    (function(){
        const head = document.querySelector('#stats-table thead tr');
        if (!head) return;
        const s = getSettings();
        const customTypes = (s && Array.isArray(s.customTypes)) ? s.customTypes.map(ct => ct.id) : [];
        const typesOrder = ['guardia_fija','ausente','compensatorio','estres','articulo26','vacaciones','carpeta_medica','cambios_guardia','dia_sindical','dia_estudio', ...customTypes];
        while (head.children.length > 1) head.removeChild(head.lastChild);
        typesOrder.forEach(t => {
            const th = document.createElement('th');
            th.textContent = getTypeLabel(t);
            head.appendChild(th);
        });
    })();
    
    console.log("Personal array:", personal);
    console.log("Turnos object:", turnos);
    console.log("Personal length:", personal.length);
    
    // Si no hay personal, mostrar mensaje
    if (personal.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center">No hay personal registrado</td>';
        statsList.appendChild(row);
        return;
    }
    
    // Texto de búsqueda (nombre/apellido)
    const selectedId = document.getElementById('stats-name-select')?.value || '';

    // Si hay selector de nombre, mostrar solo cuando se seleccione
    const filteredPersonal = personal.filter(p => String(p.id) === String(selectedId));

    if (selectedId && filteredPersonal.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="11" class="text-center">No hay registros para el personal seleccionado</td>';
        statsList.appendChild(row);
        return;
    }

    if (!selectedId) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="11" class="text-center">Seleccione un personal para ver sus estadísticas</td>';
        statsList.appendChild(row);
        return;
    }

    (function(){
        const head = document.querySelector('#stats-table thead tr');
        if (!head) return;
        const s = getSettings();
        const customTypes = (s && Array.isArray(s.customTypes)) ? s.customTypes.map(ct => ct.id) : [];
        const typesOrder = ['guardia_fija','ausente','compensatorio','estres','articulo26','vacaciones','carpeta_medica','cambios_guardia','dia_sindical','dia_estudio', ...customTypes];
        // Reconstruir encabezado manteniendo la primera celda "Personal"
        while (head.children.length > 1) head.removeChild(head.lastChild);
        typesOrder.forEach(t => {
            const th = document.createElement('th');
            th.textContent = getTypeLabel(t);
            head.appendChild(th);
        });
    })();

    // Iterar personal filtrado
    const s = getSettings();
    const customTypes = (s && Array.isArray(s.customTypes)) ? s.customTypes.map(ct => ct.id) : [];
    const typesOrder = ['guardia_fija','ausente','compensatorio','estres','articulo26','vacaciones','carpeta_medica','cambios_guardia','dia_sindical','dia_estudio', ...customTypes];

    filteredPersonal.forEach(persona => {
        const row = document.createElement('tr');
        const counts = {};
        typesOrder.forEach(t => { counts[t] = 0; });

        for (const fecha in turnos) {
            const y = new Date(fecha).getFullYear();
            if (y !== currentYear) continue;
            const turnoPersona = turnos[fecha][persona.id];
            if (turnoPersona && turnoPersona.tipo) {
                if (counts[turnoPersona.tipo] == null) counts[turnoPersona.tipo] = 0;
                counts[turnoPersona.tipo]++;
            }
        }

        const cells = [`<td>${persona.nombre} ${persona.apellido}</td>`].concat(
            typesOrder.map(t => `<td>${counts[t] || 0}</td>`)
        );
        row.innerHTML = cells.join('');
        statsList.appendChild(row);
    });
    
    console.log("Estadísticas renderizadas con " + personal.length + " personas");

    // También renderizar los registros de fechas por tipo (excluyendo guardias)
    renderStatsDates();
}

function populateStatsNameOptions() {
    if (!statsNameSelect) return;
    // Reiniciar opciones dejando el placeholder
    statsNameSelect.innerHTML = '<option value="">Seleccione personal</option>';
    personal.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nombre} ${p.apellido}`;
        statsNameSelect.appendChild(opt);
    });
}

// Renderiza un listado de fechas por tipo para el personal seleccionado
function renderStatsDates() {
    const container = document.getElementById('stats-dates-record');
    if (!container) return;
    container.innerHTML = '';

    const selectedId = document.getElementById('stats-name-select')?.value || '';
    if (!selectedId) {
        const info = document.createElement('div');
        info.textContent = 'Seleccione un personal para ver el detalle de fechas por tipo.';
        info.style.color = '#666';
        info.style.fontSize = '13px';
        container.appendChild(info);
        return;
    }

    const s = getSettings();
    const customTypes = (s && Array.isArray(s.customTypes)) ? s.customTypes.map(ct => ct.id) : [];
    const baseTypes = ['ausente','compensatorio','estres','articulo26','vacaciones','carpeta_medica','cambios_guardia','dia_sindical','dia_estudio'];
    const allTypes = baseTypes.concat(customTypes);
    const tipoLabels = {};
    allTypes.forEach(t => { tipoLabels[t] = getTypeLabel(t); });
    const fechasPorTipo = {};
    allTypes.forEach(t => { fechasPorTipo[t] = []; });

    // Recopilar fechas del año actual (excluyendo guardias)
    Object.keys(turnos).forEach(fecha => {
        const y = new Date(fecha).getFullYear();
        if (y !== currentYear) return;
        const turno = turnos[fecha][selectedId];
        if (!turno) return;
        if (turno.tipo === 'guardia_fija') return;
        if (!fechasPorTipo[turno.tipo]) fechasPorTipo[turno.tipo] = [];
        fechasPorTipo[turno.tipo].push(fecha);
    });

    // Construir UI: sección por tipo con fechas ordenadas cronológicamente
    const title = document.createElement('h3');
    title.textContent = 'Detalle de fechas por tipo';
    title.style.fontSize = '16px';
    title.style.margin = '6px 0 10px 0';
    title.style.color = '#2c3e50';
    container.appendChild(title);

    const types = Object.keys(fechasPorTipo);
    if (types.every(t => fechasPorTipo[t].length === 0)) {
        const empty = document.createElement('div');
        empty.textContent = 'No hay registros de fechas para el personal seleccionado.';
        empty.style.color = '#666';
        empty.style.fontSize = '13px';
        container.appendChild(empty);
        return;
    }
    
    // Meses en español para encabezados
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    types.forEach(tipo => {
        const fechas = fechasPorTipo[tipo];
        if (!fechas.length) return; // saltar tipos sin fechas

        // Agrupar por mes (YYYY-MM)
        const porMes = {};
        fechas.forEach(f => {
            const d = parseDateLocal(f);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
            if (!porMes[key]) porMes[key] = [];
            porMes[key].push(f);
        });

        // Ordenar meses cronológicamente
        const monthKeys = Object.keys(porMes).sort();
        const totalTipo = fechas.length;

        // Crear bloque del tipo con botón colapsable
        const block = document.createElement('div');
        block.style.marginBottom = '10px';
        block.style.paddingBottom = '6px';
        block.style.borderBottom = '1px dashed #e3e3e3';
        container.appendChild(block);

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.style.display = 'flex';
        toggleBtn.style.alignItems = 'center';
        toggleBtn.style.gap = '6px';
        toggleBtn.style.width = '100%';
        toggleBtn.style.background = '#f7f9fc';
        toggleBtn.style.border = '1px solid #dfe6ee';
        toggleBtn.style.borderRadius = '6px';
        toggleBtn.style.padding = '6px 8px';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.color = '#2c3e50';
        toggleBtn.style.fontWeight = '600';
        toggleBtn.style.fontSize = '13px';
        block.appendChild(toggleBtn);

        const arrow = document.createElement('span');
        arrow.textContent = '▸';
        arrow.style.fontSize = '12px';
        arrow.style.color = '#2c3e50';
        toggleBtn.appendChild(arrow);

        const labelText = document.createElement('span');
        labelText.textContent = `${tipoLabels[tipo] || tipo} (${totalTipo})`;
        toggleBtn.appendChild(labelText);

        const content = document.createElement('div');
        content.style.display = 'none';
        content.style.marginTop = '6px';
        content.style.paddingLeft = '4px';
        block.appendChild(content);

        toggleBtn.addEventListener('click', () => {
            const isOpen = content.style.display !== 'none';
            content.style.display = isOpen ? 'none' : 'block';
            arrow.textContent = isOpen ? '▸' : '▾';
        });

        // Renderizar meses y fechas dentro del contenido colapsable
        monthKeys.forEach(key => {
            const [y, m] = key.split('-').map(n => parseInt(n, 10));
            const nombreMes = `${meses[m - 1]} ${y}`;
            const fechasMes = porMes[key].slice().sort((a, b) => {
                const da = parseDateLocal(a).getTime();
                const db = parseDateLocal(b).getTime();
                return da - db;
            });
            const mesBlock = document.createElement('div');
            mesBlock.style.margin = '2px 0 8px 0';
            content.appendChild(mesBlock);

            const mesHeader = document.createElement('div');
            mesHeader.textContent = `${nombreMes} (${fechasMes.length})`;
            mesHeader.style.fontWeight = '500';
            mesHeader.style.fontSize = '12px';
            mesHeader.style.marginBottom = '4px';
            mesHeader.style.color = '#34495e';
            mesBlock.appendChild(mesHeader);

            const list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexWrap = 'wrap';
            list.style.gap = '6px';
            mesBlock.appendChild(list);

            fechasMes.forEach(f => {
                const pill = document.createElement('span');
                pill.textContent = formatDateShort(f);
                pill.className = 'date-pill';
                pill.style.padding = '4px 8px';
                pill.style.border = '1px solid #e0e0e0';
                pill.style.borderRadius = '12px';
                pill.style.fontSize = '12px';
                pill.style.background = '#fff';
                pill.style.color = '#333';
                list.appendChild(pill);
            });
        });
    });
}

// Funciones para el manejo de personal
function renderPersonalList() {
    personalList.innerHTML = '';
    
    if (personal.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="4" class="text-center">No hay personal registrado</td>';
        personalList.appendChild(emptyRow);
        return;
    }

    personal.forEach(persona => {
        const row = document.createElement('tr');
        let usadosVac = 0;
        let usadosEst = 0;
        const yActual = currentYear;
        Object.keys(turnos).forEach(f => {
            const y = new Date(f).getFullYear();
            if (y === yActual) {
                const t = turnos[f][persona.id];
                if (t && t.tipo === 'vacaciones') usadosVac++;
                if (t && t.tipo === 'estres') usadosEst++;
            }
        });
        const totalVac = typeof persona.diasVacaciones === 'number' ? persona.diasVacaciones : null;
        const totalEst = typeof persona.diasEstres === 'number' ? persona.diasEstres : null;
        const restoVac = (totalVac != null) ? Math.max(0, totalVac - usadosVac) : null;
        const restoEst = (totalEst != null) ? Math.max(0, totalEst - usadosEst) : null;
        const vacUsados = (totalVac != null) ? usadosVac : null;
        const vacResto = (totalVac != null) ? restoVac : null;
        const estUsados = (totalEst != null) ? usadosEst : null;
        const estResto = (totalEst != null) ? restoEst : null;

        const ws = persona.workSchedule || null;
        const daysLabel = ws ? getDaysLabel(ws.days) : ((persona.modalidadTrabajo === 'sadofe') ? 'SADOFE' : 'Día de semana');
        const timeLabel = ws ? (ws.type === 'per_day' ? 'Por día' : formatTimeRange(ws.start, ws.end)) : '-';
        row.innerHTML = `
            <td>${persona.nombre}</td>
            <td>${persona.apellido}</td>
            <td title="Días de trabajo">${daysLabel}${ws && ws.type === 'fixed' ? ` · ${timeLabel}` : (ws && ws.type === 'per_day' ? ' · Por día' : '')}</td>
            <td title="Turno preferente">${persona.turnoPreferente === 'noche' ? 'Noche' : 'Día'}</td>
            <td title="Vacaciones / Estrés">
                <div class="ve-stats">
                    <div class="ve-item">
                        <span class="ve-label">V:</span>
                        <span class="ve-value">${vacUsados == null ? '-' : `${vacUsados} tomados`}</span>
                        <span class="ve-sep">·</span>
                        <span class="ve-remain">${vacResto == null ? '-' : `${vacResto} a favor`}</span>
                    </div>
                    <div class="ve-item">
                        <span class="ve-label">E:</span>
                        <span class="ve-value">${estUsados == null ? '-' : `${estUsados} tomados`}</span>
                        <span class="ve-sep">·</span>
                        <span class="ve-remain">${estResto == null ? '-' : `${estResto} a favor`}</span>
                    </div>
                </div>
            </td>
            <td class="action-buttons">
                <div class="action-buttons-inner">
                    <button class="btn-secondary edit-btn" data-id="${persona.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger delete-btn" data-id="${persona.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        personalList.appendChild(row);

        // Agregar event listeners a los botones
        row.querySelector('.edit-btn').addEventListener('click', () => editPersonal(persona.id));
        row.querySelector('.delete-btn').addEventListener('click', () => deletePersonal(persona.id));
    });
    populateCompaneroSelect();
}

function openPersonalModal(id = null) {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede abrir este modal.');
        return;
    }
    closeHamburgerMenu();
    const persona = id ? personal.find(p => p.id === id) : null;
    
    document.getElementById('modal-title').textContent = persona ? 'Editar Personal' : 'Agregar Personal';
    document.getElementById('personal-id').value = persona ? persona.id : '';
    
    if (persona) {
        document.getElementById('nombre').value = persona.nombre;
        document.getElementById('apellido').value = persona.apellido;
        const modalidadSelect = document.getElementById('modalidad-trabajo');
        if (modalidadSelect) modalidadSelect.value = persona.modalidadTrabajo || 'semana';
        const turnoPrefSelect = document.getElementById('turno-preferente');
        if (turnoPrefSelect) turnoPrefSelect.value = persona.turnoPreferente || 'dia';
        // Prefill nuevos campos si existen
        const diasVacInput = document.getElementById('dias-vacaciones');
        const diasEstresInput = document.getElementById('dias-estres');
        if (diasVacInput) diasVacInput.value = (typeof persona.diasVacaciones === 'number') ? persona.diasVacaciones : '';
        if (diasEstresInput) diasEstresInput.value = (typeof persona.diasEstres === 'number') ? persona.diasEstres : '';
        const ws = persona.workSchedule || null;
        ['0','1','2','3','4','5','6'].forEach(d => {
            const cb = document.getElementById(`work-day-${d}`);
            if (cb) cb.checked = false;
        });
        if (ws && Array.isArray(ws.days)) {
            ws.days.forEach(d => {
                const cb = document.getElementById(`work-day-${d}`);
                if (cb) cb.checked = true;
            });
        }
        const ss = document.getElementById('schedule-start');
        const se = document.getElementById('schedule-end');
        if (ss) ss.value = (ws && ws.start) ? ws.start : '';
        if (se) se.value = (ws && ws.end) ? ws.end : '';
        const ah = document.getElementById('apply-holidays');
        if (ah) ah.checked = Boolean(ws && ws.applyHolidays);
        const fixedRadio = document.getElementById('schedule-type-fixed');
        const perdayRadio = document.getElementById('schedule-type-perday');
        if (fixedRadio && perdayRadio) {
            const isPerDay = ws && ws.type === 'per_day';
            perdayRadio.checked = Boolean(isPerDay);
            fixedRadio.checked = !Boolean(isPerDay);
        }
        if (ws && ws.type === 'per_day' && ws.perDay) {
            ['0','1','2','3','4','5','6'].forEach(d => {
                const ps = document.getElementById(`per-start-${d}`);
                const pe = document.getElementById(`per-end-${d}`);
                const info = ws.perDay[d];
                if (ps) ps.value = info && info.start ? info.start : '';
                if (pe) pe.value = info && info.end ? info.end : '';
            });
        } else {
            ['0','1','2','3','4','5','6'].forEach(d => {
                const ps = document.getElementById(`per-start-${d}`);
                const pe = document.getElementById(`per-end-${d}`);
                if (ps) ps.value = '';
                if (pe) pe.value = '';
            });
        }
        const fixedBlock = document.getElementById('schedule-fixed');
        const perdayBlock = document.getElementById('schedule-perday');
        const isPerDayNow = ws && ws.type === 'per_day';
        if (fixedBlock) fixedBlock.style.display = isPerDayNow ? 'none' : '';
        if (perdayBlock) perdayBlock.style.display = isPerDayNow ? '' : 'none';
    } else {
        personalForm.reset();
        const modalidadSelect = document.getElementById('modalidad-trabajo');
        if (modalidadSelect) modalidadSelect.value = 'semana';
        const turnoPrefSelect = document.getElementById('turno-preferente');
        if (turnoPrefSelect) turnoPrefSelect.value = 'dia';
        const diasVacInput = document.getElementById('dias-vacaciones');
        const diasEstresInput = document.getElementById('dias-estres');
        if (diasVacInput) diasVacInput.value = '';
        if (diasEstresInput) diasEstresInput.value = '';
        ['0','1','2','3','4','5','6'].forEach(d => {
            const cb = document.getElementById(`work-day-${d}`);
            if (cb) cb.checked = false;
        });
        const ss = document.getElementById('schedule-start');
        const se = document.getElementById('schedule-end');
        if (ss) ss.value = '';
        if (se) se.value = '';
        const ah = document.getElementById('apply-holidays');
        if (ah) ah.checked = false;
        const fixedRadio = document.getElementById('schedule-type-fixed');
        const perdayRadio = document.getElementById('schedule-type-perday');
        if (fixedRadio) fixedRadio.checked = true;
        if (perdayRadio) perdayRadio.checked = false;
        ['0','1','2','3','4','5','6'].forEach(d => {
            const ps = document.getElementById(`per-start-${d}`);
            const pe = document.getElementById(`per-end-${d}`);
            if (ps) ps.value = '';
            if (pe) pe.value = '';
        });
        const fixedBlock = document.getElementById('schedule-fixed');
        const perdayBlock = document.getElementById('schedule-perday');
        if (fixedBlock) fixedBlock.style.display = '';
        if (perdayBlock) perdayBlock.style.display = 'none';
    }
    setupPersonalScheduleUI();
    updateWorkdaysVisuals();
    
    personalModal.style.display = 'block';
    lockBodyScroll();
    applyTimeInputsFormat();
}

function handlePersonalSubmit(e) {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede modificar personal.');
        return;
    }
    e.preventDefault();
    
    const id = document.getElementById('personal-id').value || generateId();
    const nombre = document.getElementById('nombre').value;
    const apellido = document.getElementById('apellido').value;
    const modalidadTrabajo = document.getElementById('modalidad-trabajo').value;
    const turnoPreferente = document.getElementById('turno-preferente').value;
    const diasVacacionesRaw = document.getElementById('dias-vacaciones').value;
    const diasEstresRaw = document.getElementById('dias-estres').value;
    const diasVacaciones = diasVacacionesRaw !== '' ? parseInt(diasVacacionesRaw, 10) : null;
    const diasEstres = diasEstresRaw !== '' ? parseInt(diasEstresRaw, 10) : null;
    const workDays = Array.from(document.querySelectorAll('input[name="work-days"]:checked')).map(el => parseInt(el.value, 10)).filter(n => Number.isInteger(n));
    const scheduleStart = document.getElementById('schedule-start').value || '';
    const scheduleEnd = document.getElementById('schedule-end').value || '';
    const applyHolidays = Boolean(document.getElementById('apply-holidays').checked);
    const isPerDay = Boolean(document.getElementById('schedule-type-perday') && document.getElementById('schedule-type-perday').checked);
    let workSchedule = null;
    if (isPerDay) {
        const perDay = {};
        ['0','1','2','3','4','5','6'].forEach(d => {
            const ps = document.getElementById(`per-start-${d}`);
            const pe = document.getElementById(`per-end-${d}`);
            const s = ps ? ps.value : '';
            const e2 = pe ? pe.value : '';
            if (s) perDay[d] = { start: s, end: e2 || '' };
        });
        const perDaysList = Object.keys(perDay).map(x => parseInt(x,10));
        workSchedule = perDaysList.length > 0 ? { type: 'per_day', perDay, days: perDaysList, applyHolidays } : null;
    } else {
        workSchedule = (workDays.length > 0 && scheduleStart && scheduleEnd) ? { type: 'fixed', days: workDays, start: scheduleStart, end: scheduleEnd, applyHolidays } : null;
    }
    const isEdit = !!document.getElementById('personal-id').value;
    const prev = isEdit ? personal.find(p => p.id === id) : null;
    
    if (document.getElementById('personal-id').value) {
        // Editar personal existente
        const index = personal.findIndex(p => p.id === id);
        if (index !== -1) {
            personal[index] = { id, nombre, apellido, modalidadTrabajo, turnoPreferente, diasVacaciones, diasEstres, workSchedule };
        }
    } else {
        // Agregar nuevo personal
        personal.push({ id, nombre, apellido, modalidadTrabajo, turnoPreferente, diasVacaciones, diasEstres, workSchedule });
    }
    
    renderPersonalList();
    renderCalendar();
    
    // Guardar datos en localStorage
    saveData();

    // Log de movimiento
    addMovementLog({
        action: isEdit ? 'personal_edit' : 'personal_add',
        entity: 'personal',
        user: currentUser ? { username: currentUser.username, role: currentUser.role } : null,
        timestamp: new Date().toISOString(),
        details: {
            id,
            nombre,
            apellido,
            modalidadTrabajo,
            turnoPreferente,
            diasVacaciones,
            diasEstres,
            workSchedule,
            before: prev || undefined
        }
    });
    
    closeModal(personalModal);
}

function editPersonal(id) {
    openPersonalModal(id);
}

function deletePersonal(id) {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede eliminar personal.');
        return;
    }
    showConfirmModal({
        title: 'Confirmar eliminación',
        message: '¿Está seguro que desea eliminar este personal?',
        onAccept: () => {
            const prev = personal.find(p => p.id === id) || null;
            personal = personal.filter(p => p.id !== id);

            // Eliminar turnos asociados
            for (const fecha in turnos) {
                if (turnos[fecha][id]) {
                    delete turnos[fecha][id];
                }
            }

            renderPersonalList();
            renderCalendar();

            // Guardar datos en localStorage
            saveData();

            // Log de movimiento
            addMovementLog({
                action: 'personal_delete',
                entity: 'personal',
                user: currentUser ? { username: currentUser.username, role: currentUser.role } : null,
                timestamp: new Date().toISOString(),
                details: prev ? { id: prev.id, nombre: prev.nombre, apellido: prev.apellido, modalidadTrabajo: prev.modalidadTrabajo } : { id }
            });
        }
    });
}

// Funciones para el manejo del calendario
// Utilidades para orden manual de filas
function getManualOrderKey(modalidad) {
    return modalidad === 'sadofe' ? 'vigilancia-order-sadofe' : 'vigilancia-order-sem';
}

function getManualOrder(modalidad) {
    try {
        const raw = localStorage.getItem(getManualOrderKey(modalidad));
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.map(id => String(id)) : [];
    } catch {
        return [];
    }
}

function saveManualOrder(modalidad, orderIds) {
    try {
        localStorage.setItem(getManualOrderKey(modalidad), JSON.stringify(orderIds.map(id => String(id))));
    } catch {}
}

function sortWithManualOrder(list, modalidad) {
    const manual = getManualOrder(modalidad);
    const idxMap = new Map(manual.map((id, idx) => [String(id), idx]));
    return [...list].sort((a, b) => {
        const ai = idxMap.has(String(a.id)) ? idxMap.get(String(a.id)) : Number.MAX_SAFE_INTEGER;
        const bi = idxMap.has(String(b.id)) ? idxMap.get(String(b.id)) : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        // Fallback original: turno Día primero, luego nombre
        const aShift = (a && a.turnoPreferente === 'noche') ? 1 : 0;
        const bShift = (b && b.turnoPreferente === 'noche') ? 1 : 0;
        if (aShift !== bShift) return aShift - bShift;
        const aName = `${a.apellido || ''} ${a.nombre || ''}`.trim().toLowerCase();
        const bName = `${b.apellido || ''} ${b.nombre || ''}`.trim().toLowerCase();
        return aName.localeCompare(bName);
    });
}

function getHolidayStore() {
    try {
        const raw = localStorage.getItem('vigilancia-holidays');
        const obj = raw ? JSON.parse(raw) : {};
        return obj && typeof obj === 'object' ? obj : {};
    } catch {
        return {};
    }
}

function saveHolidayStore(obj) {
    try {
        localStorage.setItem('vigilancia-holidays', JSON.stringify(obj));
    } catch {}
}

function getMonthKey(year, month) {
    const mm = String(month + 1).padStart(2, '0');
    return `${year}-${mm}`;
}

function getHolidays(year, month) {
    const store = getHolidayStore();
    const key = getMonthKey(year, month);
    const arr = store[key] || [];
    return Array.isArray(arr) ? arr.map(n => parseInt(n, 10)).filter(n => Number.isInteger(n) && n >= 1) : [];
}

function isHoliday(year, month, day) {
    return getHolidays(year, month).includes(day);
}

function toggleHoliday(year, month, day) {
    const store = getHolidayStore();
    const key = getMonthKey(year, month);
    const current = Array.isArray(store[key]) ? store[key].map(n => parseInt(n, 10)).filter(n => Number.isInteger(n) && n >= 1) : [];
    const idx = current.indexOf(day);
    if (idx >= 0) {
        current.splice(idx, 1);
    } else {
        current.push(day);
    }
    current.sort((a, b) => a - b);
    store[key] = current;
    saveHolidayStore(store);
}

function renderCalendar() {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    currentMonthElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    // Generar encabezados de días
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Limpiar encabezados anteriores y mantener la primera columna
    while (calendarDays.children.length > 1) {
        calendarDays.removeChild(calendarDays.lastChild);
    }
    
    // Crear un fragmento de documento para mejorar el rendimiento
    const headerFragment = document.createDocumentFragment();
    
    // Agregar días del mes
    for (let day = 1; day <= daysInMonth; day++) {
        const th = document.createElement('th');
        th.textContent = day;
        th.dataset.dayIndex = String(day);
        
        // Destacar fin de semana
        const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            th.classList.add('weekend');
        }
        if (isHoliday(currentYear, currentMonth, day)) {
            th.classList.add('weekend');
            th.title = 'Feriado';
        }

        th.addEventListener('click', () => {
            if (!isAdmin()) {
                showNotification('Solo el admin puede marcar feriados');
                return;
            }
            toggleHoliday(currentYear, currentMonth, day);
            renderCalendar();
        });
        
        headerFragment.appendChild(th);
    }
    
    // Agregar todos los encabezados de una vez
    calendarDays.appendChild(headerFragment);
    
    // Crear fragmento para el cuerpo del calendario
    const bodyFragment = document.createDocumentFragment();
    
    // Orden visual: primero 'semana', luego 'sadofe'; dentro de cada grupo usar orden manual si existe
    const semanaGroup = personal.filter(p => p && p.modalidadTrabajo !== 'sadofe');
    const sadofeGroup = personal.filter(p => p && p.modalidadTrabajo === 'sadofe');
    const orderedSemana = sortWithManualOrder(semanaGroup, 'semana');
    const orderedSadofe = sortWithManualOrder(sadofeGroup, 'sadofe');
    const orderedPersonal = [...orderedSemana, ...orderedSadofe];
    
    // Guías verticales deshabilitadas: solo guía horizontal en la fila

    orderedPersonal.forEach(persona => {
        const row = document.createElement('tr');
        // Marcar fila SADOFE para estilos invertidos (semana oscuro, finde claro)
        if (persona && persona.modalidadTrabajo === 'sadofe') {
            row.classList.add('sadofe-row');
        }
        row.dataset.personalId = String(persona.id);
        row.dataset.modalidad = persona.modalidadTrabajo === 'sadofe' ? 'sadofe' : 'semana';
        row.draggable = false; // activamos solo desde la celda de nombre
        row.addEventListener('mouseenter', () => {
            row.classList.add('row-highlight');
        });
        row.addEventListener('mouseleave', () => {
            row.classList.remove('row-highlight');
        });
        
        // Columna con nombre del personal
        const nameCell = document.createElement('td');
        nameCell.classList.add('name-cell');
        nameCell.textContent = `${persona.apellido}, ${persona.nombre}`;
        // Mostrar cursor de arrastre solo si es admin
        try {
            const canDrag = isAdmin();
            nameCell.style.cursor = canDrag ? 'grab' : 'default';
        } catch {}
        // Permitir arrastre solo para admin
        nameCell.addEventListener('mousedown', (ev) => {
            if (!isAdmin()) {
                return; // No mostrar notificación aquí para no molestar al usuario
            }
            row.draggable = true;
            row.classList.add('dragging');
        });
        nameCell.addEventListener('mouseup', () => {
            row.draggable = false;
            row.classList.remove('dragging');
        });
        nameCell.addEventListener('mouseleave', () => {
            row.draggable = false;
            row.classList.remove('dragging');
        });
        row.addEventListener('dragstart', (e) => {
            if (!isAdmin()) {
                e.preventDefault();
                return;
            }
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(persona.id));
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            row.draggable = false;
        });
        row.addEventListener('dragover', (e) => {
            e.preventDefault(); // necesario para permitir drop
        });
        row.addEventListener('dragenter', () => {
            row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', () => {
            row.classList.remove('drag-over');
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.classList.remove('drag-over');
            if (!isAdmin()) return;
            const fromId = e.dataTransfer.getData('text/plain');
            const toId = String(persona.id);
            const modalidad = row.dataset.modalidad || 'semana';
            // Solo permitir reordenar dentro de la misma modalidad
            const draggedRow = calendarBody.querySelector(`tr[data-personal-id="${fromId}"]`);
            if (draggedRow && draggedRow.dataset.modalidad !== modalidad) {
                return; // ignorar si son de diferente grupo
            }
            // Obtener orden actual visible para la modalidad desde el DOM
            const rows = Array.from(calendarBody.querySelectorAll(`tr[data-modalidad="${modalidad}"]`));
            const currentIds = rows.map(r => String(r.dataset.personalId));
            const fromIndex = currentIds.indexOf(fromId);
            let toIndex = currentIds.indexOf(toId);
            // Decidir inserción arriba/abajo según posición del cursor
            const rect = row.getBoundingClientRect();
            const dropAfter = (e.clientY - rect.top) > rect.height / 2;
            if (dropAfter) toIndex = toIndex + 1;
            // Reconstruir nuevo orden
            if (fromIndex === -1 || toIndex === -1) return;
            const newOrder = currentIds.filter(id => id !== fromId);
            newOrder.splice(toIndex > fromIndex ? Math.min(toIndex - 1, newOrder.length) : Math.min(toIndex, newOrder.length), 0, fromId);
            saveManualOrder(modalidad, newOrder);
            renderCalendar();
        });
        row.appendChild(nameCell);
        
        // Celdas para cada día del mes
        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('td');
            cell.dataset.dayIndex = String(day);
            const dateStr = formatDate(new Date(currentYear, currentMonth, day));
            // Marcar fin de semana en el cuerpo del calendario (sábado y domingo)
            const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday(currentYear, currentMonth, day)) {
                cell.classList.add('weekend');
            }
            
            // Verificar si hay un turno asignado para esta persona en esta fecha
            const turno = turnos[dateStr] && turnos[dateStr][persona.id];
            
            if (turno) {
                const cellContent = document.createElement('div');
                cellContent.classList.add('calendar-cell', `turno-${turno.tipo}`);
                // Para cambios de guardia: aplicar estilo de guardia (celeste) en cobertura y devolución
                if (turno.tipo === 'cambios_guardia' && (turno.rolCG === 'cubre' || turno.rolCG === 'devuelve')) {
                    cellContent.classList.add('turno-guardia_fija');
                }
                
                // Crear un mapa de códigos para mejor rendimiento
                const codigoMap = {
                    'guardia_fija': 'G',
                    'ausente': '28',
                    'vacaciones': 'V',
                    'compensatorio': 'CP',
                    'estres': 'EST',
                    'cambios_guardia': 'CG',
                    'articulo26': 'A26',
                    'carpeta_medica': 'CM',
                    'dia_sindical': 'S',
                    'sindical': 'S',
                    'dia_estudio': 'D.E'
                };
                
                const codigoTurno = getCodigoForTipo(turno.tipo);
                
                // Crear elemento para el código
                const codigoElement = document.createElement('span');
                codigoElement.classList.add('codigo-turno');
                if (turno.tipo === 'cambios_guardia') {
                    if (turno.rolCG === 'cubre') {
                        codigoElement.textContent = getCodigoForTipo('guardia_fija');
                    } else if (turno.rolCG === 'devuelve') {
                        codigoElement.textContent = `${getCodigoForTipo('guardia_fija')}/${getCodigoForTipo('cambios_guardia')}`;
                    } else {
                        codigoElement.textContent = getCodigoForTipo('cambios_guardia');
                    }
                } else {
                    codigoElement.textContent = codigoTurno;
                }
                // Fallback accesible: título con horario y observaciones
                const tieneHorario = Boolean(turno.horaEntrada && turno.horaSalida);
                const tieneObs = Boolean(turno.observaciones && turno.observaciones.trim());
                const titlePartHorario = tieneHorario ? `Horario: ${turno.horaEntrada} - ${turno.horaSalida}` : '';
                const titlePartObs = tieneObs ? `Observaciones: ${turno.observaciones.trim()}` : '';
                const titleParts = [titlePartHorario];
                if (isAdmin() && titlePartObs) titleParts.push(titlePartObs);
                const tituloTooltip = titleParts.filter(Boolean).join(' | ');
                if (tituloTooltip) {
                    codigoElement.title = tituloTooltip;
                }
                cellContent.appendChild(codigoElement);
                applyCustomStyleIfAny(cellContent, turno.tipo);
                
                // Agregar información adicional para tipos específicos
                if (turno.tipo === 'cambios_guardia') {
                    // Mostrar únicamente el código "CG" en la celda, sin texto adicional
                } else if (turno.tipo === 'compensatorio' && turno.fechaTrabajoRealizado) {
                    const fechaElement = document.createElement('div');
                    fechaElement.classList.add('turno-fecha');
                    fechaElement.textContent = `Realizado: ${formatDateShort(turno.fechaTrabajoRealizado)}`;
                    cellContent.appendChild(fechaElement);
                }
                
                // Tooltip visible al hover con horario y observaciones (si faltan, mostrar valores por defecto)
                const tooltip = document.createElement('div');
                tooltip.classList.add('calendar-tooltip');
                const fragment = document.createDocumentFragment();
                const horarioText = tieneHorario
                    ? `Horario: ${turno.horaEntrada} - ${turno.horaSalida}`
                    : 'Horario: no especificado';
                const obsText = tieneObs
                    ? `Observaciones: ${turno.observaciones.trim()}`
                    : 'Observaciones: sin datos';
                const motivoMap = {
                    familiar_fallecido: 'Familiar fallecido',
                    transporte: 'Falta/Paro de transporte',
                    maternidad: 'Maternidad',
                    matrimonio: 'Matrimonio',
                    donacion_sangre: 'Donación de sangre',
                    otros: 'Otros'
                };
                const motivoText = turno.motivo ? `Motivo: ${motivoMap[turno.motivo] || turno.motivo}` : '';
                const pHorario = document.createElement('div');
                pHorario.textContent = horarioText;
                const pObs = document.createElement('div');
                pObs.textContent = obsText;
                fragment.appendChild(pHorario);
                // Solo admin ve observaciones en el tooltip
                if (isAdmin()) {
                    fragment.appendChild(pObs);
                    if (motivoText) {
                        const pMotivo = document.createElement('div');
                        pMotivo.textContent = motivoText;
                        fragment.appendChild(pMotivo);
                    }
                }
                tooltip.appendChild(fragment);
                cellContent.appendChild(tooltip);
                
                cell.appendChild(cellContent);
            }
            
            // Guía visual: manejada a nivel de fila (mouseenter en <tr>)

            // Agregar event listener para asignar turno (solo admin)
            cell.addEventListener('click', () => {
                if (!isAdmin()) {
                    showNotification('Solo el admin puede asignar o editar turnos');
                    return;
                }
                openTurnoModal(persona.id, dateStr, turno);
            });
            
            row.appendChild(cell);
        }
        
        bodyFragment.appendChild(row);
    });
    
    // Limpiar y agregar todo el contenido de una vez
    calendarBody.innerHTML = '';
    calendarBody.appendChild(bodyFragment);

    // Guía vertical deshabilitada
}

function changeMonth(delta) {
    currentMonth += delta;
    
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    
    renderCalendar();
}

function timeStrToMinutes(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || '0', 10);
    if (!Number.isInteger(h) || h < 0 || h > 23) return null;
    if (!Number.isInteger(m) || m < 0 || m > 59) return null;
    return h * 60 + m;
}

function getNowInTimeZone(timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        weekday: 'short'
    }).formatToParts(new Date());
    const map = {};
    parts.forEach(p => { map[p.type] = p.value; });
    const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
        year: parseInt(map.year, 10),
        month: parseInt(map.month, 10) - 1,
        day: parseInt(map.day, 10),
        hour: parseInt(map.hour, 10),
        minute: parseInt(map.minute, 10),
        dow: wdMap[map.weekday] ?? new Date().getDay()
    };
}

function formatDateFromParts({ year, month, day }) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function autoMarkScheduledShifts() {
    try {
        const tzNow = getNowInTimeZone('America/Argentina/Buenos_Aires');
        const s = getSettings();
        const tz = (s && s.timezone) ? s.timezone : 'America/Argentina/Buenos_Aires';
        const tzNow2 = getNowInTimeZone(tz);
        const year = tzNow2.year;
        const month = tzNow2.month;
        const day = tzNow2.day;
        const dow = tzNow2.dow;
        const minutesNow = tzNow2.hour * 60 + tzNow2.minute;
        const todayStr = formatDateFromParts(tzNow2);
        let changed = false;

        personal.forEach(p => {
            const ws = p && p.workSchedule;
            if (!ws) return;
            const allowHoliday = Boolean(ws.applyHolidays);
            const isHol = isHoliday(year, month, day);
            if (isHol && !allowHoliday) return;
            let startVal = null;
            let endVal = '';
            if (ws.type === 'per_day' && ws.perDay && ws.perDay[String(dow)]) {
                startVal = ws.perDay[String(dow)].start || null;
                endVal = ws.perDay[String(dow)].end || '';
            } else if (Array.isArray(ws.days) && ws.days.includes(dow) && ws.start) {
                startVal = ws.start;
                endVal = ws.end || '';
            }
            const startMin = timeStrToMinutes(startVal);
            if (startMin == null) return;
            if (minutesNow === startMin) {
                if (!turnos[todayStr]) turnos[todayStr] = {};
                if (!turnos[todayStr][p.id]) {
                    turnos[todayStr][p.id] = {
                        tipo: 'guardia_fija',
                        horaEntrada: startVal,
                        horaSalida: endVal,
                        observaciones: ''
                    };
                    changed = true;
                }
            }
        });

        if (changed) {
            saveData();
            renderCalendar();
        }
    } catch {}
}

function startAlignedMinuteChecker() {
    const now = new Date();
    const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    setTimeout(() => {
        autoMarkScheduledShifts();
        setInterval(autoMarkScheduledShifts, 60000);
    }, Math.max(0, delay));
}
startAlignedMinuteChecker();

// Exportar calendario a PDF
async function exportCalendarToPDF() {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede descargar PDF.');
        return;
    }
    document.body.classList.add('export-mode');
    try {
        const tableEl = document.getElementById('calendar-table');
        if (!tableEl) {
            showNotification('No se encontró el calendario para exportar');
            return;
        }
        showNotification('Generando PDF del calendario…');

        // Insertar fila de título temporal con Mes y Sector
        const monthText = (document.getElementById('current-month')?.textContent || '').trim();
        const sectorText = (document.getElementById('sector-input')?.value || '').trim();
        const thead = tableEl.querySelector('thead');
        const daysHeaderRow = document.getElementById('calendar-days');
        const columnCount = daysHeaderRow ? daysHeaderRow.querySelectorAll('th').length : (thead ? thead.querySelectorAll('th').length : 1);
        let exportTitleRow = null;
        if (thead) {
            exportTitleRow = document.createElement('tr');
            exportTitleRow.className = 'export-title-row';
            const th = document.createElement('th');
            th.colSpan = Math.max(1, columnCount);
            th.textContent = sectorText ? `${monthText} — Sector: ${sectorText}` : monthText;
            exportTitleRow.appendChild(th);
            thead.insertBefore(exportTitleRow, daysHeaderRow || thead.firstChild);
        }

        const h2c = window.html2canvas || (typeof html2canvas !== 'undefined' ? html2canvas : null);
        if (!h2c) {
            showNotification('No se pudo cargar html2canvas');
            return;
        }
        const deviceScale = Math.max(2, Math.min((window.devicePixelRatio || 1) * 2, 4));
        const canvas = await h2c(tableEl, {
            scale: deviceScale,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const jspdfNS = window.jspdf;
        if (!jspdfNS || !jspdfNS.jsPDF) {
            showNotification('No se pudo cargar jsPDF');
            return;
        }
        const { jsPDF } = jspdfNS;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;

        const scaledWidth = pageWidth - margin * 2;
        const scaledHeight = (canvas.height * scaledWidth) / canvas.width;
        let heightLeft = scaledHeight;

        if (scaledHeight <= (pageHeight - margin * 2)) {
            const yCentered = (pageHeight - scaledHeight) / 2;
            pdf.addImage(imgData, 'PNG', margin, yCentered, scaledWidth, scaledHeight);
        } else {
            let positionY = margin;
            pdf.addImage(imgData, 'PNG', margin, positionY, scaledWidth, scaledHeight);
            heightLeft -= (pageHeight - margin * 2);
            while (heightLeft > 0) {
                pdf.addPage();
                positionY = margin - (scaledHeight - heightLeft);
                pdf.addImage(imgData, 'PNG', margin, positionY, scaledWidth, scaledHeight);
                heightLeft -= (pageHeight - margin * 2);
            }
        }

        // Construir y agregar sección de Observaciones
        const obsEntries = [];
        // Deduplicación por rangos para tipos multi-día
        const rangeSeen = new Set();
        const monthIdx = currentMonth;
        const yearVal = currentYear;
        try {
            Object.keys(turnos || {}).forEach(fecha => {
                const parts = String(fecha).split('-');
                if (parts.length === 3) {
                    const y = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10) - 1;
                    if (y === yearVal && m === monthIdx) {
                        const perMap = turnos[fecha] || {};
                        Object.keys(perMap).forEach(pid => {
                            const t = perMap[pid] || {};
                            const obsText = (t.observaciones || '').trim();
                            const tipoTurno = t.tipo || '';
                            let include = false;
                            let finalText = obsText;
                            let fechaParaOrden = fecha; // por defecto usar la fecha del día
                            if (tipoTurno === 'cambios_guardia') {
                                // Incluir siempre Cambios de Guardia y mostrar texto informativo de CG
                                include = true;
                                const pComp = personal.find(x => String(x.id) === String(t.companeroCambio));
                                const nombreComp = pComp ? `${pComp.apellido}, ${pComp.nombre}` : String(t.companeroCambio || '');
                                const partes = [];
                                if (nombreComp) partes.push(`CG con ${nombreComp}`);
                                if (t.rolCG === 'cubre') {
                                    if (t.fechaDevolucion) partes.push(`devuelve: ${formatDateShort(t.fechaDevolucion)}`);
                                } else if (t.rolCG === 'devuelve') {
                                    partes.push(`devuelve: ${formatDateShort(fecha)}`);
                                    if (t.fechaCambio) partes.push(`cubre: ${formatDateShort(t.fechaCambio)}`);
                                }
                                const cgText = partes.join('\n');
                                finalText = obsText ? `${obsText}\n${cgText}` : cgText;
                            } else if (tipoTurno === 'guardia_fija') {
                                // Incluir Guardia Fija solo si tiene observaciones
                                include = !!obsText;
                                finalText = obsText;
                            } else if (tipoTurno === 'compensatorio') {
                                // Incluir otros tipos siempre; para compensatorio anexar fecha del trabajo realizado
                                include = true;
                                if (t.fechaTrabajoRealizado) {
                                    const extra = `Trabajo realizado: ${formatDateShort(t.fechaTrabajoRealizado)}`;
                                    finalText = obsText ? `${obsText}\n${extra}` : extra;
                                }
                            } else if (tipoTurno === 'vacaciones' || tipoTurno === 'estres') {
                                // Agrupar por rango: mostrar una sola fila con Inicio y Regreso
                                const start = t.fechaInicio || '';
                                const end = t.fechaFin || '';
                                const key = `RANGE|${pid}|${tipoTurno}|${start}|${end}`;
                                if (!rangeSeen.has(key)) {
                                    rangeSeen.add(key);
                                    include = true;
                                    fechaParaOrden = start || fecha;
                                    const extra = `Inicio: ${formatDateShort(start)} — Regreso: ${formatDateShort(end)}`;
                                    finalText = obsText ? `${obsText}\n${extra}` : extra;
                                }
                            } else if (tipoTurno === 'carpeta_medica') {
                                // Agrupar por rango: mostrar una sola fila con Inicio y Regreso (Alta)
                                const start = t.fechaInicioCarpeta || '';
                                const end = t.fechaAlta || '';
                                const key = `RANGE|${pid}|${tipoTurno}|${start}|${end}`;
                                if (!rangeSeen.has(key)) {
                                    rangeSeen.add(key);
                                    include = true;
                                    fechaParaOrden = start || fecha;
                                    const extra = `Inicio: ${formatDateShort(start)} — Regreso: ${formatDateShort(end)}`;
                                    finalText = obsText ? `${obsText}\n${extra}` : extra;
                                }
                            } else {
                                // Incluir otros tipos siempre, aunque no haya observación
                                include = true;
                            }

                            if (include) {
                                const p = personal.find(x => String(x.id) === String(pid));
                                const nombre = p ? `${p.apellido}, ${p.nombre}` : String(pid);
                                const tipoBonito = prettify(tipoTurno);
                                obsEntries.push({ fecha: fechaParaOrden, nombre, tipo: tipoBonito, texto: finalText });
                            }
                        });
                    }
                }
            });
        } catch (e) { /* ignorar errores de recopilación */ }

        // Crear contenedor temporal para renderizar Observaciones
        const obsContainer = document.createElement('div');
        obsContainer.id = 'export-observaciones';
        obsContainer.style.position = 'absolute';
        obsContainer.style.left = '-9999px';
        obsContainer.style.top = '0';
        obsContainer.style.width = tableEl.offsetWidth ? `${tableEl.offsetWidth}px` : '1000px';
        obsContainer.style.padding = '16px';
        obsContainer.style.backgroundColor = '#ffffff';
        obsContainer.style.color = '#000000';
        obsContainer.style.fontFamily = 'Arial, sans-serif';
        // Fuente más grande y legible para Observaciones en PDF
        obsContainer.style.fontSize = '14px';
        obsContainer.style.lineHeight = '1.4';

        const obsTitle = document.createElement('h2');
        obsTitle.textContent = `Observaciones — ${monthText || 'Mes'}`;
        obsTitle.style.margin = '0 0 10px 0';
        // Título un poco más grande
        obsTitle.style.fontSize = '18px';
        obsContainer.appendChild(obsTitle);

        const obsTable = document.createElement('table');
        obsTable.style.width = '100%';
        obsTable.style.borderCollapse = 'collapse';
        obsTable.style.tableLayout = 'fixed';

        const makeCell = (text) => {
            const td = document.createElement('td');
            td.style.border = '1px solid #ddd';
            td.style.padding = '6px';
            td.style.verticalAlign = 'top';
            td.textContent = text;
            return td;
        };

        const theadRow = document.createElement('tr');
        ['Fecha', 'Personal', 'Tipo', 'Observaciones'].forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            th.style.border = '1px solid #ddd';
            th.style.padding = '6px';
            th.style.textAlign = 'left';
            th.style.backgroundColor = '#f5f5f5';
            obsTable.appendChild(theadRow);
            theadRow.appendChild(th);
        });

        const tbody = document.createElement('tbody');

        if (obsEntries.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 4;
            td.textContent = 'Sin observaciones registradas para este mes.';
            td.style.border = '1px solid #ddd';
            td.style.padding = '10px';
            tr.appendChild(td);
            tbody.appendChild(tr);
        } else {
            obsEntries.sort((a, b) => {
                if (a.fecha === b.fecha) return a.nombre.localeCompare(b.nombre);
                return a.fecha.localeCompare(b.fecha);
            });
            obsEntries.forEach(entry => {
                const tr = document.createElement('tr');
                const fechaCorta = formatDateShort(entry.fecha);
                tr.appendChild(makeCell(fechaCorta));
                tr.appendChild(makeCell(entry.nombre));
                tr.appendChild(makeCell(entry.tipo));
                const obsTd = document.createElement('td');
                obsTd.style.border = '1px solid #ddd';
                obsTd.style.padding = '6px';
                obsTd.style.whiteSpace = 'pre-wrap';
                obsTd.style.wordBreak = 'break-word';
                obsTd.textContent = entry.texto;
                tr.appendChild(obsTd);
                tbody.appendChild(tr);
            });
        }

        obsTable.appendChild(tbody);
        obsContainer.appendChild(obsTable);
        document.body.appendChild(obsContainer);

        // Renderizar Observaciones a canvas y agregar al PDF
        try {
            const obsCanvas = await h2c(obsContainer, {
                scale: deviceScale,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const obsImg = obsCanvas.toDataURL('image/png');
            // Agregar en nueva(s) página(s)
            pdf.addPage();
            const obsScaledWidth = pageWidth - margin * 2;
            const obsScaledHeight = (obsCanvas.height * obsScaledWidth) / obsCanvas.width;
            let obsHeightLeft = obsScaledHeight;
            let obsPosY = margin;
            pdf.addImage(obsImg, 'PNG', margin, obsPosY, obsScaledWidth, obsScaledHeight);
            obsHeightLeft -= (pageHeight - margin * 2);
            while (obsHeightLeft > 0) {
                pdf.addPage();
                obsPosY = margin - (obsScaledHeight - obsHeightLeft);
                pdf.addImage(obsImg, 'PNG', margin, obsPosY, obsScaledWidth, obsScaledHeight);
                obsHeightLeft -= (pageHeight - margin * 2);
            }
        } catch (e) {
            console.warn('No se pudo renderizar Observaciones en PDF:', e);
        } finally {
            // Limpiar contenedor temporal
            try { obsContainer.remove(); } catch { /* ignorar */ }
        }

        const title = document.getElementById('current-month')?.textContent || 'Calendario';
        const safeTitle = title.replace(/\s+/g, '_');
        pdf.save(`Calendario_${safeTitle}.pdf`);
        showNotification('PDF descargado correctamente');
    } catch (err) {
        console.error('Error exportando PDF:', err);
        showNotification('Error al generar el PDF');
    } finally {
        // Eliminar fila de título temporal
        const thead = document.querySelector('#calendar-table thead');
        const titleRow = thead?.querySelector('tr.export-title-row');
        if (titleRow) {
            titleRow.remove();
        }
        document.body.classList.remove('export-mode');
    }
}

// Exportar calendario a Excel (horizontal)
function exportCalendarToExcel() {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede descargar Excel.');
        return;
    }
    const tableEl = document.getElementById('calendar-table');
    if (!tableEl) {
        showNotification('No se encontró el calendario para exportar');
        return;
    }
    try {
        const XLSXNS = window.XLSX;
        if (!XLSXNS) {
            showNotification('No se pudo cargar XLSX');
            return;
        }
        const wb = XLSXNS.utils.table_to_book(tableEl, { sheet: 'Calendario' });
        let ws = wb.Sheets['Calendario'];
        // Construir nueva hoja con una fila de título "Mes — Sector" al inicio
        if (ws && ws['!ref']) {
            const data = XLSXNS.utils.sheet_to_json(ws, { header: 1 });
            const monthText = (document.getElementById('current-month')?.textContent || '').trim();
            const sectorText = (document.getElementById('sector-input')?.value || '').trim();
            const titleText = sectorText ? `${monthText} — Sector: ${sectorText}` : monthText;
            data.unshift([titleText]);
            const newWs = XLSXNS.utils.aoa_to_sheet(data);
            const range = XLSXNS.utils.decode_range(newWs['!ref']);
            const lastCol = range.e.c;
            // Merge del título a lo ancho de todas las columnas
            newWs['!merges'] = (newWs['!merges'] || []).concat([{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }]);
            // Estilo del título (centrado, negrita, grande)
            if (newWs['A1']) {
                newWs['A1'].s = { font: { bold: true, sz: 18 }, alignment: { horizontal: 'center' } };
            }
            // Estilar header de la primera columna (ahora en A2) y nombres en columna A (desde fila 3)
            const headerColRef = XLSXNS.utils.encode_cell({ r: 1, c: 0 }); // A2
            if (newWs[headerColRef]) {
                newWs[headerColRef].s = { font: { bold: true, sz: 16 } };
                if (typeof newWs[headerColRef].v === 'string') newWs[headerColRef].v = newWs[headerColRef].v.toUpperCase();
            }
            for (let R = 2; R <= range.e.r; R++) { // omitir título (0) y encabezado (1)
                const cellRef = XLSXNS.utils.encode_cell({ r: R, c: 0 });
                const cell = newWs[cellRef];
                if (cell) {
                    if (typeof cell.v === 'string') {
                        cell.v = cell.v.toUpperCase();
                    }
                    newWs[cellRef].s = { font: { bold: true, sz: 16 } };
                }
            }
            // Altura de filas: título más alto, resto altas
            const rows = [];
            const totalRows = range.e.r - range.s.r + 1;
            for (let i = 0; i < totalRows; i++) {
                rows.push({ hpt: i === 0 ? 28 : 24 });
            }
            newWs['!rows'] = rows;

            // Encabezados de días (fila 2): negrita y tamaño mayor
            for (let C = 1; C <= range.e.c; C++) {
                const headCellRef = XLSXNS.utils.encode_cell({ r: 1, c: C });
                if (newWs[headCellRef]) {
                    newWs[headCellRef].s = { font: { bold: true, sz: 14 } };
                }
            }

            // Reemplazar hoja original por la nueva con título
            wb.Sheets['Calendario'] = newWs;
            ws = newWs;
        }
        // Establecer nombre del archivo con el mes actual
        const title = document.getElementById('current-month')?.textContent || 'Calendario';
        const safeTitle = title.replace(/\s+/g, '_');
        const fname = `Calendario_${safeTitle}.xlsx`;
        XLSXNS.writeFile(wb, fname);
        showNotification('Excel descargado correctamente');
    } catch (err) {
        console.error('Error exportando Excel:', err);
        showNotification('Error al generar el Excel');
    }
}

// Funciones para el manejo de turnos
function openTurnoModal(personalId, fecha, turno = null) {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede abrir este modal.');
        return;
    }
    closeHamburgerMenu();
    document.getElementById('turno-personal-id').value = personalId;
    document.getElementById('turno-fecha').value = fecha;
    
    const tipoTurnoSelect = document.getElementById('turno-tipo');
    const horaEntrada = document.getElementById('hora-entrada');
    const horaSalida = document.getElementById('hora-salida');
    const observaciones = document.getElementById('turno-observaciones');
    const observacionesBtn = document.getElementById('observaciones-btn');
    const observacionesPreview = document.getElementById('observaciones-preview');
    const observacionesEditMode = document.getElementById('observaciones-edit-mode');
    
    const s = getSettings();
    if (tipoTurnoSelect) {
        const currentValue = tipoTurnoSelect.value;
        const baseTypes = ['guardia_fija','ausente','carpeta_medica','vacaciones','compensatorio','estres','cambios_guardia','articulo26','dia_sindical','dia_estudio'];
        tipoTurnoSelect.innerHTML = '';
        baseTypes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = getTypeLabel(t);
            tipoTurnoSelect.appendChild(opt);
        });
        const customs = s.customTypes || [];
        customs.forEach(ct => {
            const opt = document.createElement('option');
            opt.value = ct.id;
            opt.textContent = ct.name ? `${ct.name} (${ct.code || ''})` : (ct.code ? `${ct.id} (${ct.code})` : ct.id);
            opt.className = 'custom-type-option';
            tipoTurnoSelect.appendChild(opt);
        });
        // Restaurar selección previa si existe, sino quedar como 'guardia_fija'
        if (currentValue) {
            tipoTurnoSelect.value = currentValue;
        }
    }
    const persona = personal.find(p => p.id === personalId);
    const nombreCompleto = persona ? `${persona.nombre} ${persona.apellido}` : 'Personal';
    const fechaFormateada = formatDateShort(fecha);
    
    // Actualizar el título del modal
    const modalTitle = document.getElementById('turno-modal-title');
    modalTitle.textContent = `Turno: ${nombreCompleto} - ${fechaFormateada}`;
    
    // Siempre limpiar horarios antes de cargar datos del turno actual
    if (horaEntrada) horaEntrada.value = '';
    if (horaSalida) horaSalida.value = '';
    // Foco automático del modal de turno: de Entrada a Salida
    if (horaEntrada && horaSalida && !horaEntrada.dataset.focusBound) {
        const goToSalida = () => { try { horaSalida.focus(); } catch {} };
        horaEntrada.addEventListener('change', goToSalida);
        horaEntrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goToSalida(); } });
        horaEntrada.dataset.focusBound = '1';
    }

    if (turno) {
        tipoTurnoSelect.value = turno.tipo;
        if (turno.horaEntrada) horaEntrada.value = turno.horaEntrada;
        if (turno.horaSalida) horaSalida.value = turno.horaSalida;

        // Configurar observaciones en modo lectura
        let observacionesText = turno.observaciones || '';
        // Si es Cambios de Guardia, generar un texto informativo para observaciones
        if (turno.tipo === 'cambios_guardia' && turno.companeroCambio) {
            const p = personal.find(x => x.id === turno.companeroCambio);
            const nombreCompanero = p ? `${p.apellido}, ${p.nombre}` : turno.companeroCambio;
            const partes = [`CG con ${nombreCompanero}`];
            if (turno.rolCG === 'cubre') {
                if (turno.fechaDevolucion) {
                    partes.push(`devuelve: ${formatDateShort(turno.fechaDevolucion)}`);
                }
            } else if (turno.rolCG === 'devuelve') {
                // Para el día de devolución, mostrar esa devolución y la referencia de cobertura si existe
                partes.push(`devuelve: ${formatDateShort(fecha)}`);
                if (turno.fechaCambio) {
                    partes.push(`cubre: ${formatDateShort(turno.fechaCambio)}`);
                }
            }
            const cgText = partes.join('\n');
            // Evitar duplicar si ya existe información de CG en observaciones
            if (!observacionesText || !observacionesText.includes('CG con')) {
                observacionesText = observacionesText ? `${observacionesText}\n${cgText}` : cgText;
            }
        }
        observaciones.value = observacionesText;
        updateObservacionesPreview(observacionesText);
        
        // Cargar datos de campos condicionales
        loadConditionalFieldsData(turno);
        
        deleteTurnoBtn.style.display = 'inline-block';
    } else {
        tipoTurnoSelect.value = 'guardia_fija';
        // Cargar sugerencia de horario según el calendario laboral del personal
        const ws = persona && persona.workSchedule;
        if (ws) {
            const dow = new Date(fecha).getDay();
            if (ws.type === 'per_day' && ws.perDay && ws.perDay[String(dow)]) {
                const info = ws.perDay[String(dow)];
                if (info && info.start && horaEntrada) horaEntrada.value = info.start;
                if (info && info.end && horaSalida) horaSalida.value = info.end || '';
            } else if (Array.isArray(ws.days) && ws.days.includes(dow)) {
                if (ws.start && horaEntrada) horaEntrada.value = ws.start;
                if (ws.end && horaSalida) horaSalida.value = ws.end || '';
            }
        }
        
        // Configurar observaciones vacías
        let obsBase = '';
        // Si se está abriendo el modal para una fecha con datos previos de CG derivados, intentar mostrar sugerencia
        // Nota: Al crear un nuevo turno, aún no hay `turno` concreto; el texto se mostrará cuando se seleccione tipo y compañero.
        observaciones.value = obsBase;
        updateObservacionesPreview(obsBase);
        
        // Limpiar campos condicionales
        clearConditionalFields();
        
        deleteTurnoBtn.style.display = 'none';
    }
    
    // Mostrar campos condicionales apropiados
    handleTipoTurnoChange();
    // Actualizar campos al cambiar el tipo
    const tipoTurnoSelectEl = document.getElementById('turno-tipo');
    if (tipoTurnoSelectEl && !tipoTurnoSelectEl.dataset.boundChange) {
        tipoTurnoSelectEl.addEventListener('change', handleTipoTurnoChange);
        tipoTurnoSelectEl.dataset.boundChange = '1';
    }
    populateCompaneroSelect();
    
    // Asegurar que estamos en modo lectura
    showObservacionesReadMode();
    
    turnoModal.style.display = 'block';
    lockBodyScroll();
    applyTimeInputsFormat();
}

// Función para actualizar el preview de observaciones
function updateObservacionesPreview(text) {
    const observacionesPreview = document.getElementById('observaciones-preview');
    if (text && text.trim()) {
        observacionesPreview.textContent = text;
        observacionesPreview.classList.remove('empty');
    } else {
        observacionesPreview.textContent = 'Sin observaciones';
        observacionesPreview.classList.add('empty');
    }
}

// Función para mostrar modo lectura
function showObservacionesReadMode() {
    const observacionesBtn = document.getElementById('observaciones-btn');
    const observacionesEditMode = document.getElementById('observaciones-edit-mode');
    
    observacionesBtn.style.display = 'flex';
    observacionesEditMode.style.display = 'none';
}

// Función para mostrar modo edición
function showObservacionesEditMode() {
    const observacionesBtn = document.getElementById('observaciones-btn');
    const observacionesEditMode = document.getElementById('observaciones-edit-mode');
    const observaciones = document.getElementById('turno-observaciones');
    
    observacionesBtn.style.display = 'none';
    observacionesEditMode.style.display = 'block';
    
    // Enfocar el textarea
    setTimeout(() => {
        observaciones.focus();
    }, 100);
}

// Función para guardar observaciones
function saveObservaciones() {
    const observaciones = document.getElementById('turno-observaciones');
    const newText = observaciones.value;
    
    updateObservacionesPreview(newText);
    showObservacionesReadMode();
}

// Función para cancelar edición de observaciones
function cancelObservacionesEdit() {
    const observaciones = document.getElementById('turno-observaciones');
    const observacionesPreview = document.getElementById('observaciones-preview');
    
    // Restaurar el texto original desde el preview
    if (observacionesPreview.classList.contains('empty')) {
        observaciones.value = '';
    } else {
        observaciones.value = observacionesPreview.textContent;
    }
    
    showObservacionesReadMode();
}

function handleTurnoSubmit(e) {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede asignar turnos.');
        return;
    }
    e.preventDefault();
    
    // Prevenir múltiples envíos rápidos
    if (isSubmitting) {
        return;
    }
    
    isSubmitting = true;
    
    const personalId = document.getElementById('turno-personal-id').value;
    const fecha = document.getElementById('turno-fecha').value;
    const tipo = document.getElementById('turno-tipo').value;
    const horaEntrada = document.getElementById('hora-entrada').value;
    const horaSalida = document.getElementById('hora-salida').value;
    const observaciones = document.getElementById('turno-observaciones').value;
    const prevTurno = (turnos[fecha] && turnos[fecha][personalId]) ? turnos[fecha][personalId] : null;
    
    // Validar Artículo 26 si es necesario
    if (tipo === 'articulo26') {
        const validation = validateArticulo26(fecha, personalId);
        if (!validation.valid) {
            showNotification(validation.message);
            isSubmitting = false;
            return;
        }
    }
    
    // Recopilar datos de campos condicionales
    const conditionalData = {};
    
    switch(tipo) {
        case 'vacaciones':
        case 'estres':
            conditionalData.fechaInicio = document.getElementById('fecha-inicio').value;
            conditionalData.fechaFin = document.getElementById('fecha-fin').value;
            break;
        case 'carpeta_medica':
            conditionalData.fechaInicioCarpeta = document.getElementById('fecha-inicio-carpeta').value;
            conditionalData.fechaAlta = document.getElementById('fecha-alta').value;
            break;
        case 'compensatorio':
            conditionalData.fechaTrabajoRealizado = document.getElementById('fecha-trabajo-realizado').value;
            break;
        case 'cambios_guardia':
            conditionalData.companeroCambio = document.getElementById('companero-cambio').value;
            conditionalData.fechaDevolucion = document.getElementById('fecha-devolucion') ? document.getElementById('fecha-devolucion').value : '';
            if (!conditionalData.companeroCambio) {
                showNotification('Seleccione el compañero para el cambio.');
                isSubmitting = false;
                return;
            }
            if (!conditionalData.fechaDevolucion) {
                showNotification('Indique la fecha de devolución del cambio.');
                isSubmitting = false;
                return;
            }
            break;
        default: {
            const cfg = getCustomTypeConfig(tipo);
            if (cfg && cfg.requireDateRange) {
                conditionalData.fechaInicio = document.getElementById('fecha-inicio').value;
                conditionalData.fechaFin = document.getElementById('fecha-fin').value;
            }
            break;
        }
    }

    // Validación de límites por persona antes de crear el turno
    // Helpers locales para conteo de días por año
    function countAssignedDaysByYear(personalIdCheck, tipoCheck) {
        const counts = {};
        Object.keys(turnos).forEach(f => {
            const y = new Date(f).getFullYear();
            const t = turnos[f][personalIdCheck];
            if (t && t.tipo === tipoCheck) {
                counts[y] = (counts[y] || 0) + 1;
            }
        });
        return counts;
    }

    function computeRangeDaysByYear(startStr, endStr) {
        const map = {};
        if (!startStr || !endStr) return map;
        const sParts = startStr.split('-');
        const eParts = endStr.split('-');
        const sDate = new Date(parseInt(sParts[0]), parseInt(sParts[1]) - 1, parseInt(sParts[2]));
        const eDate = new Date(parseInt(eParts[0]), parseInt(eParts[1]) - 1, parseInt(eParts[2]));
        if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) return map;
        const cur = new Date(sDate);
        while (cur <= eDate) {
            const y = cur.getFullYear();
            map[y] = (map[y] || 0) + 1;
            cur.setDate(cur.getDate() + 1);
        }
        return map;
    }

    function computeSingleDayByYear(dateStr) {
        const y = new Date(dateStr).getFullYear();
        return { [y]: 1 };
    }

    const personaInfo = personal.find(p => p.id === personalId);
    if (personaInfo) {
        if (tipo === 'vacaciones') {
            // Solo validar si hay límite definido
            if (typeof personaInfo.diasVacaciones === 'number' && personaInfo.diasVacaciones >= 0) {
                const existingDaysByYear = countAssignedDaysByYear(personalId, 'vacaciones');
                const isRange = !!(conditionalData.fechaInicio && conditionalData.fechaFin);
                const newDaysByYear = isRange
                    ? computeRangeDaysByYear(conditionalData.fechaInicio, conditionalData.fechaFin)
                    : computeSingleDayByYear(fecha);
                // Si estamos editando un turno de vacaciones, restar su rango actual
                const existingTurno = turnos[fecha] && turnos[fecha][personalId] ? turnos[fecha][personalId] : null;
                const oldDaysByYear = (existingTurno && existingTurno.tipo === 'vacaciones')
                    ? (existingTurno.fechaInicio && existingTurno.fechaFin
                        ? computeRangeDaysByYear(existingTurno.fechaInicio, existingTurno.fechaFin)
                        : computeSingleDayByYear(fecha))
                    : {};
                // Validar por año
                for (const yStr of Object.keys(newDaysByYear)) {
                    const y = parseInt(yStr, 10);
                    const used = Math.max(0, (existingDaysByYear[y] || 0) - (oldDaysByYear[y] || 0));
                    const proposed = used + newDaysByYear[y];
                    if (proposed > personaInfo.diasVacaciones) {
                        showNotification(`No puede asignar más de ${personaInfo.diasVacaciones} días de vacaciones en ${y} para este personal.`);
                        isSubmitting = false;
                        return;
                    }
                }
            }
        } else if (tipo === 'estres') {
            if (typeof personaInfo.diasEstres === 'number' && personaInfo.diasEstres >= 0) {
                const existingDaysByYear = countAssignedDaysByYear(personalId, 'estres');
                const isRange = !!(conditionalData.fechaInicio && conditionalData.fechaFin);
                const newDaysByYear = isRange
                    ? computeRangeDaysByYear(conditionalData.fechaInicio, conditionalData.fechaFin)
                    : computeSingleDayByYear(fecha);
                const existingTurno = turnos[fecha] && turnos[fecha][personalId] ? turnos[fecha][personalId] : null;
                const oldDaysByYear = (existingTurno && existingTurno.tipo === 'estres')
                    ? (existingTurno.fechaInicio && existingTurno.fechaFin
                        ? computeRangeDaysByYear(existingTurno.fechaInicio, existingTurno.fechaFin)
                        : computeSingleDayByYear(fecha))
                    : {};
                for (const yStr of Object.keys(newDaysByYear)) {
                    const y = parseInt(yStr, 10);
                    const usedDays = Math.max(0, (existingDaysByYear[y] || 0) - (oldDaysByYear[y] || 0));
                    const proposedDays = usedDays + newDaysByYear[y];
                    if (proposedDays > personaInfo.diasEstres) {
                        showNotification(`No puede asignar más de ${personaInfo.diasEstres} días de estrés en ${y} para este personal.`);
                        isSubmitting = false;
                        return;
                    }
                }
            }
        }
    }
    
    // Inicializar la fecha en el objeto turnos si no existe
    if (!turnos[fecha]) {
        turnos[fecha] = {};
    }

    // Crear el objeto turno base
    const turnoData = {
        tipo,
        horaEntrada,
        horaSalida,
        observaciones,
        ...conditionalData
    };

    // Para eventos de múltiples días, crear entradas para cada día del rango
    if ((tipo === 'vacaciones' || tipo === 'estres') && conditionalData.fechaInicio && conditionalData.fechaFin) {
        createMultiDayEvent(personalId, conditionalData.fechaInicio, conditionalData.fechaFin, turnoData);
    } else if (tipo === 'carpeta_medica' && conditionalData.fechaInicioCarpeta && conditionalData.fechaAlta) {
        // Para carpeta médica, mostrar desde la fecha de inicio hasta la fecha de alta
        createMultiDayEvent(personalId, conditionalData.fechaInicioCarpeta, conditionalData.fechaAlta, turnoData);
    } else if (getCustomTypeConfig(tipo) && getCustomTypeConfig(tipo).requireDateRange && conditionalData.fechaInicio && conditionalData.fechaFin) {
        createMultiDayEvent(personalId, conditionalData.fechaInicio, conditionalData.fechaFin, turnoData);
    } else {
        // Para eventos de un solo día
        if (tipo === 'cambios_guardia' && turnoData.companeroCambio) {
            const companeroId = turnoData.companeroCambio;
            const fechaDevolucion = turnoData.fechaDevolucion;
            // Evento de cobertura en la fecha seleccionada, asignado al compañero
            if (!turnos[fecha]) turnos[fecha] = {};
            turnos[fecha][companeroId] = {
                tipo: 'cambios_guardia',
                horaEntrada,
                horaSalida,
                observaciones,
                companeroCambio: personalId,
                fechaDevolucion,
                fechaCambio: fecha,
                rolCG: 'cubre'
            };
            // Evento del solicitante en la fecha original: solo CG
            turnos[fecha][personalId] = {
                tipo: 'cambios_guardia',
                horaEntrada,
                horaSalida,
                observaciones,
                companeroCambio: companeroId,
                fechaDevolucion,
                fechaCambio: fecha,
                rolCG: 'solicita'
            };
            // Evento de devolución en la fecha indicada, asignado a la persona original
            if (fechaDevolucion) {
                if (!turnos[fechaDevolucion]) turnos[fechaDevolucion] = {};
                turnos[fechaDevolucion][personalId] = {
                    tipo: 'cambios_guardia',
                    horaEntrada,
                    horaSalida,
                    observaciones,
                    companeroCambio: companeroId,
                    fechaDevolucion,
                    fechaCambio: fecha,
                    rolCG: 'devuelve'
                };
            }
        } else {
            // Otros tipos: evento de un solo día asignado a la persona
            turnos[fecha][personalId] = turnoData;
        }
    }
    
    // Cerrar modal inmediatamente para mejor UX
    closeModal(turnoModal);
    
    // Mostrar notificación no bloqueante
    showNotification('Turno guardado correctamente');
    
    // Procesar operaciones pesadas de forma asíncrona
    requestAnimationFrame(() => {
        saveData();
        renderCalendar();
        
        // Resetear flag después de completar las operaciones
        setTimeout(() => {
            isSubmitting = false;
        }, 100);
    });

    // Log de movimiento
    const persona = personal.find(p => p.id === personalId);
    addMovementLog({
        action: prevTurno ? 'turno_edit' : 'turno_add',
        entity: 'turno',
        user: currentUser ? { username: currentUser.username, role: currentUser.role } : null,
        timestamp: new Date().toISOString(),
        details: {
            personalId,
            nombre: persona ? `${persona.nombre} ${persona.apellido}` : undefined,
            fecha,
            tipo,
            horaEntrada,
            horaSalida,
            observaciones,
            before: prevTurno || undefined
        }
    });
}

function handleDeleteTurno() {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede eliminar turnos.');
        return;
    }
    const personalId = document.getElementById('turno-personal-id').value;
    const fecha = document.getElementById('turno-fecha').value;
    
    if (turnos[fecha] && turnos[fecha][personalId]) {
        const turno = turnos[fecha][personalId];
        
        // Si es un evento de múltiples días, eliminar de todo el rango
        if ((turno.tipo === 'vacaciones' || turno.tipo === 'estres') && turno.fechaInicio && turno.fechaFin) {
            removeMultiDayEvent(personalId, turno.fechaInicio, turno.fechaFin);
        } else if (turno.tipo === 'carpeta_medica' && turno.fechaInicioCarpeta && turno.fechaAlta) {
            removeMultiDayEvent(personalId, turno.fechaInicioCarpeta, turno.fechaAlta);
        } else {
            // Eliminar evento de un solo día
            const esCambioGuardia = turno.tipo === 'cambios_guardia';
            const companeroId = esCambioGuardia ? turno.companeroCambio : null;
            const rolCG = esCambioGuardia ? turno.rolCG : null;
            const fechaDevolucion = esCambioGuardia ? turno.fechaDevolucion : null;
            const fechaCambio = esCambioGuardia ? turno.fechaCambio : null;
            delete turnos[fecha][personalId];
            // Si era cambio de guardia, eliminar el par correspondiente en la otra fecha/persona
            if (esCambioGuardia && companeroId) {
                if (rolCG === 'cubre' && fechaDevolucion) {
                    // Buscar y eliminar el evento de devolución
                    if (turnos[fechaDevolucion] && turnos[fechaDevolucion][companeroId] && turnos[fechaDevolucion][companeroId].tipo === 'cambios_guardia') {
                        const t2 = turnos[fechaDevolucion][companeroId];
                        if (t2.rolCG === 'devuelve' && t2.fechaCambio === fecha) {
                            delete turnos[fechaDevolucion][companeroId];
                            if (Object.keys(turnos[fechaDevolucion]).length === 0) delete turnos[fechaDevolucion];
                        }
                    }
                } else if (rolCG === 'devuelve' && fechaCambio) {
                    // Buscar y eliminar el evento de cobertura
                    if (turnos[fechaCambio] && turnos[fechaCambio][companeroId] && turnos[fechaCambio][companeroId].tipo === 'cambios_guardia') {
                        const t2 = turnos[fechaCambio][companeroId];
                        if (t2.rolCG === 'cubre' && t2.fechaDevolucion === fecha) {
                            delete turnos[fechaCambio][companeroId];
                            if (Object.keys(turnos[fechaCambio]).length === 0) delete turnos[fechaCambio];
                        }
                    }
                }
            }
            // Si no hay más turnos para esta fecha, eliminar la entrada
            if (turnos[fecha] && Object.keys(turnos[fecha]).length === 0) {
                delete turnos[fecha];
            }
        }
        
        renderCalendar();
        
        // Guardar datos en localStorage
        saveData();

        // Log de movimiento
        const persona = personal.find(p => p.id === personalId);
        addMovementLog({
            action: 'turno_delete',
            entity: 'turno',
            user: currentUser ? { username: currentUser.username, role: currentUser.role } : null,
            timestamp: new Date().toISOString(),
            details: {
                personalId,
                nombre: persona ? `${persona.nombre} ${persona.apellido}` : undefined,
                fecha,
                before: turno
            }
        });
        
        closeModal(turnoModal);
    }
}

// Funciones de utilidad
function showNotification(message) {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// Bloqueo/Desbloqueo de scroll del cuerpo cuando hay modales abiertos
function lockBodyScroll() {
    document.body.classList.add('modal-open');
}

function unlockBodyScroll() {
    const anyOpen = Array.from(document.querySelectorAll('.modal')).some(m => {
        const disp = window.getComputedStyle(m).display;
        return disp && disp !== 'none';
    });
    if (!anyOpen) {
        document.body.classList.remove('modal-open');
    }
}

function closeModal(modal) {
    modal.style.display = 'none';
    unlockBodyScroll();
}

// Limpia el estado de la sección de estadísticas al cerrar
function cleanupStatsModal() {
    const nameSelect = document.getElementById('stats-name-select');
    const list = document.getElementById('stats-list');
    const datesContainer = document.getElementById('stats-dates-record');
    const currentTab = document.getElementById('current-stats-content');
    if (nameSelect) {
        nameSelect.value = '';
    }
    if (list) {
        list.innerHTML = '';
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="11" class="text-center">Seleccione un personal para ver sus estadísticas</td>';
        list.appendChild(row);
    }
    if (datesContainer) {
        datesContainer.innerHTML = '';
        const info = document.createElement('div');
        info.textContent = 'Seleccione un personal para ver el detalle de fechas por tipo.';
        info.style.color = '#666';
        info.style.fontSize = '13px';
        datesContainer.appendChild(info);
    }
    // Asegurar que la pestaña activa vuelva a "Estadísticas Actuales"
    const currentTabBtn = document.getElementById('current-stats-tab');
    const annualTabBtn = document.getElementById('annual-logs-tab');
    const movementTabBtn = document.getElementById('movement-logs-tab');
    const annualContent = document.getElementById('annual-logs-content');
    const movementContent = document.getElementById('movement-logs-content');
    if (currentTabBtn && annualTabBtn && movementTabBtn && currentTab && annualContent && movementContent) {
        currentTabBtn.classList.add('active');
        annualTabBtn.classList.remove('active');
        movementTabBtn.classList.remove('active');
        currentTab.classList.add('active');
        annualContent.classList.remove('active');
        movementContent.classList.remove('active');
    }
}

// --- Gestión de sesión y roles ---
function isAdmin() {
    return currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
}
function isSuperAdmin() {
    return currentUser && currentUser.role === 'superadmin';
}

function updateSessionUI() {
    const roleText = currentUser ? (currentUser.role === 'superadmin' ? 'superadministrador' : (currentUser.role === 'admin' ? 'administrador' : (currentUser.role === 'usuario' ? 'usuario' : 'invitado'))) : 'invitado';
    if (document.getElementById('user-role-label')) {
        document.getElementById('user-role-label').textContent = `${roleText}`;
    }
    if (document.getElementById('login-btn')) {
        document.getElementById('login-btn').style.display = currentUser ? 'none' : 'inline-block';
    }
    if (document.getElementById('logout-btn')) {
        document.getElementById('logout-btn').style.display = currentUser ? 'inline-block' : 'none';
    }

    const isAdminRole = isAdmin();
    const isSuperAdminRole = isSuperAdmin();
    // Botones principales: solo visibles para admin
    const manageBtn = document.getElementById('manage-personal-btn');
    if (manageBtn) {
        manageBtn.style.display = isAdminRole ? '' : 'none';
    }
    const statsBtn = document.getElementById('view-stats-btn');
    if (statsBtn) {
        statsBtn.style.display = isAdminRole ? '' : 'none';
    }
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
        exportBtn.style.display = isAdminRole ? '' : 'none';
    }
    const importBtn = document.getElementById('import-data-btn');
    if (importBtn) {
        importBtn.style.display = isAdminRole ? '' : 'none';
    }
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.style.display = isSuperAdminRole ? '' : 'none';
    // Asegurar visibilidad dentro del menú hamburguesa también
    const hbManageBtn = document.getElementById('manage-personal-btn');
    if (hbManageBtn) hbManageBtn.style.display = isAdminRole ? '' : 'none';
    const hbStatsBtn = document.getElementById('view-stats-btn');
    if (hbStatsBtn) hbStatsBtn.style.display = isAdminRole ? '' : 'none';
    const hbExportBtn = document.getElementById('export-data-btn');
    if (hbExportBtn) hbExportBtn.style.display = isAdminRole ? '' : 'none';
    const hbImportBtn = document.getElementById('import-data-btn');
    if (hbImportBtn) hbImportBtn.style.display = isAdminRole ? '' : 'none';
    // Controles de exportación del calendario: restringir a admin
    const sectorLabelEl = document.querySelector('.sector-label');
    if (sectorLabelEl) {
        sectorLabelEl.style.display = isAdminRole ? '' : 'none';
    }
    const sectorInputEl = document.getElementById('sector-input');
    if (sectorInputEl) {
        sectorInputEl.style.display = isAdminRole ? '' : 'none';
        sectorInputEl.disabled = !isAdminRole;
    }
    if (typeof downloadPdfBtn !== 'undefined' && downloadPdfBtn) {
        downloadPdfBtn.style.display = isAdminRole ? '' : 'none';
        downloadPdfBtn.disabled = !isAdminRole;
    }
    // Botón de Excel eliminado
    // Cerrar secciones si pierde permisos
    if (!isAdminRole) {
        if (document.getElementById('stats-section')) document.getElementById('stats-section').style.display = 'none';
        if (document.getElementById('personal-section')) document.getElementById('personal-section').style.display = 'none';
    }
}

// --- Seguridad: hashing y rate limiting de login ---
async function sha256Hex(str) {
    const enc = new TextEncoder();
    const data = enc.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Exportación/Importación y Backups ---
// Backup automático (throttled)
function scheduleAutoBackup() {
    try {
        if (typeof(Storage) === "undefined") return; // requiere localStorage
        const MIN_INTERVAL_MS = 60 * 1000; // 1 minuto entre respaldos automáticos
        const now = Date.now();
        const lastStr = localStorage.getItem('vigilancia-backup-last-ts');
        const last = lastStr ? parseInt(lastStr, 10) : 0;
        if (!last || (now - last) > MIN_INTERVAL_MS) {
            localStorage.setItem('vigilancia-backup-last-ts', String(now));
            // Construir y guardar en segundo plano
            buildSignedExport()
                .then(saveVersionedBackup)
                .catch(err => console.error('Auto-backup error:', err));
        }
    } catch (e) {
        console.error('Error programando auto-backup:', e);
    }
}

function getAppSnapshot() {
    // Construye un objeto completo con todos los datos persistidos
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        sessionRole: (currentUser && currentUser.role) || null,
        data: {
            personal,
            turnos,
            annualLogs: getAnnualLogs(),
            movementLogs: getMovementLogs()
        },
        meta: {
            counts: {
                personal: personal.length,
                turnosFechas: Object.keys(turnos).length,
                annualLogs: (getAnnualLogs() || []).length,
                movementLogs: (getMovementLogs() || []).length
            }
        }
    };
}

function validateSnapshotStructure(snap) {
    try {
        if (!snap || typeof snap !== 'object') return false;
        if (!snap.data || typeof snap.data !== 'object') return false;
        const d = snap.data;
        // personal debe ser array de objetos con id/nombre
        if (!Array.isArray(d.personal)) return false;
        // turnos debe ser objeto con fechas -> objeto
        if (typeof d.turnos !== 'object' || d.turnos === null || Array.isArray(d.turnos)) return false;
        // annualLogs debe ser array
        if (!Array.isArray(d.annualLogs)) return false;
        // movementLogs debe ser array
        if (!Array.isArray(d.movementLogs)) return false;
        return true;
    } catch { return false; }
}

async function buildSignedExport() {
    const snapshot = getAppSnapshot();
    const payload = JSON.stringify({ type: 'vigilancia-export', snapshot });
    const checksum = await sha256Hex(payload);
    return {
        type: 'vigilancia-export',
        createdAt: new Date().toISOString(),
        checksum,
        snapshot
    };
}

function saveVersionedBackup(signedExport) {
    try {
        const raw = localStorage.getItem('vigilancia-backups');
        const arr = raw ? JSON.parse(raw) : [];
        arr.unshift(signedExport);
        const trimmed = arr.slice(0, 5); // mantener últimas 5 copias
        localStorage.setItem('vigilancia-backups', JSON.stringify(trimmed));
    } catch (e) {
        console.error('Error guardando backup:', e);
    }
}

function getBackups() {
    try {
        const raw = localStorage.getItem('vigilancia-backups');
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

async function exportAllData() {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede exportar datos.');
        return;
    }
    const signedExport = await buildSignedExport();
    saveVersionedBackup(signedExport);
    const fileName = `vigilancia-export-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    const blob = new Blob([JSON.stringify(signedExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    showNotification('Exportación completada y backup guardado.');
}

async function importAllDataFromFile(file) {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede importar datos.');
        return;
    }
    try {
        const text = await file.text();
        const obj = JSON.parse(text);
        if (!obj || obj.type !== 'vigilancia-export' || !obj.snapshot || !obj.checksum) {
            showNotification('Archivo inválido: formato no reconocido.');
            return;
        }
        const payload = JSON.stringify({ type: 'vigilancia-export', snapshot: obj.snapshot });
        const calc = await sha256Hex(payload);
        if (calc !== obj.checksum) {
            showNotification('Checksum inválido: archivo alterado o corrupto.');
            return;
        }
        if (!validateSnapshotStructure(obj.snapshot)) {
            showNotification('Estructura de datos inválida.');
            return;
        }
        // Confirmación antes de sobreescribir
        showConfirmModal({
            title: 'Confirmar importación',
            message: 'Esto reemplazará los datos actuales. ¿Desea continuar?',
            onAccept: () => {
                const d = obj.snapshot.data;
                personal = d.personal || [];
                turnos = d.turnos || {};
                // Persistir
                saveData();
                // Logs anuales
                try { localStorage.setItem('vigilancia-annual-logs', JSON.stringify(d.annualLogs || [])); } catch {}
                // Logs de movimientos
                try { localStorage.setItem('vigilancia-movement-logs', JSON.stringify(d.movementLogs || [])); } catch {}
                // Backup del import
                saveVersionedBackup(obj);
                renderPersonalList();
                populateCompaneroSelect();
                renderCalendar();
                loadAnnualLogs();
                loadMovementLogs();
                showNotification('Importación realizada correctamente.');
            },
            onCancel: () => {}
        });
    } catch (e) {
        console.error('Error importando datos:', e);
        showNotification('Error leyendo el archivo de importación.');
    }
}

function getLoginRateLimitState() {
    try {
        const raw = localStorage.getItem('vigilancia-login-rl');
        if (!raw) return { fails: [], blockedUntil: 0 };
        const obj = JSON.parse(raw);
        const now = Date.now();
        const recentFails = (obj.fails || []).filter(ts => now - ts <= 10 * 60 * 1000);
        return { fails: recentFails, blockedUntil: obj.blockedUntil || 0 };
    } catch { return { fails: [], blockedUntil: 0 }; }
}

function saveLoginRateLimitState(state) {
    try { localStorage.setItem('vigilancia-login-rl', JSON.stringify(state)); } catch {}
}

function registerFailedLoginAttempt() {
    const state = getLoginRateLimitState();
    const now = Date.now();
    state.fails.push(now);
    // Si 5 intentos en 1 minuto, bloquear 2 minutos
    const oneMinAgo = now - 60 * 1000;
    const recent = state.fails.filter(ts => ts >= oneMinAgo);
    if (recent.length >= 5) {
        state.blockedUntil = now + 2 * 60 * 1000;
        addMovementLog({
            action: 'login_rate_block',
            entity: 'login',
            user: { username: (currentUser && currentUser.username) || 'N/D', role: (currentUser && currentUser.role) || 'guest' },
            timestamp: new Date().toISOString(),
            details: { count: recent.length }
        });
    }
    saveLoginRateLimitState(state);
}

function clearLoginRateLimitState() {
    saveLoginRateLimitState({ fails: [], blockedUntil: 0 });
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const uEl = document.getElementById('username');
    const pEl = document.getElementById('password');
    if (!uEl || !pEl) return;
    const u = uEl.value.trim().toLowerCase();
    const p = pEl.value.trim();
    // Rate limit: bloquear si hay demasiados intentos fallidos recientes
    const rl = getLoginRateLimitState();
    const now = Date.now();
    if (rl.blockedUntil && now < rl.blockedUntil) {
        const msLeft = rl.blockedUntil - now;
        const secs = Math.ceil(msLeft / 1000);
        showNotification(`Demasiados intentos. Intente nuevamente en ${secs}s.`);
        addMovementLog({
            action: 'login_blocked',
            entity: 'login',
            user: { username: u || 'N/D', role: 'guest' },
            timestamp: new Date().toISOString(),
            details: { username: u }
        });
        return;
    }
    let role = null;
    const s = getSettings();
    const adminHash = (s && s.adminPassHash) ? s.adminPassHash : '1ce6f5b7a91ff10a25ccaa08b73cbb8c2353848e4208a4cc24483935dcf5aac1';
    const superHash = (s && s.superAdminPassHash) ? s.superAdminPassHash : (await sha256Hex('superadmin'));
    if (u === 'superadmin' && p && (await sha256Hex(p)) === superHash) {
        role = 'superadmin';
    } else if (u === 'admin' && p && (await sha256Hex(p)) === adminHash) {
        role = 'admin';
    } else if ((u === 'usuario' || u === 'lectura') && p === u) {
        role = 'usuario';
    } else {
        // Registrar intento fallido de login
        addMovementLog({
            action: 'login_failed',
            entity: 'login',
            user: { username: u || 'N/D', role: 'guest' },
            timestamp: new Date().toISOString(),
            details: {
                username: u,
                attempted: Boolean(p),
                password: p
            }
        });
        // Actualizar estado de rate limit
        registerFailedLoginAttempt();
        showNotification('Credenciales inválidas. Verifique usuario y contraseña.');
        return;
    }
    showConfirmModal({
        title: 'Confirmar inicio de sesión',
        message: '¿Está seguro que desea iniciar sesión?',
        onAccept: () => {
            currentUser = { username: u, role };
            saveSession();
            clearLoginRateLimitState();
            // Recargar para reflejar estado de sesión en toda la UI
            location.reload();
        }
    });
}

function handleLogout() {
    showConfirmModal({
        title: 'Confirmar cierre de sesión',
        message: '¿Está seguro que desea cerrar sesión?',
        onAccept: () => {
            currentUser = null;
            saveSession();
            // Recargar para limpiar estado de sesión
            location.reload();
        }
    });
}

// Logout forzado sin confirmación (para inactividad u otros motivos)
function forceLogout(reason = '') {
    currentUser = null;
    saveSession();
    try { if (reason) sessionStorage.setItem('logout-reason', reason); } catch (e) { /* ignorar */ }
    location.reload();
}

// Inicializar auto-logout por inactividad para admin
function initAdminIdleLogout() {
    if (!isAdmin()) return;
    const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutos
    const resetTimer = () => {
        if (adminIdleTimer) clearTimeout(adminIdleTimer);
        adminIdleTimer = setTimeout(() => {
            // Si sigue siendo admin y no hubo movimiento, forzar logout
            if (isAdmin()) forceLogout('idle');
        }, INACTIVITY_MS);
    };
    // Reiniciar con actividad del usuario: mouse, teclado, scroll
    if (!adminActivityHandler) {
        adminActivityHandler = () => { resetTimer(); };
        document.addEventListener('mousemove', adminActivityHandler);
        document.addEventListener('keydown', adminActivityHandler);
        document.addEventListener('scroll', adminActivityHandler, { passive: true });
    }
    // Iniciar por primera vez
    resetTimer();
}

function saveSession() {
    try {
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
            // Admin: persistencia solo por sesión de pestaña
            sessionStorage.setItem('vigilancia-session', JSON.stringify(currentUser));
            // Limpiar persistencia duradera para evitar quedar logueado tras cerrar pestaña
            try { localStorage.removeItem('vigilancia-session'); } catch (e) { /* ignorar */ }
            setCookie('vigilancia-session', '', -1);
        } else {
            // Otros roles: persistencia en localStorage (y cookie como fallback)
            localStorage.setItem('vigilancia-session', JSON.stringify(currentUser));
            try { sessionStorage.removeItem('vigilancia-session'); } catch (e) { /* ignorar */ }
            setCookie('vigilancia-session', JSON.stringify(currentUser || {}), 7);
        }
    } catch (e) {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
            setCookie('vigilancia-session', JSON.stringify(currentUser || {}), 7);
        }
    }
}

function loadSession() {
    // Preferir sessionStorage (admin/superadmin)
    try {
        const rawSession = sessionStorage.getItem('vigilancia-session');
        if (rawSession) {
            currentUser = JSON.parse(rawSession);
            return;
        }
    } catch (e) { /* ignorar */ }

    // Luego localStorage (no-admin). Si detectamos admin/superadmin persistido, limpiarlo.
    try {
        const rawLocal = localStorage.getItem('vigilancia-session');
        if (rawLocal) {
            const obj = JSON.parse(rawLocal);
            if (obj && (obj.role === 'admin' || obj.role === 'superadmin')) {
                try { localStorage.removeItem('vigilancia-session'); } catch (e) { /* ignorar */ }
            } else {
                currentUser = obj;
                return;
            }
        }
    } catch (e) { /* ignorar */ }

    // Fallback cookie (no-admin). Si detectamos admin/superadmin, ignorar y borrar cookie.
    try {
        const rawCookie = getCookie('vigilancia-session');
        if (rawCookie) {
            const obj = JSON.parse(rawCookie);
            if (obj && (obj.role === 'admin' || obj.role === 'superadmin')) {
                setCookie('vigilancia-session', '', -1);
                currentUser = null;
            } else {
                currentUser = obj;
            }
        } else {
            currentUser = null;
        }
    } catch (e) {
        currentUser = null;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function applyTimeInputsFormat() {
    const s = getSettings();
    const force = !!(s && s.force24h);
    const ids = [
        'hora-entrada','hora-salida','schedule-start','schedule-end','settings-now-time',
        'per-start-0','per-end-0','per-start-1','per-end-1','per-start-2','per-end-2',
        'per-start-3','per-end-3','per-start-4','per-end-4','per-start-5','per-end-5',
        'per-start-6','per-end-6'
    ];
    const pattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    const normalize = (v) => {
        const t = (v || '').trim().toLowerCase();
        if (!t) return '';
        let ampm = null;
        let base = t.replace(/\s+/g,'');
        if (base.endsWith('am')) { ampm = 'am'; base = base.slice(0,-2); }
        else if (base.endsWith('pm')) { ampm = 'pm'; base = base.slice(0,-2); }
        const m = base.match(/^(\d{1,2})(?::?(\d{2}))?$/);
        if (!m) return '';
        let hh = parseInt(m[1],10);
        let mm = m[2] != null ? parseInt(m[2],10) : 0;
        if (Number.isNaN(hh) || Number.isNaN(mm)) return '';
        if (ampm === 'pm' && hh < 12) hh += 12;
        if (ampm === 'am' && hh === 12) hh = 0;
        hh = Math.max(0, Math.min(23, hh));
        mm = Math.max(0, Math.min(59, mm));
        const h2 = String(hh).padStart(2,'0');
        const m2 = String(mm).padStart(2,'0');
        return `${h2}:${m2}`;
    };
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (force) {
            try { el.type = 'text'; } catch {}
            el.placeholder = 'HH:MM';
            el.pattern = '^(?:[01]\\d|2[0-3]):[0-5]\\d$';
            el.setAttribute('inputmode','numeric');
            el.maxLength = 5;
            if (!el.dataset.bound24) {
                el.addEventListener('blur', () => {
                    const v = normalize(el.value);
                    if (v && pattern.test(v)) el.value = v;
                });
                el.addEventListener('input', () => {
                    const v = el.value.replace(/[^0-9:]/g,'').slice(0,5);
                    const digits = v.replace(/:/g,'');
                    if (digits.length >= 3 && v.indexOf(':') === -1) {
                        el.value = `${digits.slice(0,2)}:${digits.slice(2,4)}`;
                    } else {
                        el.value = v;
                    }
                });
                el.dataset.bound24 = '1';
            }
            if (el.value) {
                const nv = normalize(el.value);
                if (nv && pattern.test(nv)) el.value = nv;
            }
        } else {
            try { el.type = 'time'; } catch {}
            el.removeAttribute('placeholder');
            el.removeAttribute('pattern');
            el.removeAttribute('inputmode');
        }
    });
}

// Función auxiliar para formatear fechas de forma corta sin afectar por zona horaria
function formatDateShort(dateStr) {
    if (!dateStr) return '';
    // Si viene en formato YYYY-MM-DD, evitar usar new Date para no restar un día
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
    }
    // Fallback para otros formatos (Date, timestamp, otras cadenas)
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
}

// Función para crear eventos de múltiples días
function createMultiDayEvent(personalId, fechaInicio, fechaFin, turnoData) {
    // Crear fechas usando el constructor con parámetros separados para evitar problemas de zona horaria
    const startParts = fechaInicio.split('-');
    const endParts = fechaFin.split('-');
    
    const startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
    const endDate = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
    
    // Asegurar que las fechas sean válidas
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('Fechas inválidas:', fechaInicio, fechaFin);
        return;
    }
    
    // Iterar desde la fecha de inicio hasta la fecha de fin (inclusive)
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = formatDate(currentDate);
        
        // Inicializar la fecha si no existe
        if (!turnos[dateStr]) {
            turnos[dateStr] = {};
        }
        
        // Crear una copia del turno para cada día
        turnos[dateStr][personalId] = { ...turnoData };
        
        // Avanzar al siguiente día
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

// Función para eliminar eventos de múltiples días
function removeMultiDayEvent(personalId, fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) return;
    
    // Crear fechas usando el constructor con parámetros separados para evitar problemas de zona horaria
    const startParts = fechaInicio.split('-');
    const endParts = fechaFin.split('-');
    
    const startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
    const endDate = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return;
    }
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = formatDate(currentDate);
        
        if (turnos[dateStr] && turnos[dateStr][personalId]) {
            delete turnos[dateStr][personalId];
            
            // Si no hay más turnos en esta fecha, eliminar la fecha completa
            if (Object.keys(turnos[dateStr]).length === 0) {
                delete turnos[dateStr];
            }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

// Persistencia de datos
function saveData() {
    try {
        // Intentar usar localStorage primero
        if (typeof(Storage) !== "undefined") {
            localStorage.setItem('vigilancia-personal', JSON.stringify(personal));
            localStorage.setItem('vigilancia-turnos', JSON.stringify(turnos));
            console.log('Datos guardados correctamente en localStorage');
            // Respaldo automático versionado (throttled)
            scheduleAutoBackup();
        } else {
            // Fallback: usar cookies si localStorage no está disponible
            setCookie('vigilancia-personal', JSON.stringify(personal), 365);
            setCookie('vigilancia-turnos', JSON.stringify(turnos), 365);
            console.log('Datos guardados en cookies (fallback)');
        }
    } catch (e) {
        console.error('Error guardando datos:', e);
        // Intentar fallback con cookies
        try {
            setCookie('vigilancia-personal', JSON.stringify(personal), 365);
            setCookie('vigilancia-turnos', JSON.stringify(turnos), 365);
            showNotification('Datos guardados usando cookies (modo compatibilidad)');
        } catch (cookieError) {
            console.error('Error guardando en cookies:', cookieError);
            showNotification('Error: No se pudieron guardar los datos. Verifique la configuración del navegador.');
        }
    }
}

// Función para calcular estadísticas anuales
function calculateAnnualStats(year) {
    const stats = {};
    
    // Inicializar estadísticas para cada persona
    personal.forEach(persona => {
        stats[persona.id] = {
            nombre: persona.nombre,
            apellido: persona.apellido,
            guardias: 0,
            ausentes: 0,
            compensatorios: 0,
            estres: 0,
            articulo26: 0,
            vacaciones: 0,
            carpeta_medica: 0,
            cambios_guardia: 0,
            dia_sindical: 0,
            dia_estudio: 0
        };
    });
    
    // Contar turnos del año especificado
    Object.keys(turnos).forEach(fecha => {
        const parts = fecha.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const fechaTurno = new Date(y, m - 1, d);
        if (fechaTurno.getFullYear() === year) {
            Object.keys(turnos[fecha]).forEach(personalId => {
                const turno = turnos[fecha][personalId];
                if (stats[personalId]) {
                    switch (turno.tipo) {
                        case 'guardia_fija':
                            stats[personalId].guardias++;
                            break;
                        case 'ausente':
                            stats[personalId].ausentes++;
                            break;
                        case 'compensatorio':
                            stats[personalId].compensatorios++;
                            break;
                        case 'estres':
                            stats[personalId].estres++;
                            break;
                        case 'articulo26':
                            stats[personalId].articulo26++;
                            break;
                        case 'vacaciones':
                            stats[personalId].vacaciones++;
                            break;
                        case 'carpeta_medica':
                            stats[personalId].carpeta_medica++;
                            break;
                        case 'cambios_guardia':
                            stats[personalId].cambios_guardia++;
                            break;
                        case 'dia_sindical':
                            stats[personalId].dia_sindical++;
                            break;
                        case 'dia_estudio':
                            stats[personalId].dia_estudio++;
                            break;
                    }
                }
            });
        }
    });
    
    return stats;
}

// Función para guardar log anual
function saveAnnualLog(year, stats) {
    try {
        const logData = {
            year: year,
            timestamp: new Date().toISOString(),
            statistics: stats,
            totalPersonal: personal.length
        };
        
        // Obtener logs existentes
        let annualLogs = [];
        if (typeof(Storage) !== "undefined") {
            const savedLogs = localStorage.getItem('vigilancia-annual-logs');
            if (savedLogs) {
                annualLogs = JSON.parse(savedLogs);
            }
        }
        
        // Verificar si ya existe un log para este año
        const existingLogIndex = annualLogs.findIndex(log => log.year === year);
        if (existingLogIndex !== -1) {
            // Actualizar log existente
            annualLogs[existingLogIndex] = logData;
        } else {
            // Agregar nuevo log
            annualLogs.push(logData);
        }
        
        // Mantener solo los últimos 10 años de logs
        annualLogs = annualLogs.sort((a, b) => b.year - a.year).slice(0, 10);
        
        // Guardar logs actualizados
        if (typeof(Storage) !== "undefined") {
            localStorage.setItem('vigilancia-annual-logs', JSON.stringify(annualLogs));
        }
        
        console.log(`Log anual guardado para el año ${year}`);
        return true;
    } catch (e) {
        console.error('Error guardando log anual:', e);
        return false;
    }
}

// Función para resetear datos anuales
// mode: 'automatic' (archiva año anterior) | 'manual' (archiva año actual)
function resetAnnualData(mode = 'automatic') {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede resetear datos anuales.');
        return false;
    }
    const currentYear = new Date().getFullYear();
    const yearToArchive = mode === 'manual' ? currentYear : currentYear - 1;
    const nextCycleYear = mode === 'manual' ? currentYear + 1 : currentYear;
    
    // Calcular estadísticas del año a archivar
    const statsToArchive = calculateAnnualStats(yearToArchive);
    
    // Guardar log del año correspondiente
    const logSaved = saveAnnualLog(yearToArchive, statsToArchive);
    
    if (logSaved) {
        // Eliminar turnos del año archivado y anteriores
        const turnosToKeep = {};
        Object.keys(turnos).forEach(fecha => {
            const parts = fecha.split('-');
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            const fechaTurno = new Date(y, m - 1, d);
            if (fechaTurno.getFullYear() >= nextCycleYear) {
                turnosToKeep[fecha] = turnos[fecha];
            }
        });
        
        turnos = turnosToKeep;
        
        // Guardar datos actualizados
        saveData();
        
        // Actualizar interfaz
        renderCalendar();
        
        showNotification(`Datos del año ${yearToArchive} archivados correctamente. Sistema reiniciado para ${nextCycleYear}.`);
        console.log(`Reset anual (${mode}) completado. Datos de ${yearToArchive} guardados en logs.`);
        
        return true;
    } else {
        showNotification('Error al archivar datos del año seleccionado. Reset cancelado.');
        return false;
    }
}

// Renovar tipos específicos (Artículo 26 y Estrés) en cambio de año
function resetAnnualTypes(types = ['articulo26', 'estres']) {
    if (!isAdmin()) {
        showNotification('Acción restringida. Solo el admin puede renovar Artículo 26 y Estrés.');
        return false;
    }
    try {
        const currentYear = new Date().getFullYear();
        const yearToArchive = currentYear - 1;

        // Archivar estadísticas completas del año anterior (no se pierden datos)
        const statsToArchive = calculateAnnualStats(yearToArchive);
        saveAnnualLog(yearToArchive, statsToArchive);

        // Remover del año anterior (y anteriores) únicamente los turnos de tipos especificados
        const updatedTurnos = {};
        Object.keys(turnos).forEach(fecha => {
            const parts = fecha.split('-');
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            const fechaTurno = new Date(y, m - 1, d);

            if (fechaTurno.getFullYear() <= yearToArchive) {
                const remaining = {};
                Object.keys(turnos[fecha]).forEach(pid => {
                    const t = turnos[fecha][pid];
                    if (!types.includes(t.tipo)) {
                        remaining[pid] = t;
                    }
                });
                if (Object.keys(remaining).length > 0) {
                    updatedTurnos[fecha] = remaining;
                }
            } else {
                // Mantener turnos del año actual y futuros tal cual
                updatedTurnos[fecha] = turnos[fecha];
            }
        });

        turnos = updatedTurnos;
        saveData();
        renderCalendar();
        if (typeof updateArticulo26Counter === 'function') updateArticulo26Counter();
        showNotification('Artículo 26 y Estrés renovados para el nuevo año.');
        return true;
    } catch (e) {
        console.error('Error renovando tipos anuales:', e);
        showNotification('Error renovando tipos anuales.');
        return false;
    }
}

// Función para verificar si es necesario hacer reset anual
function checkAnnualReset() {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Verificar si es 1 de enero
    if (currentDate.getMonth() === 0 && currentDate.getDate() === 1) {
        // Verificar si ya se hizo el reset este año
        const lastResetYear = localStorage.getItem('vigilancia-last-reset-year');
        
        if (!lastResetYear || parseInt(lastResetYear) < currentYear) {
            // Mostrar confirmación al usuario
            if (confirm(`¡Es 1 de enero de ${currentYear}!\n\n¿Desea archivar las estadísticas del año ${currentYear - 1} y reiniciar el sistema para el nuevo año?\n\nEsto guardará todas las estadísticas del año anterior en los logs y limpiará los datos para comenzar el nuevo año.`)) {
                const resetSuccess = resetAnnualData('automatic');
                if (resetSuccess) {
                    localStorage.setItem('vigilancia-last-reset-year', currentYear.toString());
                }
            }
        }

        // Renovación específica de Artículo 26 y Estrés (evitar repetir en el mismo año)
        const lastTypesResetYear = localStorage.getItem('vigilancia-last-a26-estres-reset-year');
        if (!lastTypesResetYear || parseInt(lastTypesResetYear) < currentYear) {
            if (confirm(`¿Desea renovar Artículo 26 y Estrés del año ${currentYear - 1}?\n\nSe conservarán el resto de los turnos y todo lo cargado para ${currentYear} y años siguientes.`)) {
                const typesResetSuccess = resetAnnualTypes(['articulo26', 'estres']);
                if (typesResetSuccess) {
                    localStorage.setItem('vigilancia-last-a26-estres-reset-year', currentYear.toString());
                }
            }
        }
    }
}

// Función para obtener logs anuales
function getAnnualLogs() {
    try {
        if (typeof(Storage) !== "undefined") {
            const savedLogs = localStorage.getItem('vigilancia-annual-logs');
            if (savedLogs) {
                return JSON.parse(savedLogs);
            }
        }
        return [];
    } catch (e) {
        console.error('Error cargando logs anuales:', e);
        return [];
    }
}

// Función para cambiar entre tabs de estadísticas
function switchStatsTab(tab) {
    const currentTab = document.getElementById('current-stats-tab');
    const logsTab = document.getElementById('annual-logs-tab');
    const movementTab = document.getElementById('movement-logs-tab');
    const currentContent = document.getElementById('current-stats-content');
    const logsContent = document.getElementById('annual-logs-content');
    const movementContent = document.getElementById('movement-logs-content');

    const setActive = (tabBtn, contentEl, active) => {
        if (!tabBtn || !contentEl) return;
        if (active) {
            tabBtn.classList.add('active');
            contentEl.style.display = 'block';
            contentEl.classList.add('active');
        } else {
            tabBtn.classList.remove('active');
            contentEl.style.display = 'none';
            contentEl.classList.remove('active');
        }
    };

    setActive(currentTab, currentContent, tab === 'current');
    setActive(logsTab, logsContent, tab === 'logs');
    setActive(movementTab, movementContent, tab === 'movements');
}

// Función para cargar y mostrar logs anuales
function loadAnnualLogs() {
    const logs = getAnnualLogs();
    const logsContainer = document.getElementById('annual-logs-list');

    if (!logsContainer) return;

    logsContainer.innerHTML = '';

    if (logs.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'no-logs-message';
        emptyMessage.innerHTML = '<i class="fas fa-archive"></i><p>No hay logs anuales disponibles</p>';
        logsContainer.appendChild(emptyMessage);
        return;
    }

    logs.forEach(log => {
        // Crear tarjeta/contendor del año
        const card = document.createElement('div');
        card.className = 'annual-log-card';

        // Header con botón del año
        const header = document.createElement('div');
        header.className = 'log-card-header';
        header.innerHTML = `
            <h4>Año ${log.year}</h4>
            <div class="log-card-info">Archivado: ${formatDateShort(new Date(log.timestamp))}</div>
            <button class="btn-secondary year-log-btn" data-year="${log.year}">Ver</button>
        `;

        // Contenido colapsable
        const content = document.createElement('div');
        content.className = 'log-card-content';
        content.style.display = 'none';

        const table = document.createElement('table');
        table.className = 'log-stats-table';
        const thead = document.createElement('thead');
        const thr = document.createElement('tr');
        const headCells = ['Personal',
            getTypeLabel('guardia_fija'),
            getTypeLabel('ausente'),
            getTypeLabel('compensatorio'),
            getTypeLabel('estres'),
            getTypeLabel('articulo26'),
            getTypeLabel('vacaciones'),
            getTypeLabel('carpeta_medica'),
            getTypeLabel('cambios_guardia'),
            getTypeLabel('dia_sindical'),
            getTypeLabel('dia_estudio')
        ];
        headCells.forEach(txt => { const th = document.createElement('th'); th.textContent = txt; thr.appendChild(th); });
        thead.appendChild(thr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);

        
        Object.values(log.statistics).forEach(stats => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${stats.nombre} ${stats.apellido}</td>
                <td>${stats.guardias}</td>
                <td>${stats.ausentes}</td>
                <td>${stats.compensatorios}</td>
                <td>${stats.estres}</td>
                <td>${stats.articulo26}</td>
                <td>${stats.vacaciones}</td>
                <td>${stats.carpeta_medica}</td>
                <td>${stats.cambios_guardia || 0}</td>
                <td>${stats.dia_sindical || 0}</td>
                <td>${stats.dia_estudio || 0}</td>
            `;
            tbody.appendChild(row);
        });

        content.appendChild(table);
        card.appendChild(header);
        card.appendChild(content);
        logsContainer.appendChild(card);

        // Toggle de contenido al pulsar el botón
        const toggleBtn = header.querySelector('.year-log-btn');
        toggleBtn.addEventListener('click', () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? 'Ocultar' : 'Ver';
        });
    });
}

// Logs de movimientos
function getMovementLogs() {
    try {
        if (typeof(Storage) !== "undefined") {
            const saved = localStorage.getItem('vigilancia-movement-logs');
            if (saved) return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Error leyendo movement logs:', e);
    }
    return [];
}

function addMovementLog(entry) {
    try {
        const logs = getMovementLogs();
        logs.unshift(entry);
        // Limitar tamaño a últimos 300 movimientos
        const trimmed = logs.slice(0, 300);
        if (typeof(Storage) !== "undefined") {
            localStorage.setItem('vigilancia-movement-logs', JSON.stringify(trimmed));
        }
    } catch (e) {
        console.error('Error guardando movement log:', e);
    }
}

function loadMovementLogs() {
    const listEl = document.getElementById('movement-logs-list');
    if (!listEl) return;
    const logs = getMovementLogs();
    // Filtrado por personal si hay selección
    const personalFilterEl = document.getElementById('movement-log-personal-filter');
    const selectedPersonalId = personalFilterEl ? (personalFilterEl.value || '') : '';
    const filteredLogs = (function(){
        if (!selectedPersonalId) return logs;
        return logs.filter(l => {
            const d = l.details || {};
            // Para entity 'personal' usamos id directamente; para 'turno' usamos personalId
            if (l.entity === 'personal') {
                return String(d.id || '') === String(selectedPersonalId);
            } else if (l.entity === 'turno') {
                return String(d.personalId || '') === String(selectedPersonalId);
            }
            return false;
        });
    })();
    listEl.innerHTML = '';

    if (filteredLogs.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'no-logs-message';
        empty.innerHTML = '<i class="fas fa-list"></i><p>No hay movimientos registrados</p>';
        listEl.appendChild(empty);
        return;
    }

    // Helpers para formato legible
    const actionBadgeClass = (action) => {
        if (!action) return 'badge';
        if (action.includes('add')) return 'badge badge-add';
        if (action.includes('edit')) return 'badge badge-edit';
        if (action.includes('delete')) return 'badge badge-delete';
        return 'badge';
    };
    const entityBadgeClass = (entity) => {
        if (entity === 'turno') return 'badge badge-turno';
        if (entity === 'personal') return 'badge badge-personal';
        if (entity === 'login') return 'badge badge-login';
        return 'badge';
    };

    let lastDateLabel = null;
    filteredLogs.forEach((log) => {
        const dt = new Date(log.timestamp);
        const dateLabel = formatDateShort(dt);
        const timeLabel = dt.toLocaleTimeString('es-ES');

        // Insertar separador de fecha cuando cambia el día
        if (dateLabel !== lastDateLabel) {
            const group = document.createElement('div');
            group.className = 'movement-date-group';
            group.innerHTML = `
                <span class="date-label">${dateLabel}</span>
                <span class="date-line"></span>
            `;
            listEl.appendChild(group);
            lastDateLabel = dateLabel;
        }

        const item = document.createElement('div');
        item.className = 'movement-log-item';
        const userStr = log.user ? `${log.user.username} (${log.user.role})` : 'N/D';
        const d = log.details || {};
        const detailsStr = (function() {
            if (log.entity === 'personal') {
                const nombreCompleto = [d.nombre, d.apellido].filter(Boolean).join(' ');
                return nombreCompleto || (d.id ? `ID ${d.id}` : '');
            } else if (log.entity === 'turno') {
                const tipoStr = prettify(d.tipo || '');
                const fechaStr = d.fecha ? formatDateShort(d.fecha) : '';
                const partes = [d.nombre, fechaStr, tipoStr].filter(Boolean);
                return partes.join(' · ');
            } else if (log.entity === 'login') {
                const u = d.username || (log.user && log.user.username) || '-';
                const attempted = d.attempted ? ' • Intento de contraseña' : '';
                const passInfo = d.password ? ` • Contraseña: ${d.password}` : '';
                return `Usuario: ${u}${attempted}${passInfo}`;
            }
            return '';
        })();

        const actClass = actionBadgeClass(log.action || '');
        const entClass = entityBadgeClass(log.entity || '');
        const actLabel = prettify(log.action || '');
        const entLabel = prettify(log.entity || '');

        item.innerHTML = `
            <div class="movement-log-header">
                <span class="log-time">${timeLabel}</span>
                <span class="log-user">${userStr}</span>
            </div>
            <div class="movement-log-body">
                <div>
                    <span class="${actClass}">${actLabel}</span>
                    <span class="${entClass}" style="margin-left:6px;">${entLabel}</span>
                </div>
                <div class="log-details">${detailsStr}</div>
            </div>
        `;
        // Hacer el item clickeable como botón
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.addEventListener('click', () => openMovementLogModal(log));
        item.addEventListener('keypress', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                openMovementLogModal(log);
            }
        });
        listEl.appendChild(item);
    });
}

// Helper global para capitalizar y hacer legibles etiquetas/valores
function prettify(str) {
    if (!str) return '';
    return String(str)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Abrir modal de detalle de movimiento
function openMovementLogModal(log) {
    const modal = document.getElementById('movement-log-modal');
    const closeBtn = document.getElementById('close-movement-log-modal');
    if (!modal) return;
    closeHamburgerMenu();

    const dt = new Date(log.timestamp);
    const fechaStr = formatDateShort(dt);
    const horaStr = dt.toLocaleTimeString('es-ES');
    const usuarioStr = log.user ? `${log.user.username} (${log.user.role})` : 'N/D';
    const accionStr = (log.action || '').replace(/_/g, ' ');
    const entidadStr = (log.entity || '').replace(/_/g, ' ');

    const dateEl = document.getElementById('movement-log-date');
    const timeEl = document.getElementById('movement-log-time');
    const userEl = document.getElementById('movement-log-user');
    const actionEl = document.getElementById('movement-log-action');
    const entityEl = document.getElementById('movement-log-entity');
    const detailsEl = document.getElementById('movement-log-details');

    if (dateEl) dateEl.textContent = fechaStr;
    if (timeEl) timeEl.textContent = horaStr;
    if (userEl) userEl.textContent = usuarioStr;
    if (actionEl) actionEl.textContent = prettify(accionStr);
    if (entityEl) entityEl.textContent = prettify(entidadStr);
    if (detailsEl) {
        detailsEl.innerHTML = renderMovementLogDetailsHTML(log);
    }

    modal.style.display = 'block';
    lockBodyScroll();

    const onClose = () => {
        modal.style.display = 'none';
        modal.removeEventListener('click', overlayHandler);
        if (closeBtn) closeBtn.removeEventListener('click', onClose);
        unlockBodyScroll();
    };
    const overlayHandler = (ev) => {
        if (ev.target === modal) onClose();
    };
    modal.addEventListener('click', overlayHandler);
    if (closeBtn) closeBtn.addEventListener('click', onClose);
}

// Render de detalles para modal
function renderMovementLogDetailsHTML(log) {
    const d = log.details || {};
    const action = log.action || '';
    const entity = log.entity || '';

    const formatFecha = (f) => f ? formatDateShort(f) : '';

    if (entity === 'personal') {
        const nombre = [d.nombre, d.apellido].filter(Boolean).join(' ');
        const base = `<p><strong>Personal:</strong> ${nombre || (d.id ? 'ID ' + d.id : '-')}</p>`;
        if (action === 'personal_delete') {
            const prev = d; // en delete, details ya contiene snapshot
            const prevNombre = [prev.nombre, prev.apellido].filter(Boolean).join(' ');
            return base + `
                <div class="detail-block">
                    <p><strong>Registro eliminado:</strong></p>
                    <ul>
                        <li><strong>Nombre:</strong> ${prevNombre || '-'}</li>
                        <li><strong>Modalidad:</strong> ${prettify(prev.modalidadTrabajo || '')}</li>
                        <li><strong>Vacaciones:</strong> ${prev.diasVacaciones ?? '-'}</li>
                        <li><strong>Estrés:</strong> ${prev.diasEstres ?? '-'}</li>
                    </ul>
                </div>`;
        } else if (action === 'personal_edit') {
            const before = d.before || {};
            const beforeNombre = [before.nombre, before.apellido].filter(Boolean).join(' ');
            return base + `
                <div class="detail-block">
                    <p><strong>Cambios realizados:</strong></p>
                    <ul>
                        <li><strong>Antes:</strong> ${beforeNombre || '-'} · ${prettify(before.modalidadTrabajo || '')}</li>
                        <li><strong>Ahora:</strong> ${nombre || '-'} · ${prettify(d.modalidadTrabajo || '')}</li>
                    </ul>
                </div>`;
        } else if (action === 'personal_add') {
            return base + `
                <div class="detail-block">
                    <p><strong>Nuevo registro:</strong></p>
                    <ul>
                        <li><strong>Modalidad:</strong> ${prettify(d.modalidadTrabajo || '')}</li>
                        <li><strong>Vacaciones:</strong> ${d.diasVacaciones ?? '-'}</li>
                        <li><strong>Estrés:</strong> ${d.diasEstres ?? '-'}</li>
                    </ul>
                </div>`;
        }
        return base;
    } else if (entity === 'turno') {
        const nombre = d.nombre || '-';
        const fecha = formatFecha(d.fecha);
        const tipo = prettify(d.tipo || '');
        const base = `<p><strong>Personal:</strong> ${nombre}</p>
                      <p><strong>Fecha:</strong> ${fecha}</p>
                      <p><strong>Tipo:</strong> ${tipo}</p>`;

        if (action === 'turno_delete') {
            const prev = d.before || {};
            const prevTipo = prettify(prev.tipo || '');
            const prevHE = prev.horaEntrada || '-';
            const prevHS = prev.horaSalida || '-';
            const prevObs = prev.observaciones || '-';
            return base + `
                <div class="detail-block">
                    <p><strong>Turno eliminado:</strong></p>
                    <ul>
                        <li><strong>Tipo:</strong> ${prevTipo}</li>
                        <li><strong>Entrada:</strong> ${prevHE}</li>
                        <li><strong>Salida:</strong> ${prevHS}</li>
                        <li><strong>Observaciones:</strong> ${prevObs}</li>
                    </ul>
                </div>`;
        } else if (action === 'turno_edit') {
            const before = d.before || {};
            const beforeTipo = prettify(before.tipo || '');
            const beforeHE = before.horaEntrada || '-';
            const beforeHS = before.horaSalida || '-';
            const beforeObs = before.observaciones || '-';
            const nowHE = d.horaEntrada || '-';
            const nowHS = d.horaSalida || '-';
            const nowObs = d.observaciones || '-';
            return base + `
                <div class="detail-block">
                    <p><strong>Cambios realizados:</strong></p>
                    <ul>
                        <li><strong>Antes:</strong> ${beforeTipo} · ${beforeHE} - ${beforeHS} · ${beforeObs}</li>
                        <li><strong>Ahora:</strong> ${tipo} · ${nowHE} - ${nowHS} · ${nowObs}</li>
                    </ul>
                </div>`;
        } else if (action === 'turno_add') {
            const he = d.horaEntrada || '-';
            const hs = d.horaSalida || '-';
            const obs = d.observaciones || '-';
            return base + `
                <div class="detail-block">
                    <p><strong>Turno agregado:</strong></p>
                    <ul>
                        <li><strong>Entrada:</strong> ${he}</li>
                        <li><strong>Salida:</strong> ${hs}</li>
                        <li><strong>Observaciones:</strong> ${obs}</li>
                    </ul>
                </div>`;
        }
        return base;
    } else if (entity === 'login') {
        const u = d.username || (log.user && log.user.username) || '-';
        if (action === 'login_failed') {
            const attempted = d.attempted ? 'Sí' : 'No';
            const passInfo = d.password ? d.password : '-';
            return `
                <div class="detail-block">
                    <p><strong>Intento de inicio de sesión fallido</strong></p>
                    <ul>
                        <li><strong>Usuario:</strong> ${u}</li>
                        <li><strong>Intento de contraseña:</strong> ${attempted}</li>
                        <li><strong>Contraseña usada:</strong> ${passInfo}</li>
                    </ul>
                </div>`;
        }
        return `<p><strong>Login:</strong> Usuario ${u}</p>`;
    } else if (entity === 'settings') {
        if (action === 'password_update') {
            const ua = d.updatedAdmin ? 'Sí' : 'No';
            const us = d.updatedSuperadmin ? 'Sí' : 'No';
            return `
                <div class="detail-block">
                    <p><strong>Actualización de contraseñas</strong></p>
                    <ul>
                        <li><strong>Admin:</strong> ${ua}</li>
                        <li><strong>Superadmin:</strong> ${us}</li>
                    </ul>
                </div>`;
        }
        return '<p><strong>Configuraciones actualizadas</strong></p>';
    }
    return '<p>Sin detalles</p>';
}

function loadData() {
    try {
        let savedPersonal, savedTurnos;
        
        // Intentar cargar desde localStorage primero
        if (typeof(Storage) !== "undefined") {
            savedPersonal = localStorage.getItem('vigilancia-personal');
            savedTurnos = localStorage.getItem('vigilancia-turnos');
        }
        
        // Si no hay datos en localStorage, intentar cookies
        if (!savedPersonal || !savedTurnos) {
            savedPersonal = savedPersonal || getCookie('vigilancia-personal');
            savedTurnos = savedTurnos || getCookie('vigilancia-turnos');
        }
        
        if (savedPersonal) {
            try {
                personal = JSON.parse(savedPersonal);
                if (!Array.isArray(personal)) {
                    personal = [];
                }
            } catch (e) {
                console.error('Error parsing personal data:', e);
                personal = [];
            }
        }
        
        if (savedTurnos) {
            try {
                turnos = JSON.parse(savedTurnos);
                // turnos debe ser un objeto, no un array
                if (typeof turnos !== 'object' || turnos === null || Array.isArray(turnos)) {
                    turnos = {};
                }
                // Normalizar tipos antiguos
                try {
                    Object.keys(turnos).forEach(f => {
                        const per = turnos[f];
                        Object.keys(per || {}).forEach(pid => {
                            const t = per[pid];
                            if (t && t.tipo === 'carretera') {
                                t.tipo = 'carpeta_medica';
                                per[pid] = t;
                            }
                        });
                    });
                } catch {}
            } catch (e) {
                console.error('Error parsing turnos data:', e);
                turnos = {};
            }
        }
        
        console.log('Datos cargados:', { personal: personal.length, turnos: Object.keys(turnos).length });
    } catch (e) {
        console.error('Error accediendo a almacenamiento:', e);
        showNotification('Advertencia: No se pudieron cargar los datos guardados.');
    }
}

// Funciones auxiliares para cookies (fallback)
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + expires.toUTCString() + ';path=/';
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
}
// Modal de confirmación genérico
function showConfirmModal({ title, message, onAccept, onCancel }) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    const acceptBtn = document.getElementById('confirm-accept-btn');
    const headerEl = modal ? modal.querySelector('.confirmation-header') : null;
    const iconEl = headerEl ? headerEl.querySelector('.warning-icon') : null;
    if (!modal || !cancelBtn || !acceptBtn) {
        if (typeof onCancel === 'function') onCancel();
        return;
    }
    if (titleEl) titleEl.textContent = title || 'Confirmación';
    if (msgEl) msgEl.textContent = message || '¿Está seguro?';
    closeHamburgerMenu();
    modal.style.display = 'block';
    lockBodyScroll();
    const cleanup = () => {
        modal.style.display = 'none';
        acceptBtn.removeEventListener('click', acceptHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        modal.removeEventListener('click', overlayHandler);
        modal.removeEventListener('keydown', keyHandler);
        if (headerEl) headerEl.classList.remove('accepted');
        if (iconEl) iconEl.classList.remove('accepted');
        unlockBodyScroll();
    };
    const acceptHandler = () => {
        // Cambiar a estado aceptado: header verde y icono check
        if (headerEl) headerEl.classList.add('accepted');
        if (iconEl) {
            iconEl.classList.add('accepted');
            iconEl.classList.remove('fa-exclamation-triangle');
            iconEl.classList.add('fa-check-circle');
        }
        // Pequeño retraso para que el usuario perciba el cambio
        setTimeout(() => {
            cleanup();
            if (typeof onAccept === 'function') onAccept();
        }, 550);
    };
    const cancelHandler = () => {
        cleanup();
        if (typeof onCancel === 'function') onCancel();
    };
    const overlayHandler = (ev) => {
        if (ev.target === modal) {
            cancelHandler();
        }
    };
    acceptBtn.addEventListener('click', acceptHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    modal.addEventListener('click', overlayHandler);

    // Navegación por teclado: flechas para cambiar foco, Enter para aceptar/cancelar, Esc para cancelar
    const keyHandler = (ev) => {
        const k = ev.key;
        if (k === 'ArrowLeft') {
            cancelBtn.focus();
            ev.preventDefault();
        } else if (k === 'ArrowRight') {
            acceptBtn.focus();
            ev.preventDefault();
        } else if (k === 'Enter') {
            const active = document.activeElement;
            if (active === acceptBtn) {
                acceptHandler();
            } else if (active === cancelBtn) {
                cancelHandler();
            } else {
                // Por defecto, aceptar
                acceptHandler();
            }
            ev.preventDefault();
        } else if (k === 'Escape') {
            cancelHandler();
            ev.preventDefault();
        }
    };
    modal.addEventListener('keydown', keyHandler);
    // Enfocar para capturar teclado y poner Aceptar como predeterminado
    try { modal.tabIndex = -1; } catch {}
    acceptBtn.focus();
}
let scheduleUIInitialized = false;
function setupPersonalScheduleUI() {
    if (scheduleUIInitialized) {
        updateWorkdaysVisuals();
        return;
    }
    const chips = Array.from(document.querySelectorAll('#workdays-chips .day-chip'));
    chips.forEach(label => {
        const input = label.querySelector('input[type="checkbox"]');
        if (!input) return;
        const sync = () => {
            if (input.checked) label.classList.add('selected');
            else label.classList.remove('selected');
            updateWorkdaysVisuals();
        };
        input.addEventListener('change', sync);
        sync();
    });
    const presetLV = document.getElementById('preset-lv');
    const presetSadofe = document.getElementById('preset-sadofe');
    const presetTodos = document.getElementById('preset-todos');
    const presetNada = document.getElementById('preset-nada');
    const setDays = (days) => {
        ['0','1','2','3','4','5','6'].forEach(d => {
            const cb = document.getElementById(`work-day-${d}`);
            if (cb) cb.checked = days.includes(parseInt(d,10));
        });
        chips.forEach(label => {
            const input = label.querySelector('input');
            if (input && input.checked) label.classList.add('selected');
            else label.classList.remove('selected');
        });
        updateWorkdaysVisuals();
    };
    if (presetLV) presetLV.addEventListener('click', () => setDays([1,2,3,4,5]));
    if (presetSadofe) presetSadofe.addEventListener('click', () => setDays([6,0]));
    if (presetTodos) presetTodos.addEventListener('click', () => setDays([0,1,2,3,4,5,6]));
    if (presetNada) presetNada.addEventListener('click', () => setDays([]));
    scheduleUIInitialized = true;
    const fixedRadio = document.getElementById('schedule-type-fixed');
    const perdayRadio = document.getElementById('schedule-type-perday');
    const fixedBlock = document.getElementById('schedule-fixed');
    const perdayBlock = document.getElementById('schedule-perday');
    const apply = () => {
        const isPerDay = perdayRadio && perdayRadio.checked;
        if (fixedBlock) fixedBlock.style.display = isPerDay ? 'none' : '';
        if (perdayBlock) perdayBlock.style.display = isPerDay ? '' : 'none';
    };
    if (fixedRadio) fixedRadio.addEventListener('change', apply);
    if (perdayRadio) perdayRadio.addEventListener('change', apply);
    // Foco automático del horario fijo: de Entrada a Salida
    const ss = document.getElementById('schedule-start');
    const se = document.getElementById('schedule-end');
    if (ss && se && !ss.dataset.focusBound) {
        const goToEnd = () => { try { se.focus(); } catch {} };
        ss.addEventListener('change', goToEnd);
        ss.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goToEnd(); } });
        ss.dataset.focusBound = '1';
    }
    apply();
}

function updateWorkdaysVisuals() {
    const chips = Array.from(document.querySelectorAll('#workdays-chips .day-chip'));
    chips.forEach(label => {
        const input = label.querySelector('input[type="checkbox"]');
        if (!input) return;
        if (input.checked) label.classList.add('selected');
        else label.classList.remove('selected');
    });
}
function getDaysLabel(daysArr) {
    const days = Array.isArray(daysArr) ? daysArr.slice().sort((a,b)=>a-b) : [];
    const lv = [1,2,3,4,5].join(',');
    const sadofe = [6,0].join(',');
    const todos = [0,1,2,3,4,5,6].join(',');
    const key = days.join(',');
    if (key === lv) return 'Día de semana';
    if (key === sadofe) return 'SADOFE';
    if (key === todos) return 'Todos';
    return days.length ? 'Personalizado' : '-';
}
function formatTimeRange(start, end) {
    if (start && end) return `${start} – ${end}`;
    if (start) return `${start}`;
    return '-';
}
function getDefaultCodeMap() {
    return {
        'guardia_fija': 'G',
        'ausente': '28',
        'vacaciones': 'V',
        'compensatorio': 'CP',
        'estres': 'EST',
        'cambios_guardia': 'CG',
        'articulo26': 'A26',
        'carpeta_medica': 'CM',
        'dia_sindical': 'S',
        'sindical': 'S',
        'dia_estudio': 'D.E'
    };
}

function getDefaultTypeNames() {
    return {
        'guardia_fija': 'Guardia',
        'ausente': 'Ausente',
        'vacaciones': 'Vacaciones',
        'compensatorio': 'Compensatorio',
        'estres': 'Estrés',
        'cambios_guardia': 'Cambios Guardia',
        'articulo26': 'Artículo 26',
        'carpeta_medica': 'Carpeta Médica',
        'dia_sindical': 'Día Sindical',
        'sindical': 'Sindical',
        'dia_estudio': 'Día de Estudio'
    };
}

function getTypeDisplayName(tipo) {
    const defaults = getDefaultTypeNames();
    const s = getSettings();
    const override = (s && s.codeMap && s.codeMap[tipo] && s.codeMap[tipo].name) ? s.codeMap[tipo].name : '';
    return override || defaults[tipo] || tipo;
}

function getTypeLabel(tipo) {
    const name = getTypeDisplayName(tipo);
    const code = getCodigoForTipo(tipo);
    return code ? `${name} (${code})` : name;
}

function getCustomTypeConfig(id) {
    const s = getSettings();
    const list = s.customTypes || [];
    return list.find(x => x.id === id) || null;
}

function applyCustomStyleIfAny(el, tipo) {
    const cfg = getCustomTypeConfig(tipo);
    if (cfg && cfg.style) {
        const st = cfg.style;
        if (st.bg) el.style.backgroundColor = st.bg;
        if (st.border) el.style.border = `1px solid ${st.border}`;
        if (st.text) {
            el.style.color = st.text;
            const codeEl = el.querySelector('.codigo-turno');
            if (codeEl) codeEl.style.color = st.text;
        }
        el.style.fontWeight = '600';
    }
}

function getSettings() {
    try {
        const raw = localStorage.getItem('vigilancia-settings');
        const s = raw ? JSON.parse(raw) : {};
        return s && typeof s === 'object' ? s : {};
    } catch { return {}; }
}

function saveSettings(s) {
    try { localStorage.setItem('vigilancia-settings', JSON.stringify(s || {})); } catch {}
}

function getCodigoForTipo(tipo) {
    const base = getDefaultCodeMap();
    const s = getSettings();
    const ov = (s && s.codeMap && s.codeMap[tipo] && s.codeMap[tipo].code) ? s.codeMap[tipo].code : null;
    return ov || base[tipo] || '';
}
document.addEventListener('DOMContentLoaded', () => {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const cancelSettingsBtn = document.getElementById('cancel-settings');
    const settingsForm = document.getElementById('settings-form');
    if (settingsBtn && settingsModal && settingsForm) {
        if (!settingsBtn.dataset.boundClick) {
            settingsBtn.addEventListener('click', () => {
                if (!isSuperAdmin()) {
                    showNotification('Acción restringida. Solo el superadmin puede abrir configuraciones.');
                    return;
                }
                openSettingsModal();
            });
            settingsBtn.dataset.boundClick = '1';
        }
        if (settingsForm && !settingsForm.dataset.boundSubmit) {
            settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                showConfirmModal({
                    title: 'Confirmar guardado',
                    message: '¿Desea guardar los cambios de configuraciones?',
                    onAccept: async () => {
                        if (!isSuperAdmin()) { showNotification('Acción restringida. Solo el superadmin puede guardar configuraciones.'); return; }
                        const tzInput = document.getElementById('settings-timezone');
                        const base = getDefaultCodeMap();
                        const s = getSettings();
                        const codeMap = {};
                        Object.keys(base).forEach(k => {
                            const codeInp = document.getElementById(`code-${k}`);
                            const nameInp = document.getElementById(`name-${k}`);
                            const v = codeInp ? codeInp.value.trim() : '';
                            const nm = nameInp ? nameInp.value.trim() : '';
                            codeMap[k] = { code: v || base[k], name: nm };
                        });
                        const list = document.getElementById('custom-types-list');
                        const customTypes = [];
                        if (list) {
                            Array.from(list.querySelectorAll('.custom-type-row')).forEach(row => {
                                const idI = row.querySelector('.ct-id');
                                const nameI = row.querySelector('.ct-name');
                                const codeI = row.querySelector('.ct-code');
                                const bgI = row.querySelector('.ct-bg');
                                const brI = row.querySelector('.ct-border');
                                const txI = row.querySelector('.ct-text');
                                const timeCk = row.querySelector('.ct-time');
                                const rangeCk = row.querySelector('.ct-range');
                                const idRaw = (idI && idI.value.trim()) || '';
                                const id = sanitizeTypeId(idRaw);
                                const name = (nameI && nameI.value.trim()) || '';
                                const code = (codeI && codeI.value.trim()) || '';
                                if (id && code) {
                                    const style = {
                                        bg: (bgI && bgI.value) || '',
                                        border: (brI && brI.value) || '',
                                        text: (txI && txI.value) || ''
                                    };
                                    const ct = { id, name, code, style, requireTime: !!(timeCk && timeCk.checked), requireDateRange: !!(rangeCk && rangeCk.checked) };
                                    const nameOverride = document.getElementById(`name-${id}`);
                                    const codeOverride = document.getElementById(`code-${id}`);
                                    if (nameOverride) ct.name = nameOverride.value.trim() || ct.name;
                                    if (codeOverride) ct.code = codeOverride.value.trim() || ct.code;
                                    customTypes.push(ct);
                                    codeMap[id] = { code: ct.code, name: ct.name };
                                }
                            });
                        }
                        const newS = {
                            timezone: tzInput ? tzInput.value.trim() || 'America/Argentina/Buenos_Aires' : 'America/Argentina/Buenos_Aires',
                            codeMap,
                            customTypes
                        };
                        const forceEl2 = document.getElementById('force-24h');
                        newS.force24h = !!(forceEl2 && forceEl2.checked);
                        const useCustomEl2 = document.getElementById('use-custom-now');
                        const dateEl2 = document.getElementById('settings-now-date');
                        const timeEl2 = document.getElementById('settings-now-time');
                        if (useCustomEl2 && useCustomEl2.checked && dateEl2 && timeEl2 && dateEl2.value && timeEl2.value) {
                            const [yy, mm, dd] = dateEl2.value.split('-').map(n => parseInt(n, 10));
                            const [hh, min] = timeEl2.value.split(':').map(n => parseInt(n, 10));
                            const dow = new Date(yy, mm - 1, dd).getDay();
                            newS.customNow = { enabled: true, parts: { year: yy, month: mm - 1, day: dd, hour: hh, minute: min, dow } };
                        } else {
                            newS.customNow = { enabled: false };
                        }
                        const npAdminEl = document.getElementById('new-admin-password');
                        const npSuperEl = document.getElementById('new-superadmin-password');
                        let updatedAdmin = false;
                        let updatedSuper = false;
                        if (npAdminEl && npAdminEl.value.trim()) {
                            newS.adminPassHash = await sha256Hex(npAdminEl.value.trim());
                            updatedAdmin = true;
                        }
                        if (npSuperEl && npSuperEl.value.trim()) {
                            newS.superAdminPassHash = await sha256Hex(npSuperEl.value.trim());
                            updatedSuper = true;
                        }
                        saveSettings(newS);
                        addMovementLog({
                            action: 'password_update',
                            entity: 'settings',
                            user: currentUser ? { username: currentUser.username, role: currentUser.role } : null,
                            timestamp: new Date().toISOString(),
                            details: { updatedAdmin: updatedAdmin, updatedSuperadmin: updatedSuper }
                        });
                        try { if (window.__settingsClockInterval) clearInterval(window.__settingsClockInterval); } catch {}
                        window.__settingsClockInterval = null;
                        closeModal(settingsModal);
                        showNotification('Configuraciones guardadas');
                        renderCalendar();
                        applyTimeInputsFormat();
                    }
                });
            });
            settingsForm.dataset.boundSubmit = '1';
        }
        if (closeSettingsBtn && !closeSettingsBtn.dataset.boundClick) {
            closeSettingsBtn.addEventListener('click', () => { try { if (window.__settingsClockInterval) clearInterval(window.__settingsClockInterval); } catch {} window.__settingsClockInterval = null; closeModal(settingsModal); });
            closeSettingsBtn.dataset.boundClick = '1';
        }
        if (cancelSettingsBtn && !cancelSettingsBtn.dataset.boundClick) {
            cancelSettingsBtn.addEventListener('click', () => { try { if (window.__settingsClockInterval) clearInterval(window.__settingsClockInterval); } catch {} window.__settingsClockInterval = null; closeModal(settingsModal); });
            cancelSettingsBtn.dataset.boundClick = '1';
        }
    }
    applyTimeInputsFormat();
});
function openSettingsModal() {
    try {
        closeHamburgerMenu();
    } catch {}
    const modal = document.getElementById('settings-modal');
    if (!modal) {
        showNotification('No se encontró el modal de configuraciones');
        return;
    }
    const s = getSettings();
    const tzInput = document.getElementById('settings-timezone');
    if (tzInput) tzInput.value = s.timezone || 'America/Argentina/Buenos_Aires';
    const clockEl = document.getElementById('settings-current-clock');
    const dateEl = document.getElementById('settings-now-date');
    const timeEl = document.getElementById('settings-now-time');
    const useCustomEl = document.getElementById('use-custom-now');
    const syncBtn = document.getElementById('sync-device-time');
    const updateClock = () => {
        const tz = (tzInput && tzInput.value.trim()) || 'America/Argentina/Buenos_Aires';
        const p = getNowInTimeZone(tz);
        const y = p.year, m = p.month + 1, d = p.day;
        const hh = String(p.hour).padStart(2, '0');
        const mm = String(p.minute).padStart(2, '0');
        if (clockEl) clockEl.textContent = `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y} ${hh}:${mm}`;
    };
    try { if (window.__settingsClockInterval) { clearInterval(window.__settingsClockInterval); } } catch {}
    window.__settingsClockInterval = setInterval(updateClock, 1000);
    updateClock();
    if (useCustomEl) useCustomEl.checked = !!(s.customNow && s.customNow.enabled);
    const force24El = document.getElementById('force-24h');
    if (force24El) force24El.checked = !!s.force24h;
    if (s.customNow && s.customNow.parts && dateEl && timeEl) {
        const p = s.customNow.parts;
        const m = p.month + 1;
        dateEl.value = `${p.year}-${String(m).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
        timeEl.value = `${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
    } else {
        const tz = (tzInput && tzInput.value.trim()) || 'America/Argentina/Buenos_Aires';
        const p = getNowInTimeZone(tz);
        const m = p.month + 1;
        if (dateEl) dateEl.value = `${p.year}-${String(m).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
        if (timeEl) timeEl.value = `${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
    }
    if (tzInput && !tzInput.dataset.boundClock) {
        tzInput.addEventListener('change', updateClock);
        tzInput.dataset.boundClock = '1';
    }
    if (syncBtn && !syncBtn.dataset.boundClick) {
        syncBtn.addEventListener('click', () => {
            if (useCustomEl) useCustomEl.checked = false;
            const tz = (tzInput && tzInput.value.trim()) || 'America/Argentina/Buenos_Aires';
            const p = getNowInTimeZone(tz);
            const m = p.month + 1;
            if (dateEl) dateEl.value = `${p.year}-${String(m).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
            if (timeEl) timeEl.value = `${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
            updateClock();
        });
        syncBtn.dataset.boundClick = '1';
    }
    const base = getDefaultCodeMap();
    Object.keys(base).forEach(k => {
        const inp = document.getElementById(`code-${k}`);
        if (inp) inp.value = (s.codeMap && s.codeMap[k] && s.codeMap[k].code) ? s.codeMap[k].code : base[k];
        const nameInp = document.getElementById(`name-${k}`);
        if (nameInp) nameInp.value = (s.codeMap && s.codeMap[k] && s.codeMap[k].name) ? s.codeMap[k].name : '';
    });
    const list = document.getElementById('custom-types-list');
    if (list) {
        list.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'header';
        header.innerHTML = '<span>ID</span><span>Nombre visible</span><span>Código</span><span>Fondo</span><span>Borde</span><span>Texto</span><span></span><span></span><span>Acciones</span>';
        list.appendChild(header);
        const items = (s.customTypes || []);
        let ctRowCounter = 0;
        const addRow = (it = { id: '', name: '', code: '', style: {}, requireTime: false, requireDateRange: false }) => {
            const row = document.createElement('div');
            row.className = 'custom-type-row';
            const idI = document.createElement('input'); idI.type = 'text'; idI.placeholder = 'ej: permiso'; idI.value = it.id || ''; idI.className = 'ct-id'; idI.id = `ct-id-${ctRowCounter}`; idI.name = `ct-id-${ctRowCounter}`;
            const nameI = document.createElement('input'); nameI.type = 'text'; nameI.placeholder = 'Nombre visible'; nameI.value = it.name || ''; nameI.className = 'ct-name'; nameI.id = `ct-name-${ctRowCounter}`; nameI.name = `ct-name-${ctRowCounter}`;
            const codeI = document.createElement('input'); codeI.type = 'text'; codeI.placeholder = 'Código'; codeI.value = it.code || ''; codeI.className = 'ct-code'; codeI.id = `ct-code-${ctRowCounter}`; codeI.name = `ct-code-${ctRowCounter}`;
            const bgI = document.createElement('input'); bgI.type = 'color'; bgI.value = (it.style && it.style.bg) || '#f3f4f6'; bgI.className = 'ct-bg'; bgI.id = `ct-bg-${ctRowCounter}`; bgI.name = `ct-bg-${ctRowCounter}`;
            const brI = document.createElement('input'); brI.type = 'color'; brI.value = (it.style && it.style.border) || '#e5e7eb'; brI.className = 'ct-border'; brI.id = `ct-border-${ctRowCounter}`; brI.name = `ct-border-${ctRowCounter}`;
            const txI = document.createElement('input'); txI.type = 'color'; txI.value = (it.style && it.style.text) || '#374151'; txI.className = 'ct-text'; txI.id = `ct-text-${ctRowCounter}`; txI.name = `ct-text-${ctRowCounter}`;
            const bgWrap = document.createElement('div'); bgWrap.className = 'ct-color-wrap ct-bg-wrap'; const bgLbl = document.createElement('label'); bgLbl.className = 'ct-label'; bgLbl.textContent = 'Fondo'; bgLbl.setAttribute('for', bgI.id); bgWrap.appendChild(bgLbl); bgWrap.appendChild(bgI);
            const brWrap = document.createElement('div'); brWrap.className = 'ct-color-wrap ct-border-wrap'; const brLbl = document.createElement('label'); brLbl.className = 'ct-label'; brLbl.textContent = 'Borde'; brLbl.setAttribute('for', brI.id); brWrap.appendChild(brLbl); brWrap.appendChild(brI);
            const txWrap = document.createElement('div'); txWrap.className = 'ct-color-wrap ct-text-wrap'; const txLbl = document.createElement('label'); txLbl.className = 'ct-label'; txLbl.textContent = 'Texto'; txLbl.setAttribute('for', txI.id); txWrap.appendChild(txLbl); txWrap.appendChild(txI);
            const timeCk = document.createElement('input'); timeCk.type = 'checkbox'; timeCk.checked = !!it.requireTime; timeCk.className = 'ct-time'; timeCk.id = `ct-time-${ctRowCounter}`; timeCk.name = `ct-time-${ctRowCounter}`;
            const rangeCk = document.createElement('input'); rangeCk.type = 'checkbox'; rangeCk.checked = !!it.requireDateRange; rangeCk.className = 'ct-range'; rangeCk.id = `ct-range-${ctRowCounter}`; rangeCk.name = `ct-range-${ctRowCounter}`;
            const timeWrap = document.createElement('div'); timeWrap.className = 'ct-check-wrap ct-time-wrap'; const timeLbl = document.createElement('label'); timeLbl.className = 'ct-label'; timeLbl.textContent = 'Hora (E/S)'; timeLbl.setAttribute('for', timeCk.id); timeWrap.appendChild(timeLbl); timeWrap.appendChild(timeCk);
            const rangeWrap = document.createElement('div'); rangeWrap.className = 'ct-check-wrap ct-range-wrap'; const rangeLbl = document.createElement('label'); rangeLbl.className = 'ct-label'; rangeLbl.textContent = 'Rango fechas'; rangeLbl.setAttribute('for', rangeCk.id); rangeWrap.appendChild(rangeLbl); rangeWrap.appendChild(rangeCk);
            const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.textContent = 'Quitar'; delBtn.className = 'btn-secondary';
            delBtn.addEventListener('click', () => row.remove());
            row.appendChild(idI); row.appendChild(nameI); row.appendChild(codeI);
            row.appendChild(bgWrap); row.appendChild(brWrap); row.appendChild(txWrap);
            row.appendChild(timeWrap); row.appendChild(rangeWrap);
            row.appendChild(delBtn);
            list.appendChild(row);
            ctRowCounter++;
        };
        items.forEach(addRow);
        const addBtn = document.getElementById('add-custom-type');
        if (addBtn) {
            addBtn.onclick = () => addRow();
        }
    }

    const customCodesContainer = document.getElementById('custom-codes-rows');
    if (customCodesContainer) {
        customCodesContainer.innerHTML = '';
        (s.customTypes || []).forEach(ct => {
            const row = document.createElement('div');
            row.className = 'row';
            const span = document.createElement('span'); span.textContent = ct.name ? `${ct.name} (${ct.code})` : ct.id;
            const nameInp = document.createElement('input'); nameInp.type = 'text'; nameInp.id = `name-${ct.id}`; nameInp.name = `name-${ct.id}`; nameInp.placeholder = 'Nombre visible'; nameInp.value = ct.name || '';
            const codeInp = document.createElement('input'); codeInp.type = 'text'; codeInp.id = `code-${ct.id}`; codeInp.name = `code-${ct.id}`; codeInp.placeholder = 'Código'; codeInp.value = ct.code || '';
            row.appendChild(span); row.appendChild(nameInp); row.appendChild(codeInp);
            customCodesContainer.appendChild(row);
        });
    }
    modal.style.display = 'block';
    lockBodyScroll();
    applyTimeInputsFormat();
    const overlayHandlerSettings = (ev) => {
        if (ev.target === modal) {
            closeModal(modal);
            modal.removeEventListener('click', overlayHandlerSettings);
        }
    };
    modal.addEventListener('click', overlayHandlerSettings);
}
function sanitizeTypeId(str) {
    if (!str) return '';
    return String(str).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
