// api.js
const API_URL = 'https://raw.githubusercontent.com/Culby/smart-scheduling-links/refs/heads/master/examples/%24bulk-publish';

/**
 * Fetch bulk publish JSON from API
 */
export async function fetchBulkPublishData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (err) {
        console.error('Failed to fetch API data:', err);
        return null;
    }
}

/**
 * Get URLs by resource type from bulk publish JSON
 */
export function getUrlsByType(apiData, type) {
    if (!apiData || !apiData.output) return [];
    return apiData.output
        .filter(item => item.type === type)
        .map(item => ({
            url: item.url,
            extension: item.extension || null
        }));
}

/**
 * Fetch NDJSON file and parse each line as JSON
 */
export async function fetchNdjson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch NDJSON: ${url}`);
        const text = await response.text();
        return text
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
    } catch (err) {
        console.error(err);
        return [];
    }
}

function fix_url(str) {
    return str.replace(/smart-on-fhir/g, 'Culby');
}

/**
 * Load all practitioner roles, schedules, and slots
 */
export async function loadAllData() {
    const apiData = await fetchBulkPublishData();
    if (!apiData) return null;

    const practitionerUrls = getUrlsByType(apiData, 'PractitionerRole')
    const scheduleUrls = getUrlsByType(apiData, 'Schedule');
    const slotUrls = getUrlsByType(apiData, 'Slot');

    const practitioners = [];
    const schedules = [];
    const slots = [];

    for (const p of practitionerUrls) practitioners.push(...await fetchNdjson(fix_url(p.url)));
    for (const s of scheduleUrls) schedules.push(...await fetchNdjson(fix_url(s.url)));
    for (const s of slotUrls) slots.push(...await fetchNdjson(fix_url(s.url)));

    return { practitioners, schedules, slots };
}
