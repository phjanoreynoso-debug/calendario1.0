/**
 * UI Components Module
 * Provides modular, reusable UI components for the application.
 * Isolated from main logic to ensure maintainability and separation of concerns.
 */

const UIComponents = {
    /**
     * Components for Personal Management actions
     */
    PersonalActions: {
        /**
         * Renders the action buttons grid for a personal row
         * @param {string|number} id - The personal ID
         * @param {boolean} canUp - Whether move up is allowed
         * @param {boolean} canDown - Whether move down is allowed
         * @param {Object} handlers - Callback functions { onUp, onDown, onEdit, onDelete }
         * @returns {HTMLElement} The container element
         */
        render: (id, canUp, canDown, handlers) => {
            const container = document.createElement('div');
            container.className = 'actions-grid-container';

            const createBtn = (icon, title, actionName, disabled = false, cls = '') => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `btn-action-icon ${cls}`;
                btn.innerHTML = `<i class="fas ${icon}"></i>`;
                btn.title = title;
                btn.disabled = disabled;
                
                if (!disabled && handlers && handlers[actionName]) {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        handlers[actionName](id);
                    };
                }
                
                return btn;
            };

            // Layout: 2x2 Grid
            // [Up]   [Edit]
            // [Down] [Delete]
            
            // Row 1
            container.appendChild(createBtn('fa-chevron-up', 'Subir', 'onUp', !canUp, 'btn-move-up'));
            container.appendChild(createBtn('fa-pen', 'Editar', 'onEdit', false, 'btn-edit'));
            
            // Row 2
            container.appendChild(createBtn('fa-chevron-down', 'Bajar', 'onDown', !canDown, 'btn-move-down'));
            container.appendChild(createBtn('fa-trash', 'Eliminar', 'onDelete', false, 'btn-delete'));
            
            return container;
        }
    }
};

// Expose globally
window.UIComponents = UIComponents;
