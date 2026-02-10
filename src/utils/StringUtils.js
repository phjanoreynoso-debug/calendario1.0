export function sanitizeTypeId(str) {
    if (!str) return '';
    return String(str).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
