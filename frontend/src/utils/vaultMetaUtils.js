const META_REGEX = /\n?<!--US_META:([\s\S]*?)-->$/;
const LOCAL_META_KEY = 'us_vault_extended_meta_v1';

const getLocalMetaStore = () => {
    try {
        const raw = localStorage.getItem(LOCAL_META_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

export const saveLocalAlbumMeta = (memoryId, patch) => {
    if (!memoryId) return {};
    try {
        const store = getLocalMetaStore();
        const existing = store[String(memoryId)] || {};
        const updated = { ...existing, ...patch };
        store[String(memoryId)] = updated;
        localStorage.setItem(LOCAL_META_KEY, JSON.stringify(store));
        return updated;
    } catch {
        return patch;
    }
};

/**
 * Extracts clean story text and extended metadata (isConstant, isPrivate, coverMediaId,
 * artPreset, tone, hisPov, herPov, tags, captions, unlockDate, locationName, lat, lon)
 * from a memory object.
 */
export const extractVaultMeta = (memory) => {
    if (!memory) {
        return {
            cleanDescription: '',
            meta: {
                isConstant: false,
                isPrivate: false,
                coverMediaId: null,
                artPreset: null,
                tone: 'light',
                hisPov: '',
                herPov: '',
                tags: [],
                captions: {},
                unlockDate: null,
                locationName: '',
                lat: null,
                lon: null
            }
        };
    }

    const rawDesc = String(memory.description || '');
    const match = rawDesc.match(META_REGEX);
    let embeddedMeta = {};
    let cleanDescription = rawDesc;

    if (match) {
        cleanDescription = rawDesc.slice(0, match.index).trimEnd();
        try {
            embeddedMeta = JSON.parse(match[1]);
        } catch {
            embeddedMeta = {};
        }
    }

    const localStore = getLocalMetaStore();
    const localMeta = localStore[String(memory.id)] || {};

    // Auto-detect #hashtags written inside the title or story text alongside saved tags
    const rawHashtags = `${memory.title || ''} ${cleanDescription}`.match(/#[a-zA-Z0-9_]+/g) || [];
    const savedTags = embeddedMeta.tags ?? localMeta.tags ?? [];
    const combinedTags = Array.from(
        new Set([
            ...(Array.isArray(savedTags) ? savedTags : []).map((t) =>
                String(t).startsWith('#') ? String(t).toLowerCase() : `#${String(t).toLowerCase()}`
            ),
            ...rawHashtags.map((t) => t.toLowerCase())
        ])
    );

    const mergedMeta = {
        isConstant: Boolean(embeddedMeta.isConstant ?? localMeta.isConstant ?? false),
        isPrivate: Boolean(memory.is_private || embeddedMeta.isPrivate || localMeta.isPrivate || false),
        coverMediaId: embeddedMeta.coverMediaId ?? localMeta.coverMediaId ?? null,
        artPreset: embeddedMeta.artPreset ?? localMeta.artPreset ?? null,
        tone: embeddedMeta.tone ?? localMeta.tone ?? 'light',
        hisPov: String(embeddedMeta.hisPov ?? localMeta.hisPov ?? ''),
        herPov: String(embeddedMeta.herPov ?? localMeta.herPov ?? ''),
        tags: combinedTags,
        captions: {
            ...(localMeta.captions || {}),
            ...(embeddedMeta.captions || {})
        },
        unlockDate: embeddedMeta.unlockDate ?? localMeta.unlockDate ?? null,
        locationName: String(embeddedMeta.locationName ?? localMeta.locationName ?? ''),
        lat: embeddedMeta.lat ?? localMeta.lat ?? null,
        lon: embeddedMeta.lon ?? localMeta.lon ?? null
    };

    return {
        cleanDescription,
        meta: mergedMeta
    };
};

/**
 * Combines clean user story text with extended metadata into a single string
 * ready to be stored in `memories.description`.
 */
export const serializeVaultDescription = (cleanDescription, metaObj = {}) => {
    const clean = String(cleanDescription || '').replace(META_REGEX, '').trimEnd();
    const payload = {};

    if (metaObj.isConstant) payload.isConstant = true;
    if (metaObj.isPrivate) payload.isPrivate = true;
    if (metaObj.coverMediaId) payload.coverMediaId = metaObj.coverMediaId;
    if (metaObj.artPreset) payload.artPreset = metaObj.artPreset;
    if (metaObj.tone && metaObj.tone !== 'light') payload.tone = metaObj.tone;
    if (metaObj.hisPov && String(metaObj.hisPov).trim()) payload.hisPov = String(metaObj.hisPov).trim();
    if (metaObj.herPov && String(metaObj.herPov).trim()) payload.herPov = String(metaObj.herPov).trim();
    if (Array.isArray(metaObj.tags) && metaObj.tags.length > 0) payload.tags = metaObj.tags;
    if (metaObj.captions && Object.keys(metaObj.captions).length > 0) {
        payload.captions = metaObj.captions;
    }
    if (metaObj.unlockDate) payload.unlockDate = metaObj.unlockDate;
    if (metaObj.locationName && String(metaObj.locationName).trim()) {
        payload.locationName = String(metaObj.locationName).trim();
    }
    if (typeof metaObj.lat === 'number' && !isNaN(metaObj.lat)) payload.lat = metaObj.lat;
    if (typeof metaObj.lon === 'number' && !isNaN(metaObj.lon)) payload.lon = metaObj.lon;

    if (Object.keys(payload).length === 0) {
        return clean;
    }

    return `${clean}\n<!--US_META:${JSON.stringify(payload)}-->`;
};