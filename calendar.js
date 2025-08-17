// calendar.js
import { loadAllData } from './api.js';

let currentDate = new Date();
const monthCache = {}; // key: "YYYY-MM" -> availabilityMap
let practitioners = [], schedules = [], slots = [];

/**
 * Convert weekday string to index (0=Sun, 1=Mon, ...)
 */
function dayOfWeekIndex(day) {
    const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    return map[day.toLowerCase()] ?? 0;
}

/**
 * Build availability map for a specific month
 */
function buildAvailabilityMapForMonth(month, year) {
    const key = `${year}-${month + 1}`;
    if (monthCache[key]) return monthCache[key]; // use cached

    const map = {};
    const scheduleMap = Object.fromEntries(schedules.map(s => [s.id, s]));
    const practitionerMap = Object.fromEntries(practitioners.map(p => [p.id, p]));

    slots.forEach(slot => {
        if (slot.status !== 'free') return;
        const startDate = new Date(slot.start);
        if (startDate.getFullYear() !== year || startDate.getMonth() !== month) return;

        const dateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const scheduleId = slot.schedule.reference.split('/')[1];
        const schedule = scheduleMap[scheduleId];
        if (!schedule) return;

        const actorRef = schedule.actor?.find(a => a.reference.startsWith('PractitionerRole/'));
        const practitionerId = actorRef?.reference?.split('/')[1];
        const practitioner = practitionerMap[practitionerId];

        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push({
            start: startDate,
            end: new Date(slot.end),
            practitioner: practitioner?.practitioner?.display ?? 'Unknown',
            location: schedule.actor?.map(a => a.display).join(', ') ?? 'Unknown',
            bookingUrl: slot.extension?.find(e => e.url.includes('booking-deep-link'))?.valueUrl ?? null,
            phone: slot.extension?.find(e => e.url.includes('booking-phone'))?.valueString ?? null
        });
    });

    monthCache[key] = map; // cache it
    return map;
}

/**
 * Render calendar for month/year
 */
function renderCalendar(month, year) {
    const monthYear = document.getElementById('monthYear');
    monthYear.textContent = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarBody = document.getElementById('calendarBody');
    calendarBody.innerHTML = '';

    const availabilityMap = buildAvailabilityMapForMonth(month, year);

    let dayCounter = 1;
    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');
        for (let d = 0; d < 7; d++) {
            const cell = document.createElement('td');
            if ((week === 0 && d < firstDay) || dayCounter > daysInMonth) {
                cell.textContent = '';
            } else {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCounter).padStart(2, '0')}`;
                cell.textContent = dayCounter;

                if (availabilityMap[dateStr]) {
                    cell.style.backgroundColor = '#b3e6b3';
                    cell.style.cursor = 'pointer';
                    cell.addEventListener('click', () => showSlotsForDay(dateStr, availabilityMap[dateStr]));
                }

                dayCounter++;
            }
            row.appendChild(cell);
        }
        calendarBody.appendChild(row);
    }
}

function showSlotsForDay(dateStr, slotsForDay) {
    const slotList = document.getElementById('slotList');
    slotList.innerHTML = '';

    // 1️⃣ Group slots by start time
    const grouped = {};
    slotsForDay.forEach(slot => {
        const timeKey = slot.start.toISOString(); // use exact start time as key
        if (!grouped[timeKey]) grouped[timeKey] = [];
        grouped[timeKey].push(slot);
    });

    // 2️⃣ Sort start times
    const sortedTimes = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

    // 3️⃣ Render
    sortedTimes.forEach(timeStr => {
        const slotsAtTime = grouped[timeStr];
        const startTime = new Date(timeStr);

        const li = document.createElement('li');
        li.innerHTML = `<strong>${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>`;

        // List all doctors available at this slot
        const doctorList = document.createElement('ul');
        doctorList.style.listStyle = 'none';
        doctorList.style.paddingLeft = '10px';
        slotsAtTime.forEach(slot => {
            const docLi = document.createElement('li');
            docLi.innerHTML = `
                ${slot.practitioner} @ ${slot.location} 
                ${slot.bookingUrl ? `<a href="${slot.bookingUrl}" target="_blank">Book</a>` : ''}
                ${slot.phone ? ` | ${slot.phone}` : ''}
            `;
            doctorList.appendChild(docLi);
        });

        li.appendChild(doctorList);
        slotList.appendChild(li);
    });
}



/**
 * Initialize calendar
 */
export async function initCalendar() {
    const data = await loadAllData();
    practitioners = data.practitioners;
    schedules = data.schedules;
    slots = data.slots;

    renderCalendar(currentDate.getMonth(), currentDate.getFullYear());

    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate.getMonth(), currentDate.getFullYear());
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate.getMonth(), currentDate.getFullYear());
    });
}
