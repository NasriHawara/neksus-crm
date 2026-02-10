import { db, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from './firebase-config.js';
import { loadFinancesPage, setupFinancesSync } from './finances.js';
// Global state
window.crmState = {
    currentPage: 'dashboard',
    currentTaskView: 'list',
    clients: [],
    projects: [],
    invoices: [],
    tasks: [],
    events: [],
    activities: [],
        finances: []
};

// Store unsubscribe functions for real-time listeners
const unsubscribeFunctions = {};

// Track if initial load is complete to prevent welcome notifications on data load
let initialLoadComplete = false;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initModals();
    loadDashboard();
    setupRealtimeSync();
     setupFinancesSync();

    // Show welcome notification only once
    setTimeout(() => {
        initialLoadComplete = true;
        if (typeof window.showNotification === 'function') {
            window.showNotification('Hello GG, just a reminder, I LOVE YOU ', 'info');
        }
    }, 1000);
});

// Setup real-time synchronization across all devices
function setupRealtimeSync() {
    console.log('Setting up real-time sync...');

    // Real-time listener for clients
    unsubscribeFunctions.clients = onSnapshot(
        collection(db, 'clients'),
        (snapshot) => {
            const previousCount = window.crmState.clients.length;
            window.crmState.clients = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Only show notifications after initial load and if there are actual changes
            if (initialLoadComplete && previousCount > 0) {
                snapshot.docChanges().forEach((change) => {
                    const docData = change.doc.data();
                    if (change.type === 'added') {
                        showNotification(`New client added: ${docData.name || 'Unknown'}`, 'success');
                    } else if (change.type === 'modified') {
                        showNotification(`Client updated: ${docData.name || 'Unknown'}`, 'info');
                    } else if (change.type === 'removed') {
                        showNotification(`Client removed: ${docData.name || 'Unknown'}`, 'warning');
                    }
                });
            }

            console.log('Clients synced:', window.crmState.clients.length);
            generateRecentActivities();
            refreshCurrentPage();
        },
        (error) => {
            console.error('Error syncing clients:', error);
            showNotification('Error syncing clients', 'error');
        }
    );

    // Real-time listener for projects
    unsubscribeFunctions.projects = onSnapshot(
        collection(db, 'projects'),
        (snapshot) => {
            const previousCount = window.crmState.projects.length;
            window.crmState.projects = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Only show notifications after initial load
            if (initialLoadComplete && previousCount > 0) {
                snapshot.docChanges().forEach((change) => {
                    const docData = change.doc.data();
                    if (change.type === 'added') {
                        showNotification(`New project created: ${docData.name || 'Unknown'}`, 'success');
                    } else if (change.type === 'modified') {
                        showNotification(`Project updated: ${docData.name || 'Unknown'}`, 'info');
                    } else if (change.type === 'removed') {
                        showNotification(`Project removed: ${docData.name || 'Unknown'}`, 'warning');
                    }
                });
            }

            console.log('Projects synced:', window.crmState.projects.length);
            populateProjectDropdown();
            generateRecentActivities();
            refreshCurrentPage();
        },
        (error) => {
            console.error('Error syncing projects:', error);
            showNotification('Error syncing projects', 'error');
        }
    );

    // Real-time listener for tasks - REDUCED NOTIFICATIONS
    unsubscribeFunctions.tasks = onSnapshot(
        collection(db, 'tasks'),
        (snapshot) => {
            const previousCount = window.crmState.tasks.length;
            window.crmState.tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Only show ONE notification per task change (not multiple)
            if (initialLoadComplete && previousCount > 0) {
                snapshot.docChanges().forEach((change) => {
                    const docData = change.doc.data();
                    if (change.type === 'added') {
                        showNotification(`New task created: ${docData.title || 'Unknown'}`, 'success');
                    } else if (change.type === 'modified') {
                        // Only show completion notification if status changed to done
                        if (docData.status === 'done') {
                            showNotification(`Task completed: ${docData.title || 'Unknown'} ✓`, 'success');
                        }
                        // Removed the duplicate "Task updated" notification
                    } else if (change.type === 'removed') {
                        showNotification(`Task removed: ${docData.title || 'Unknown'}`, 'warning');
                    }
                });
            }

            console.log('Tasks synced:', window.crmState.tasks.length);
            generateRecentActivities();
            refreshCurrentPage();
        },
        (error) => {
            console.error('Error syncing tasks:', error);
            showNotification('Error syncing tasks', 'error');
        }
    );

    // Real-time listener for invoices
    unsubscribeFunctions.invoices = onSnapshot(
        collection(db, 'invoices'),
        (snapshot) => {
            const previousCount = window.crmState.invoices.length;
            window.crmState.invoices = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Only show notifications after initial load
            if (initialLoadComplete && previousCount > 0) {
                snapshot.docChanges().forEach((change) => {
                    const docData = change.doc.data();
                    if (change.type === 'added') {
                        showNotification(`New invoice created: ${docData.invoiceNumber || 'Unknown'}`, 'success');
                    } else if (change.type === 'modified') {
                        showNotification(`Invoice updated: ${docData.invoiceNumber || 'Unknown'}`, 'info');
                    } else if (change.type === 'removed') {
                        showNotification(`Invoice removed: ${docData.invoiceNumber || 'Unknown'}`, 'warning');
                    }
                });
            }

            console.log('Invoices synced:', window.crmState.invoices.length);
            generateRecentActivities();
            refreshCurrentPage();
        },
        (error) => {
            console.error('Error syncing invoices:', error);
            showNotification('Error syncing invoices', 'error');
        }
    );

    // Real-time listener for events
    unsubscribeFunctions.events = onSnapshot(
        collection(db, 'events'),
        (snapshot) => {
            const previousCount = window.crmState.events.length;
            window.crmState.events = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Only show notifications after initial load
            if (initialLoadComplete && previousCount > 0) {
                snapshot.docChanges().forEach((change) => {
                    const docData = change.doc.data();
                    if (change.type === 'added') {
                        showNotification(`New event scheduled: ${docData.title || 'Unknown'}`, 'success');
                    } else if (change.type === 'modified') {
                        showNotification(`Event updated: ${docData.title || 'Unknown'}`, 'info');
                    } else if (change.type === 'removed') {
                        showNotification(`Event removed: ${docData.title || 'Unknown'}`, 'warning');
                    }
                });
            }

            console.log('Events synced:', window.crmState.events.length);
            generateRecentActivities();
            refreshCurrentPage();
        },
        (error) => {
            console.error('Error syncing events:', error);
            showNotification('Error syncing events', 'error');
        }
    );

    console.log('Real-time sync active for all collections! 🔄');
}

// Refresh current page after data sync
function refreshCurrentPage() {
    navigateTo(window.crmState.currentPage);
}

// Cleanup listeners on page unload (good practice)
window.addEventListener('beforeunload', () => {
    Object.values(unsubscribeFunctions).forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
});

// Navigation
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === page) {
            item.classList.add('active');
        }
    });

    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    const pageTitles = {
        'dashboard': 'Dashboard',
        'clients': 'Clients',
        'projects': 'Projects',
        'tasks': 'Tasks',
        'invoices': 'Invoices',
        'calendar': 'Calendar',
        'activity': 'Activity History'
    };
    pageTitle.textContent = pageTitles[page] || page.charAt(0).toUpperCase() + page.slice(1);

    // Update current page
    window.crmState.currentPage = page;

    // Load page content
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'clients':
            if (typeof window.loadClientsPage === 'function') {
                window.loadClientsPage();
            }
            break;
        case 'projects':
            if (typeof window.loadProjectsPage === 'function') {
                window.loadProjectsPage();
            }
            break;
        case 'tasks':
            if (typeof window.loadTasksPage === 'function') {
                window.loadTasksPage();
            }
            break;
        case 'invoices':
            if (typeof window.loadInvoicesPage === 'function') {
                window.loadInvoicesPage();
            }
            break;
        case 'calendar':
            if (typeof window.loadCalendarPage === 'function') {
                window.loadCalendarPage();
            }
            break;
        case 'activity':
            loadActivityHistoryPage();
            break;
        case 'reports':
            window.loadReportsPage();
            break;
            case 'finances':
            loadFinancesPage();
            break;
    }
}

// Load all data from Firebase (fallback - we now use real-time sync)
async function loadAllData() {
    try {
        console.log('Loading data from Firebase...');

        // Load clients
        const clientsSnapshot = await getDocs(collection(db, 'clients'));
        window.crmState.clients = clientsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log('Clients loaded:', window.crmState.clients.length);

        // Load projects
        const projectsSnapshot = await getDocs(collection(db, 'projects'));
        window.crmState.projects = projectsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log('Projects loaded:', window.crmState.projects.length);

        // Load invoices
        const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
        window.crmState.invoices = invoicesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log('Invoices loaded:', window.crmState.invoices.length);

        // Load tasks
        const tasksSnapshot = await getDocs(collection(db, 'tasks'));
        window.crmState.tasks = tasksSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log('Tasks loaded:', window.crmState.tasks.length);

        // Load events
        const eventsSnapshot = await getDocs(collection(db, 'events'));
        window.crmState.events = eventsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log('Events loaded:', window.crmState.events.length);

        // Generate activities from loaded data
        generateRecentActivities();

        // Populate project dropdown in task form
        populateProjectDropdown();

        // Refresh current page
        navigateTo(window.crmState.currentPage);
    } catch (error) {
        console.error('Error loading data:', error);
        if (typeof window.showNotification === 'function') {
            window.showNotification('Error loading data from Firebase', 'error');
        }
    }
}

// Generate recent activities from all data - IMPROVED SORTING
function generateRecentActivities() {
    const activities = [];
    const { clients, projects, invoices, tasks, events } = window.crmState;

    // Process clients
    clients.forEach(client => {
        if (client.createdAt) {
            activities.push({
                type: 'client',
                action: 'created',
                title: `New client added: ${client.name}`,
                description: client.email || '',
                timestamp: client.createdAt,
                timestampMs: parseTimestamp(client.createdAt),
                icon: 'user',
                color: 'blue'
            });
        }
        if (client.updatedAt && client.updatedAt !== client.createdAt) {
            activities.push({
                type: 'client',
                action: 'updated',
                title: `Client updated: ${client.name}`,
                description: client.email || '',
                timestamp: client.updatedAt,
                timestampMs: parseTimestamp(client.updatedAt),
                icon: 'user',
                color: 'blue'
            });
        }
    });

    // Process projects
    projects.forEach(project => {
        if (project.createdAt) {
            activities.push({
                type: 'project',
                action: 'created',
                title: `New project created: ${project.name}`,
                description: `Status: ${project.status || 'N/A'}`,
                timestamp: project.createdAt,
                timestampMs: parseTimestamp(project.createdAt),
                icon: 'folder',
                color: 'green'
            });
        }
        if (project.updatedAt && project.updatedAt !== project.createdAt) {
            activities.push({
                type: 'project',
                action: 'updated',
                title: `Project updated: ${project.name}`,
                description: `Status: ${project.status || 'N/A'}`,
                timestamp: project.updatedAt,
                timestampMs: parseTimestamp(project.updatedAt),
                icon: 'folder',
                color: 'green'
            });
        }
    });

    // Process tasks
    tasks.forEach(task => {
        if (task.createdAt) {
            activities.push({
                type: 'task',
                action: 'created',
                title: `Task created: ${task.title}`,
                description: `Priority: ${task.priority || 'N/A'}`,
                timestamp: task.createdAt,
                timestampMs: parseTimestamp(task.createdAt),
                icon: 'check',
                color: 'purple'
            });
        }
        if (task.status === 'done' && task.updatedAt) {
            activities.push({
                type: 'task',
                action: 'completed',
                title: `Task completed: ${task.title}`,
                description: `Priority: ${task.priority || 'N/A'}`,
                timestamp: task.updatedAt,
                timestampMs: parseTimestamp(task.updatedAt),
                icon: 'check-circle',
                color: 'success'
            });
        } else if (task.updatedAt && task.updatedAt !== task.createdAt) {
            activities.push({
                type: 'task',
                action: 'updated',
                title: `Task updated: ${task.title}`,
                description: `Status: ${task.status || 'N/A'}`,
                timestamp: task.updatedAt,
                timestampMs: parseTimestamp(task.updatedAt),
                icon: 'check',
                color: 'purple'
            });
        }
    });

    // Process invoices
    invoices.forEach(invoice => {
        if (invoice.createdAt) {
            activities.push({
                type: 'invoice',
                action: 'created',
                title: `Invoice created: ${invoice.invoiceNumber || 'N/A'}`,
                description: `Amount: ${formatCurrency(invoice.total || invoice.amount || 0)}`,
                timestamp: invoice.createdAt,
                timestampMs: parseTimestamp(invoice.createdAt),
                icon: 'file',
                color: 'orange'
            });
        }
        if (invoice.updatedAt && invoice.updatedAt !== invoice.createdAt) {
            activities.push({
                type: 'invoice',
                action: 'updated',
                title: `Invoice updated: ${invoice.invoiceNumber || 'N/A'}`,
                description: `Status: ${invoice.status || 'N/A'}`,
                timestamp: invoice.updatedAt,
                timestampMs: parseTimestamp(invoice.updatedAt),
                icon: 'file',
                color: 'orange'
            });
        }
    });

    // Process events
    events.forEach(event => {
        if (event.createdAt) {
            activities.push({
                type: 'event',
                action: 'created',
                title: `Event scheduled: ${event.title}`,
                description: event.date ? `Date: ${formatDate(event.date)}` : '',
                timestamp: event.createdAt,
                timestampMs: parseTimestamp(event.createdAt),
                icon: 'calendar',
                color: 'indigo'
            });
        }
        if (event.updatedAt && event.updatedAt !== event.createdAt) {
            activities.push({
                type: 'event',
                action: 'updated',
                title: `Event updated: ${event.title}`,
                description: event.date ? `Date: ${formatDate(event.date)}` : '',
                timestamp: event.updatedAt,
                timestampMs: parseTimestamp(event.updatedAt),
                icon: 'calendar',
                color: 'indigo'
            });
        }
    });

    // Sort by timestamp - NEWEST FIRST (most recent at the top)
    // Using the parsed millisecond timestamp for accurate sorting
    activities.sort((a, b) => b.timestampMs - a.timestampMs);

    window.crmState.activities = activities;
    console.log('✅ Activities generated and sorted (newest first):', activities.length);

    // Log first 5 activities for debugging
    if (activities.length > 0) {
        console.log('📋 Most recent 5 activities:');
        activities.slice(0, 5).forEach((a, idx) => {
            console.log(`  ${idx + 1}. ${a.title} - ${new Date(a.timestampMs).toLocaleString()}`);
        });
    }
}

// Helper function to parse various timestamp formats into milliseconds
function parseTimestamp(timestamp) {
    if (!timestamp) return 0;
    
    // If it's already a number (milliseconds), return it
    if (typeof timestamp === 'number') return timestamp;
    
    // If it's a Firestore Timestamp object
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().getTime();
    }
    
    // If it's a string or Date object
    try {
        return new Date(timestamp).getTime();
    } catch (e) {
        console.warn('Could not parse timestamp:', timestamp);
        return 0;
    }
}

// Helper function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Helper function to get relative time
function getRelativeTime(timestamp) {
    if (!timestamp) return 'Unknown';

    const timestampMs = parseTimestamp(timestamp);
    const now = Date.now();
    const diffInSeconds = Math.floor((now - timestampMs) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;

    return formatDate(timestamp);
}

// Get icon SVG based on type
function getActivityIcon(iconType) {
    const icons = {
        'user': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        'folder': '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
        'check': '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
        'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
        'file': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
        'calendar': '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
    };
    return icons[iconType] || icons['check'];
}

// Populate project dropdown
function populateProjectDropdown() {
    const projectSelect = document.getElementById('taskProject');
    if (projectSelect && window.crmState.projects) {
        projectSelect.innerHTML = '<option value="">No Project</option>';
        window.crmState.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
        });
    }
}

// Dashboard - Shows only 10 most recent activities
function loadDashboard() {
    const content = document.getElementById('pageContent');
    const { clients, projects, invoices, tasks, activities } = window.crmState;

    // Calculate stats
    const totalClients = clients.length;
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const unpaidInvoices = invoices.filter(i => i.status === 'unpaid' || i.status === 'sent');
    const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.total || inv.amount || 0), 0);
    const thisMonth = invoices
        .filter(i => {
            const invDate = new Date(i.date);
            const now = new Date();
            return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, inv) => sum + (inv.total || inv.amount || 0), 0);

    // Get today's tasks
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(task => task.dueDate === today);

    // ✅ DASHBOARD: Show only 10 most recent activities (already sorted newest first)
    const recentActivities = activities.slice(0, 10);

    console.log(`📊 Dashboard loaded: Showing ${recentActivities.length} of ${activities.length} total activities`);

    content.innerHTML = `
        <!-- Stats Grid -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-info">
                        <h3>Total Clients</h3>
                        <p>${totalClients}</p>
                    </div>
                    <div class="stat-icon blue">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                    </div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-info">
                        <h3>Active Projects</h3>
                        <p>${activeProjects}</p>
                    </div>
                    <div class="stat-icon green">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                    </div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-info">
                        <h3>Unpaid Invoices</h3>
                        <p>$${unpaidAmount.toFixed(2)}</p>
                    </div>
                    <div class="stat-icon red">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                    </div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-info">
                        <h3>This Month</h3>
                        <p>$${thisMonth.toFixed(2)}</p>
                    </div>
                    <div class="stat-icon purple">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="1" x2="12" y2="23"/>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                    </div>
                </div>
            </div>
        </div>

        <!-- Dashboard Grid -->
        <div class="dashboard-grid">
            <!-- Today's Agenda -->
            <div class="card">
                <div class="card-header">
                    <h3>Today's Agenda</h3>
                    <a href="#" class="card-link" onclick="event.preventDefault(); navigateTo('tasks');">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        View Tasks
                    </a>
                </div>
                ${todayTasks.length === 0 ? `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 11l3 3L22 4"/>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                        <h4>No items due today!</h4>
                        <p>You're all caught up.</p>
                    </div>
                ` : `
                    <div class="task-list-compact">
                        ${todayTasks.map(task => `
                            <div class="task-item-compact">
                                <div class="task-checkbox">
                                    <input type="checkbox" ${task.status === 'done' ? 'checked' : ''}
                                           onchange="toggleTaskStatus('${task.id}', this.checked)">
                                </div>
                                <div class="task-info-compact">
                                    <div class="task-title-compact">${task.title}</div>
                                    <div class="task-meta-compact">
                                        <span class="badge ${getPriorityClass(task.priority)}">${task.priority}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <!-- Quick Actions -->
            <div class="card">
                <div class="card-header">
                    <h3>Quick Actions</h3>
                </div>
                <div class="quick-actions-grid">
                    <button class="action-button" onclick="window.openAddClientModal && window.openAddClientModal()">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="8.5" cy="7" r="4"/>
                            <line x1="20" y1="8" x2="20" y2="14"/>
                            <line x1="23" y1="11" x2="17" y2="11"/>
                        </svg>
                        <span>Add Client</span>
                    </button>
                    <button class="action-button" onclick="window.openAddProjectModal && window.openAddProjectModal()">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                            <line x1="12" y1="11" x2="12" y2="17"/>
                            <line x1="9" y1="14" x2="15" y2="14"/>
                        </svg>
                        <span>New Project</span>
                    </button>
                    <button class="action-button" onclick="window.openAddInvoiceModal && window.openAddInvoiceModal()">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="12" y1="18" x2="12" y2="12"/>
                            <line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                        <span>Create Invoice</span>
                    </button>
                    <button class="action-button" onclick="initiateSearch()">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.35-4.35"/>
                        </svg>
                        <span>Search</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Recent Activity -->
        <div class="card">
            <div class="card-header">
                <h3>Recent Activity</h3>
                <a href="#" class="card-link" onclick="event.preventDefault(); navigateTo('activity');">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    View All (${activities.length})
                </a>
            </div>
            ${recentActivities.length === 0 ? `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    <h4>No recent activity</h4>
                    <p>Activity will appear here as you work.</p>
                </div>
            ` : `
                <div class="activity-list">
                    ${recentActivities.map(activity => `
                        <div class="activity-item">
                            <div class="activity-icon ${activity.color}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    ${getActivityIcon(activity.icon)}
                                </svg>
                            </div>
                            <div class="activity-content">
                                <div class="activity-title">${activity.title}</div>
                                <div class="activity-description">${activity.description}</div>
                            </div>
                            <div class="activity-time">${getRelativeTime(activity.timestamp)}</div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
}

// Load Activity History Page - Shows ALL activities
function loadActivityHistoryPage() {
    const content = document.getElementById('pageContent');
    const { activities } = window.crmState;

    // ✅ HISTORY PAGE: Show ALL activities (no limit)
    const allActivities = activities;
    const displayCount = allActivities.length;

    console.log(`📜 Activity History loaded: Showing ALL ${displayCount} activities (newest first)`);

    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3>All Activity History (Newest First)</h3>
                <span class="badge info">${displayCount} total activities</span>
            </div>
            ${allActivities.length === 0 ? `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    <h4>No activity yet</h4>
                    <p>Start working and your activity will be tracked here.</p>
                </div>
            ` : `
                <div class="activity-list" style="max-height: none;">
                    ${allActivities.map((activity, index) => `
                        <div class="activity-item">
                            <div class="activity-icon ${activity.color}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    ${getActivityIcon(activity.icon)}
                                </svg>
                            </div>
                            <div class="activity-content">
                                <div class="activity-title">${activity.title}</div>
                                <div class="activity-description">${activity.description}</div>
                                <div class="activity-meta">
                                    <span class="badge ${activity.color}">${activity.type}</span>
                                    <span class="badge secondary">${activity.action}</span>
                                </div>
                            </div>
                            <div class="activity-time">
                                ${getRelativeTime(activity.timestamp)}
                                <div class="activity-date">${formatDate(activity.timestamp)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
}

// Helper function to get priority badge class
function getPriorityClass(priority) {
    const classes = {
        'high': 'danger',
        'medium': 'warning',
        'low': 'info'
    };
    return classes[priority] || 'info';
}

// Helper function to get status badge class
function getStatusClass(status) {
    const classes = {
        'done': 'success',
        'in-progress': 'warning',
        'review': 'info',
        'todo': 'secondary'
    };
    return classes[status] || 'secondary';
}

// Toggle task status
window.toggleTaskStatus = async function(taskId, isDone) {
    try {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, {
            status: isDone ? 'done' : 'todo',
            updatedAt: new Date().toISOString()
        });

        // Notification is handled by real-time listener
        // No need to call loadAllData() - real-time sync will handle it
    } catch (error) {
        console.error('Error updating task:', error);
        showNotification('Failed to update task status', 'error');
    }
}

// Search functionality
window.initiateSearch = function() {
    openModal('searchModal');
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', performSearch);
    }
}

function performSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const resultsDiv = document.getElementById('searchResults');

    if (!resultsDiv || !searchTerm) {
        if (resultsDiv) resultsDiv.innerHTML = '';
        return;
    }

    const { clients, projects, tasks, invoices } = window.crmState;
    let results = [];

    // Search clients
    clients.forEach(client => {
        if (client.name.toLowerCase().includes(searchTerm) ||
            client.email.toLowerCase().includes(searchTerm)) {
            results.push({ type: 'Client', name: client.name, data: client });
        }
    });

    // Search projects
    projects.forEach(project => {
        if (project.name.toLowerCase().includes(searchTerm)) {
            results.push({ type: 'Project', name: project.name, data: project });
        }
    });

    // Search tasks
    tasks.forEach(task => {
        if (task.title.toLowerCase().includes(searchTerm) ||
            (task.description && task.description.toLowerCase().includes(searchTerm))) {
            results.push({ type: 'Task', name: task.title, data: task });
        }
    });

    // Search invoices
    invoices.forEach(invoice => {
        if (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(searchTerm)) {
            results.push({ type: 'Invoice', name: invoice.invoiceNumber, data: invoice });
        }
    });

    if (results.length === 0) {
        resultsDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No results found</p>';
    } else {
        resultsDiv.innerHTML = results.map(result => `
            <div class="search-result-item">
                <span class="badge info">${result.type}</span>
                <span>${result.name}</span>
            </div>
        `).join('');
    }
}

// Modal functions
function initModals() {
    const quickAddBtn = document.getElementById('quickAddBtn');
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            openModal('quickAddModal');
        });
    }
}

window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// Export functions to window for inline onclick handlers
window.loadAllData = loadAllData;
window.navigateTo = navigateTo;
window.initiateSearch = initiateSearch;
window.showNotification = showNotification;

console.log('✅ App.js loaded successfully with real-time sync and fixed sorting! 🔄');

