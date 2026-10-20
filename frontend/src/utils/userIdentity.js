export const IDENTITY_STORAGE_KEY = 'us_partner_role_v1'; // 'partner_his' | 'partner_her'
export const PARTNER_NAMES_KEY = 'us_partner_names_v1';

export const getPartnerNames = () => {
    try {
        const saved = localStorage.getItem(PARTNER_NAMES_KEY);
        if (saved) return JSON.parse(saved);
    } catch { }
    return {
        partner_his: 'Parv',
        partner_her: 'Pookie'
    };
};

export const setPartnerNames = (namesObj) => {
    const current = getPartnerNames();
    const next = { ...current, ...namesObj };
    try {
        localStorage.setItem(PARTNER_NAMES_KEY, JSON.stringify(next));
    } catch { }
    return next;
};

export const getCurrentPartnerRole = () => {
    const saved = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (saved === 'partner_his' || saved === 'partner_her') {
        return saved;
    }
    return 'partner_his';
};

export const setCurrentPartnerRole = (role) => {
    const validRole = role === 'partner_her' ? 'partner_her' : 'partner_his';
    localStorage.setItem(IDENTITY_STORAGE_KEY, validRole);
    // Keep legacy planner ID synced to the canonical role so mobile & laptop match 100%
    localStorage.setItem('us_planner_id', validRole);
    const names = getPartnerNames();
    localStorage.setItem('us_locket_sender', names[validRole] || (validRole === 'partner_his' ? 'Him' : 'Her'));
    window.dispatchEvent(new Event('us-identity-changed'));
    return validRole;
};