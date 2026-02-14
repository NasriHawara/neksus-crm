import { db, collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, getDocs } from './firebase-config.js';
import { showNotification } from './utils.js';

// Calendar state
let currentDate = new Date();
let currentView = 'month'; // month, week, day
let selectedDate = null;

// Load Calendar Page
window.loadCalendarPage = function() {
    const content = document.getElementById('pageContent');
    
    const calendarHTML = `
        <div class=\"calendar-container\">
            <!-- Calendar Header -->
            <div class=\"card\" style=\"margin-bottom: 20px;\">
                <div class=\"card-header\" style=\"display: flex; justify-content: space-between; align-items: center;\">
                    <div style=\"display: flex; align-items: center; gap: 16px;\">
                        <h3 style=\"margin: 0;\">Calendar</h3>
                        <div class=\"view-toggle\" style=\"display: flex; gap: 8px; background: var(--bg-secondary, #f3f4f6); padding: 4px; border-radius: 8px;\">
                            <button class=\"view-btn ${currentView === 'month' ? 'active' : ''}\" onclick=\"switchCalendarView('month')\" data-testid=\"month-view-btn\">Month</button>
                            <button class=\"view-btn ${currentView === 'week' ? 'active' : ''}\" onclick=\"switchCalendarView('week')\" data-testid=\"week-view-btn\">Week</button>
                            <button class=\"view-btn ${currentView === 'day' ? 'active' : ''}\" onclick=\"switchCalendarView('day')\" data-testid=\"day-view-btn\">Day</button>
                        </div>
                    </div>
                    <button class=\"primary-button\" onclick=\"openAddEventModal()\" data-testid=\"add-event-btn\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/>
                            <line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>
                        </svg>
                        Add Event
                    </button>
                </div>
            </div>

            <!-- Calendar Navigation -->
            <div class=\"card\" style=\"margin-bottom: 20px;\">
                <div style=\"display: flex; justify-content: space-between; align-items: center; padding: 16px;\">
                    <button class=\"button secondary\" onclick=\"navigateCalendar('prev')\" data-testid=\"prev-btn\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <polyline points=\"15 18 9 12 15 6\"/>
                        </svg>
                        Previous
                    </button>
                    <h2 id=\"calendarTitle\" style=\"margin: 0;\" data-testid=\"calendar-title\">${getCalendarTitle()}</h2>
                    <button class=\"button secondary\" onclick=\"navigateCalendar('next')\" data-testid=\"next-btn\">
                        Next
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <polyline points=\"9 18 15 12 9 6\"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Calendar View Container -->
            <div class=\"card\">
                <div id=\"calendarViewContainer\" data-testid=\"calendar-view-container\">
                    <!-- Calendar will be rendered here -->
                </div>
            </div>

            <!-- Upcoming Events -->
            <div class=\"card\" style=\"margin-top: 20px;\">
                <div class=\"card-header\">
                    <h3>Upcoming Events</h3>
                </div>
                <div id=\"upcomingEventsList\" data-testid=\"upcoming-events-list\">
                    <!-- Upcoming events will be rendered here -->
                </div>
            </div>
        </div>
    `;

    content.innerHTML = calendarHTML;
    renderCalendarView();
    renderUpcomingEvents();
}

// Get Calendar Title
function getCalendarTitle() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    
    if (currentView === 'month') {
        return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (currentView === 'week') {
        const weekStart = getWeekStart(currentDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} - ${monthNames[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
    } else {
        return `${monthNames[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    }
}

// Switch Calendar View
window.switchCalendarView = function(view) {
    currentView = view;
    window.loadCalendarPage();
}

// Navigate Calendar
window.navigateCalendar = function(direction) {
    if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
        currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    
    document.getElementById('calendarTitle').textContent = getCalendarTitle();
    renderCalendarView();
}

// Render Calendar View
function renderCalendarView() {
    const container = document.getElementById('calendarViewContainer');
    if (!container) return;

    if (currentView === 'month') {
        renderMonthView(container);
    } else if (currentView === 'week') {
        renderWeekView(container);
    } else {
        renderDayView(container);
    }
}

// Render Month View
function renderMonthView(container) {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const events = window.crmState.events || [];
    
    let html = `
        <div class=\"calendar-month\">
            <div class=\"calendar-weekdays\">
                <div class=\"calendar-weekday\">Sun</div>
                <div class=\"calendar-weekday\">Mon</div>
                <div class=\"calendar-weekday\">Tue</div>
                <div class=\"calendar-weekday\">Wed</div>
                <div class=\"calendar-weekday\">Thu</div>
                <div class=\"calendar-weekday\">Fri</div>
                <div class=\"calendar-weekday\">Sat</div>
            </div>
            <div class=\"calendar-days\">
    `;
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        html += '<div class=\"calendar-day empty\"></div>';
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        // Fix: Use local date string instead of ISO to avoid timezone issues
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateString = `${year}-${month}-${dayStr}`;
        const dayEvents = events.filter(e => e.date === dateString);
        const isToday = isSameDay(date, new Date());
        
        html += `
            <div class=\"calendar-day ${isToday ? 'today' : ''}\" onclick=\"selectDate('${dateString}')\" data-testid=\"calendar-day-${day}\">
                <div class=\"day-number\">${day}</div>
                <div class=\"day-events\">
                    ${dayEvents.slice(0, 3).map(event => `
                        <div class=\"day-event\" style=\"background: ${getEventColor(event.type)};\" onclick=\"event.stopPropagation(); viewEventDetail('${event.id}')\" title=\"${event.title}\" data-testid=\"event-${event.id}\">
                            ${event.title.length > 15 ? event.title.substring(0, 15) + '...' : event.title}
                        </div>
                    `).join('')}
                    ${dayEvents.length > 3 ? `<div class=\"day-event-more\">+${dayEvents.length - 3} more</div>` : ''}
                </div>
            </div>
        `;
    }
    
    html += '</div></div>';
    container.innerHTML = html;
}

// Render Week View
function renderWeekView(container) {
    const weekStart = getWeekStart(currentDate);
    const events = window.crmState.events || [];
    
    let html = `
        <div class=\"calendar-week\">
            <div class=\"week-header\">
    `;
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        const isToday = isSameDay(date, new Date());
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        html += `
            <div class=\"week-day-header ${isToday ? 'today' : ''}\" onclick=\"selectDate('${dateString}')\">
                <div class=\"day-name\">${dayNames[date.getDay()]}</div>
                <div class=\"day-date\">${date.getDate()}</div>
            </div>
        `;
    }
    
    html += '</div><div class=\"week-body\">';
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        const dayEvents = events.filter(e => e.date === dateString);
        
        html += `
            <div class=\"week-day-column\" onclick=\"selectDate('${dateString}')\">
                ${dayEvents.map(event => `
                    <div class=\"week-event\" style=\"background: ${getEventColor(event.type)};\" onclick=\"event.stopPropagation(); viewEventDetail('${event.id}')\" data-testid=\"event-${event.id}\">
                        <div class=\"event-time\">${event.time || 'All day'}</div>
                        <div class=\"event-title\">${event.title}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    html += '</div></div>';
    container.innerHTML = html;
}

// Render Day View
function renderDayView(container) {
    const dateString = currentDate.toISOString().split('T')[0];
    const events = (window.crmState.events || []).filter(e => e.date === dateString);
    
    let html = `
        <div class=\"calendar-day-view\">
            <div class=\"day-view-header\">
                <h3>${currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            </div>
            <div class=\"day-view-events\">
    `;
    
    if (events.length === 0) {
        html += `
            <div class=\"empty-state\">
                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"width: 48px; height: 48px; margin-bottom: 16px;\">
                    <rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>
                    <line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/>
                    <line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/>
                    <line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/>
                </svg>
                <h4>No events scheduled</h4>
                <p>Click \"Add Event\" to create your first event for this day.</p>
            </div>
        `;
    } else {
        events.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        events.forEach(event => {
            html += `
                <div class=\"day-event-card\" style=\"border-left: 4px solid ${getEventColor(event.type)};\" onclick=\"viewEventDetail('${event.id}')\" data-testid=\"event-card-${event.id}\">
                    <div class=\"event-card-time\">${event.time || 'All day'}</div>
                    <div class=\"event-card-content\">
                        <h4>${event.title}</h4>
                        ${event.description ? `<p>${event.description}</p>` : ''}
                        ${event.project ? `<span class=\"badge info\">${event.project}</span>` : ''}
                        ${event.client ? `<span class=\"badge success\">${event.client}</span>` : ''}
                    </div>
                </div>
            `;
        });
    }
    
    html += '</div></div>';
    container.innerHTML = html;
}

// Render Upcoming Events
function renderUpcomingEvents() {
    const container = document.getElementById('upcomingEventsList');
    if (!container) return;
    
    const events = window.crmState.events || [];
    const today = new Date().toISOString().split('T')[0];
    const upcomingEvents = events
        .filter(e => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
        .slice(0, 5);
    
    if (upcomingEvents.length === 0) {
        container.innerHTML = `
            <div class=\"empty-state\" style=\"padding: 32px;\">
                <p>No upcoming events</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = upcomingEvents.map(event => `
        <div class=\"list-item\" onclick=\"viewEventDetail('${event.id}')\" style=\"cursor: pointer; border-left: 4px solid ${getEventColor(event.type)};\" data-testid=\"upcoming-event-${event.id}\">
            <div style=\"flex: 1;\">
                <h4 style=\"margin: 0 0 4px 0;\">${event.title}</h4>
                <p style=\"margin: 0; font-size: 14px; color: var(--text-secondary);\">
                    ${formatEventDate(event.date)} ${event.time ? `at ${event.time}` : ''}
                </p>
            </div>
            <div style=\"display: flex; gap: 8px; align-items: center;\">
                ${event.project ? `<span class=\"badge info\">${event.project}</span>` : ''}
                ${event.client ? `<span class=\"badge success\">${event.client}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// Helper Functions
function isSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

function getEventColor(type) {
    const colors = {
        meeting: '#3b82f6',
        deadline: '#ef4444',
        task: '#10b981',
        reminder: '#f59e0b',
        other: '#8b5cf6'
    };
    return colors[type] || colors.other;
}

function formatEventDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, tomorrow)) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Select Date
window.selectDate = function(dateString) {
    selectedDate = dateString;
    openAddEventModal(dateString);
}

// Open Add Event Modal
window.openAddEventModal = function(preSelectedDate = null) {
    const projects = window.crmState.projects || [];
    const clients = window.crmState.clients || [];
    
    const projectOptions = projects.map(p => `<option value=\"${p.name}\">${p.name}</option>`).join('');
    const clientOptions = clients.map(c => `<option value=\"${c.name}\">${c.name}</option>`).join('');
    
    const defaultDate = preSelectedDate || new Date().toISOString().split('T')[0];
    
    const modalHTML = `
        <div class=\"modal active\" id=\"eventModal\">
            <div class=\"modal-content\" style=\"max-width: 600px;\">
                <div class=\"modal-header\">
                    <h3>Add Event</h3>
                    <button class=\"close-button\" onclick=\"document.getElementById('eventModal')?.remove();\">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>
                <div class=\"modal-body\">
                    <form id=\"eventForm\" onsubmit=\"saveEvent(event)\">
                        <div class=\"form-group\">
                            <label>Event Title *</label>
                            <input type=\"text\" name=\"title\" required placeholder=\"Enter event title\" data-testid=\"event-title-input\">
                        </div>

                        <div class=\"form-group\">
                            <label>Description</label>
                            <textarea name=\"description\" rows=\"3\" placeholder=\"Event description\" data-testid=\"event-description-input\"></textarea>
                        </div>

                        <div class=\"form-row\" style=\"display: grid; grid-template-columns: 1fr 1fr; gap: 16px;\">
                            <div class=\"form-group\">
                                <label>Date *</label>
                                <input type=\"date\" name=\"date\" required value=\"${defaultDate}\" data-testid=\"event-date-input\">
                            </div>
                            <div class=\"form-group\">
                                <label>Time</label>
                                <input type=\"time\" name=\"time\" data-testid=\"event-time-input\">
                            </div>
                        </div>

                        <div class=\"form-group\">
                            <label>Event Type</label>
                            <select name=\"type\" data-testid=\"event-type-select\">
                                <option value=\"meeting\">Meeting</option>
                                <option value=\"deadline\">Deadline</option>
                                <option value=\"task\">Task</option>
                                <option value=\"reminder\">Reminder</option>
                                <option value=\"other\">Other</option>
                            </select>
                        </div>

                        <div class=\"form-group\">
                            <label>Link to Project</label>
                            <select name=\"project\" data-testid=\"event-project-select\">
                                <option value=\"\">No project</option>
                                ${projectOptions}
                            </select>
                        </div>

                        <div class=\"form-group\">
                            <label>Link to Client</label>
                            <select name=\"client\" data-testid=\"event-client-select\">
                                <option value=\"\">No client</option>
                                ${clientOptions}
                            </select>
                        </div>

                        <div class=\"form-group\">
                            <label>Location</label>
                            <input type=\"text\" name=\"location\" placeholder=\"Meeting location or link\" data-testid=\"event-location-input\">
                        </div>

                        <div class=\"form-actions\">
                            <button type=\"button\" class=\"button secondary\" onclick=\"document.getElementById('eventModal')?.remove();\">Cancel</button>
                            <button type=\"submit\" class=\"button primary\" data-testid=\"save-event-btn\">Add Event</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Save Event
window.saveEvent = async function(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const eventData = {
        title: formData.get('title'),
        description: formData.get('description'),
        date: formData.get('date'),
        time: formData.get('time'),
        type: formData.get('type'),
        project: formData.get('project'),
        client: formData.get('client'),
        location: formData.get('location'),
        createdAt: serverTimestamp()
    };
    
    try {
        await addDoc(collection(db, 'events'), eventData);
        window.closeModal('eventModal');
        document.getElementById('eventModal')?.remove();
        await window.loadAllData();
        window.loadCalendarPage();
    } catch (error) {
        console.error('Error adding event:', error);
        showNotification('Error adding event. Please try again.', 'error');
    }
}

// View Event Detail
window.viewEventDetail = function(eventId) {
    const event = (window.crmState.events || []).find(e => e.id === eventId);
    if (!event) return;
    
    const modalHTML = `
        <div class=\"modal active\" id=\"eventDetailModal\" style=\"z-index: 1001;\">
            <div class=\"modal-content\" style=\"max-width: 600px;\">
                <div class=\"modal-header\">
                    <div>
                        <h3>${event.title}</h3>
                        <p style=\"color: var(--text-secondary); font-size: 14px; margin-top: 4px;\">
                            ${formatEventDate(event.date)} ${event.time ? `at ${event.time}` : ''}
                        </p>
                    </div>
                    <button class=\"close-button\" onclick=\"closeEventDetailModal()\">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>
                <div class=\"modal-body\">
                    <!-- Event Type Banner -->
                    <div style=\"padding: 16px; background: ${getEventColor(event.type)}; border-radius: 12px; margin-bottom: 24px; color: white;\">
                        <div style=\"font-size: 14px; opacity: 0.9; margin-bottom: 4px;\">Event Type</div>
                        <div style=\"font-size: 20px; font-weight: 700; text-transform: capitalize;\">${event.type || 'Other'}</div>
                    </div>

                    ${event.description ? `
                        <div style=\"margin-bottom: 20px;\">
                            <h4 style=\"margin-bottom: 8px;\">Description</h4>
                            <p style=\"color: var(--text-secondary); line-height: 1.6;\">${event.description}</p>
                        </div>
                    ` : ''}

                    <div style=\"display: grid; gap: 16px; margin-bottom: 20px;\">
                        ${event.location ? `
                            <div style=\"background: var(--bg-secondary, #f3f4f6); padding: 12px; border-radius: 8px;\">
                                <div style=\"font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;\">Location</div>
                                <div style=\"font-size: 14px; font-weight: 500;\">${event.location}</div>
                            </div>
                        ` : ''}

                        ${event.project ? `
                            <div style=\"background: var(--bg-secondary, #f3f4f6); padding: 12px; border-radius: 8px;\">
                                <div style=\"font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;\">Project</div>
                                <div style=\"font-size: 14px; font-weight: 500;\">${event.project}</div>
                            </div>
                        ` : ''}

                        ${event.client ? `
                            <div style=\"background: var(--bg-secondary, #f3f4f6); padding: 12px; border-radius: 8px;\">
                                <div style=\"font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;\">Client</div>
                                <div style=\"font-size: 14px; font-weight: 500;\">${event.client}</div>
                            </div>
                        ` : ''}
                    </div>

                    <div style=\"display: flex; gap: 12px; margin-top: 24px;\">
                        <button class=\"button primary\" onclick=\"editEvent('${eventId}'); closeEventDetailModal();\" style=\"flex: 1;\" data-testid=\"edit-event-btn\">
                            <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 8px;\">
                                <path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/>
                                <path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/>
                            </svg>
                            Edit Event
                        </button>
                        <button class=\"button secondary\" onclick=\"deleteEvent('${eventId}'); closeEventDetailModal();\" data-testid=\"delete-event-btn\">
                            <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 8px;\">
                                <polyline points=\"3 6 5 6 21 6\"/>
                                <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>
                            </svg>
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close Event Detail Modal
window.closeEventDetailModal = function() {
    const modal = document.getElementById('eventDetailModal');
    if (modal) modal.remove();
}

// Edit Event
window.editEvent = function(eventId) {
    const event = (window.crmState.events || []).find(e => e.id === eventId);
    if (!event) return;
    
    const projects = window.crmState.projects || [];
    const clients = window.crmState.clients || [];
    
    const projectOptions = projects.map(p => 
        `<option value=\"${p.name}\" ${p.name === event.project ? 'selected' : ''}>${p.name}</option>`
    ).join('');
    const clientOptions = clients.map(c => 
        `<option value=\"${c.name}\" ${c.name === event.client ? 'selected' : ''}>${c.name}</option>`
    ).join('');
    
    const modalHTML = `
        <div class=\"modal active\" id=\"eventModal\">
            <div class=\"modal-content\" style=\"max-width: 600px;\">
                <div class=\"modal-header\">
                    <h3>Edit Event</h3>
                    <button class=\"close-button\" onclick=\"document.getElementById('eventModal')?.remove();\">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>
                <div class=\"modal-body\">
                    <form id=\"eventForm\" onsubmit=\"updateEvent(event, '${eventId}')\">
                        <div class=\"form-group\">
                            <label>Event Title *</label>
                            <input type=\"text\" name=\"title\" required value=\"${event.title}\" data-testid=\"event-title-input\">
                        </div>

                        <div class=\"form-group\">
                            <label>Description</label>
                            <textarea name=\"description\" rows=\"3\" data-testid=\"event-description-input\">${event.description || ''}</textarea>
                        </div>

                        <div class=\"form-row\" style=\"display: grid; grid-template-columns: 1fr 1fr; gap: 16px;\">
                            <div class=\"form-group\">
                                <label>Date *</label>
                                <input type=\"date\" name=\"date\" required value=\"${event.date}\" data-testid=\"event-date-input\">
                            </div>
                            <div class=\"form-group\">
                                <label>Time</label>
                                <input type=\"time\" name=\"time\" value=\"${event.time || ''}\" data-testid=\"event-time-input\">
                            </div>
                        </div>

                        <div class=\"form-group\">
                            <label>Event Type</label>
                            <select name=\"type\" data-testid=\"event-type-select\">
                                <option value=\"meeting\" ${event.type === 'meeting' ? 'selected' : ''}>Meeting</option>
                                <option value=\"deadline\" ${event.type === 'deadline' ? 'selected' : ''}>Deadline</option>
                                <option value=\"task\" ${event.type === 'task' ? 'selected' : ''}>Task</option>
                                <option value=\"reminder\" ${event.type === 'reminder' ? 'selected' : ''}>Reminder</option>
                                <option value=\"other\" ${event.type === 'other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>

                        <div class=\"form-group\">
                            <label>Link to Project</label>
                            <select name=\"project\" data-testid=\"event-project-select\">
                                <option value=\"\">No project</option>
                                ${projectOptions}
                            </select>
                        </div>

                        <div class=\"form-group\">
                            <label>Link to Client</label>
                            <select name=\"client\" data-testid=\"event-client-select\">
                                <option value=\"\">No client</option>
                                ${clientOptions}
                            </select>
                        </div>

                        <div class=\"form-group\">
                            <label>Location</label>
                            <input type=\"text\" name=\"location\" value=\"${event.location || ''}\" data-testid=\"event-location-input\">
                        </div>

                        <div class=\"form-actions\">
                            <button type=\"button\" class=\"button secondary\" onclick=\"document.getElementById('eventModal')?.remove();\">Cancel</button>
                            <button type=\"submit\" class=\"button primary\" data-testid=\"update-event-btn\">Update Event</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Update Event
window.updateEvent = async function(e, eventId) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const eventData = {
        title: formData.get('title'),
        description: formData.get('description'),
        date: formData.get('date'),
        time: formData.get('time'),
        type: formData.get('type'),
        project: formData.get('project'),
        client: formData.get('client'),
        location: formData.get('location'),
        updatedAt: serverTimestamp()
    };
    
    try {
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, eventData);
        window.closeModal('eventModal');
        document.getElementById('eventModal')?.remove();
        await window.loadAllData();
        window.loadCalendarPage();
    } catch (error) {
        console.error('Error updating event:', error);
        showNotification('Error updating event. Please try again.', 'error');
    }
}

// Delete Event
window.deleteEvent = async function(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
        const eventRef = doc(db, 'events', eventId);
        await deleteDoc(eventRef);
        await window.loadAllData();
        window.loadCalendarPage();
    } catch (error) {
        console.error('Error deleting event:', error);
        showNotification('Error deleting event. Please try again.', 'error');
    }
}

