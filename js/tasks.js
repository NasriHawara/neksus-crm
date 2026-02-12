import { db, collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from './firebase-config.js';
import { showNotification, debounce } from './utils.js';

// Task state
let taskFilters = {
    search: '',
    status: 'all',
    priority: 'all',
    sortBy: 'newest'
};

let currentPage = 1;
const itemsPerPage = 10;
let showHistory = false; // Track if showing history view

// Load Tasks Page
window.loadTasksPage = function() {
    const content = document.getElementById('pageContent');
    const { tasks } = window.crmState;

    if (tasks.length === 0) {
        content.innerHTML = `
            <div class=\"card\">
                <div class=\"empty-state\">
                    <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                        <path d=\"M9 11l3 3L22 4\"/>
                        <path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>
                    </svg>
                    <h4>No tasks yet</h4>
                    <p>Create your first task to get started.</p>
                    <button class=\"primary-button\" style=\"margin-top: 16px;\" onclick=\"openAddTaskModal()\">Add Task</button>
                </div>
            </div>
        `;
        return;
    }

    renderTasksPage();
}

function renderTasksPage() {
    const content = document.getElementById('pageContent');
    let filteredTasks = filterAndSortTasks();

    // Filter tasks based on history view
    if (showHistory) {
        filteredTasks = filteredTasks.filter(task => task.status === 'done');
    } else {
        filteredTasks = filteredTasks.filter(task => task.status !== 'done');
    }

    // Pagination
    const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

    content.innerHTML = `
        <div class=\"card\">
            <div class=\"card-header\">
                <h3>${showHistory ? 'Completed Tasks' : 'Active Tasks'} (${filteredTasks.length})</h3>
                <div style=\"display: flex; gap: 12px;\">
                    <button class=\"button ${showHistory ? 'primary' : 'secondary'}\" onclick=\"toggleHistoryView()\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 8px;\">
                            ${showHistory ? 
                                '<path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><polyline points=\"9 22 9 12 15 12 15 22\"/>' : 
                                '<circle cx=\"12\" cy=\"12\" r=\"10\"/><polyline points=\"12 6 12 12 16 14\"/>'
                            }
                        </svg>
                        ${showHistory ? 'Back to Active' : 'History'}
                    </button>
                    <button class=\"button secondary\" onclick=\"exportTasks()\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 8px;\">
                            <path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/>
                            <polyline points=\"17 8 12 3 7 8\"/>
                            <line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"15\"/>
                        </svg>
                        Export CSV
                    </button>
                    ${!showHistory ? `
                        <button class=\"primary-button\" onclick=\"openAddTaskModal()\">
                            <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                <line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/>
                                <line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>
                            </svg>
                            Add Task
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Modern Search and Filter Toolbar -->
            <div style=\"padding: 24px; border-bottom: 1px solid var(--border-color);\">
                <!-- Enhanced Search Box -->
                <div style=\"margin-bottom: 20px;\">
                    <div class=\"modern-search-box\">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <circle cx=\"11\" cy=\"11\" r=\"8\"/>
                            <path d=\"m21 21-4.35-4.35\"/>
                        </svg>
                        <input type=\"text\" id=\"taskSearch\" placeholder=\"Search by task title or description...\" value=\"${taskFilters.search}\" onkeyup=\"handleTaskSearch(event)\">
                    </div>
                </div>

                <!-- Modern Filter Pills - Status -->
                ${!showHistory ? `
                <div style=\"margin-bottom: 16px;\">
                    <div style=\"display: flex; align-items: center; flex-wrap: wrap; gap: 8px;\">
                        <span style=\"font-size: 13px; color: var(--text-secondary); margin-right: 8px; font-weight: 500;\">Status:</span>
                        <div class=\"filter-pills\">
                            <button class=\"filter-pill ${taskFilters.status === 'all' ? 'active' : ''}\" onclick=\"handleTaskStatusFilter({target: {value: 'all'}})\">
                                <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                    <circle cx=\"12\" cy=\"12\" r=\"10\"/>
                                </svg>
                                All
                            </button>
                            <button class=\"filter-pill ${taskFilters.status === 'todo' ? 'active' : ''}\" onclick=\"handleTaskStatusFilter({target: {value: 'todo'}})\">
                                <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                    <circle cx=\"12\" cy=\"12\" r=\"10\"/>
                                </svg>
                                To Do
                            </button>
                            <button class=\"filter-pill ${taskFilters.status === 'in-progress' ? 'active' : ''}\" onclick=\"handleTaskStatusFilter({target: {value: 'in-progress'}})\">
                                <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                    <circle cx=\"12\" cy=\"12\" r=\"10\"/>
                                    <path d=\"M12 6v6l4 2\"/>
                                </svg>
                                In Progress
                            </button>
                            <button class=\"filter-pill ${taskFilters.status === 'review' ? 'active' : ''}\" onclick=\"handleTaskStatusFilter({target: {value: 'review'}})\">
                                <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                    <path d=\"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\"/>
                                    <circle cx=\"12\" cy=\"12\" r=\"3\"/>
                                </svg>
                                Review
                            </button>

                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- Modern Filter Pills - Priority & Sort -->
                <div style=\"display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;\">
                    <div style=\"display: flex; align-items: center; flex-wrap: wrap; gap: 8px;\">
                        <span style=\"font-size: 13px; color: var(--text-secondary); margin-right: 8px; font-weight: 500;\">Priority:</span>
                        <div class=\"filter-pills\">
                            <button class=\"filter-pill ${taskFilters.priority === 'all' ? 'active' : ''}\" onclick=\"handleTaskPriorityFilter({target: {value: 'all'}})\">
                                All
                            </button>
                            <button class=\"filter-pill ${taskFilters.priority === 'high' ? 'active' : ''}\" onclick=\"handleTaskPriorityFilter({target: {value: 'high'}})\">
                                🔴 High
                            </button>
                            <button class=\"filter-pill ${taskFilters.priority === 'medium' ? 'active' : ''}\" onclick=\"handleTaskPriorityFilter({target: {value: 'medium'}})\">
                                🟡 Medium
                            </button>
                            <button class=\"filter-pill ${taskFilters.priority === 'low' ? 'active' : ''}\" onclick=\"handleTaskPriorityFilter({target: {value: 'low'}})\">
                                🟢 Low
                            </button>
                        </div>
                    </div>

                    <!-- Modern Sort Dropdown -->
                    <div class=\"modern-sort-container\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 8px; color: var(--text-secondary);\">
                            <line x1=\"4\" y1=\"6\" x2=\"20\" y2=\"6\"/>
                            <line x1=\"8\" y1=\"12\" x2=\"20\" y2=\"12\"/>
                            <line x1=\"12\" y1=\"18\" x2=\"20\" y2=\"18\"/>
                        </svg>
                        <select id=\"taskSortFilter\" class=\"modern-select\" onchange=\"handleTaskSortFilter(event)\">
                            <option value=\"newest\" ${taskFilters.sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
                            <option value=\"oldest\" ${taskFilters.sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
                            <option value=\"due-date\" ${taskFilters.sortBy === 'due-date' ? 'selected' : ''}>Due Date</option>
                            <option value=\"a-z\" ${taskFilters.sortBy === 'a-z' ? 'selected' : ''}>Title (A-Z)</option>
                            <option value=\"z-a\" ${taskFilters.sortBy === 'z-a' ? 'selected' : ''}>Title (Z-A)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class=\"table-container\">
                <table>
                    <thead>
                        <tr>
                            <th>Task</th>
                            <th>Project</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Due Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedTasks.map(task => {
                            const project = window.crmState.projects.find(p => p.id === task.projectId);
                            return `
                                <tr>
                                    <td>
                                        <strong style=\"cursor: pointer; color: var(--primary-purple);\" onclick=\"viewTaskDetail('${task.id}')\">${task.title}</strong>
                                    </td>
                                    <td>${project ? project.name : '-'}</td>
                                    <td><span class=\"badge ${getTaskPriorityBadge(task.priority)}\">${task.priority || 'Medium'}</span></td>
                                    <td><span class=\"badge ${getTaskStatusBadge(task.status)}\">${task.status || 'To Do'}</span></td>
                                    <td>${task.dueDate || '-'}</td>
                                    <td>
                                        <div class=\"action-buttons\">
                                            <button class=\"btn-icon\" onclick=\"viewTaskDetail('${task.id}')\" title=\"View Details\">
                                                <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                    <path d=\"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\"/>
                                                    <circle cx=\"12\" cy=\"12\" r=\"3\"/>
                                                </svg>
                                            </button>
                                            <button class=\"btn-icon\" onclick=\"editTask('${task.id}')\" title=\"Edit\">
                                                <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                    <path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/>
                                                    <path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/>
                                                </svg>
                                            </button>
                                            <button class=\"btn-icon\" onclick=\"deleteTask('${task.id}')\" title=\"Delete\">
                                                <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                    <polyline points=\"3 6 5 6 21 6\"/>
                                                    <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            ${totalPages > 1 ? `
                <div class=\"pagination\">
                    <button onclick=\"changeTaskPage(${currentPage - 1})\" ${currentPage === 1 ? 'disabled' : ''}>
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <polyline points=\"15 18 9 12 15 6\"/>
                        </svg>
                    </button>
                    ${Array.from({length: totalPages}, (_, i) => i + 1).map(page => `
                        <button class=\"${page === currentPage ? 'active' : ''}\" onclick=\"changeTaskPage(${page})\">${page}</button>
                    `).join('')}
                    <button onclick=\"changeTaskPage(${currentPage + 1})\" ${currentPage === totalPages ? 'disabled' : ''}>
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <polyline points=\"9 18 15 12 9 6\"/>
                        </svg>
                    </button>
                </div>
            ` : ''}
        </div>

        <style>
            /* Modern Search Box */
            .modern-search-box {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 18px;
                background: var(--bg-darker);
                border: 2px solid var(--border-color);
                border-radius: 12px;
                transition: all 0.3s ease;
            }

            .modern-search-box:focus-within {
                border-color: var(--primary-purple);
                box-shadow: 0 0 0 4px rgba(152, 62, 151, 0.1);
                background: var(--bg-card);
            }

            .modern-search-box svg {
                color: var(--text-secondary);
                flex-shrink: 0;
            }

            .modern-search-box input {
                flex: 1;
                border: none;
                background: transparent;
                color: var(--text-primary);
                font-size: 14px;
                outline: none;
            }

            .modern-search-box input::placeholder {
                color: var(--text-muted);
            }

            /* Filter Pills */
            .filter-pills {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            .filter-pill {
                display: flex;
                align-items: center;
                padding: 8px 16px;
                background: var(--bg-darker);
                border: 1px solid var(--border-color);
                border-radius: 20px;
                color: var(--text-secondary);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .filter-pill:hover {
                background: var(--bg-hover);
                border-color: var(--primary-purple);
                color: var(--text-primary);
                transform: translateY(-2px);
            }

            .filter-pill.active {
                background: linear-gradient(135deg, var(--primary-purple) 0%, var(--primary-purple-dark) 100%);
                border-color: var(--primary-purple);
                color: var(--text-primary);
                box-shadow: 0 4px 12px rgba(152, 62, 151, 0.3);
            }

            .filter-pill svg {
                flex-shrink: 0;
            }

            /* Modern Sort Container */
            .modern-sort-container {
                display: flex;
                align-items: center;
                padding: 8px 14px;
                background: var(--bg-darker);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                transition: all 0.3s ease;
            }

            .modern-sort-container:focus-within {
                border-color: var(--primary-purple);
                box-shadow: 0 0 0 3px rgba(152, 62, 151, 0.1);
            }

            .modern-select {
                border: none;
                background: transparent;
                color: var(--text-primary);
                font-size: 13px;
                font-weight: 500;
                outline: none;
                cursor: pointer;
                padding-right: 8px;
            }

            .modern-select option {
                background: var(--bg-card);
                color: var(--text-primary);
            }

            /* Task Detail Modal Tabs */
            .detail-tabs {
                display: flex;
                gap: 8px;
                padding: 16px 24px 0;
                border-bottom: 1px solid var(--border-color);
            }

            .detail-tab {
                padding: 12px 20px;
                background: transparent;
                border: none;
                color: var(--text-secondary);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s ease;
            }

            .detail-tab:hover {
                color: var(--text-primary);
                background: var(--bg-hover);
            }

            .detail-tab.active {
                color: var(--primary-purple);
                border-bottom-color: var(--primary-purple);
            }

            .detail-tab-content {
                display: none;
                padding: 24px;
            }

            .detail-tab-content.active {
                display: block;
            }

            .info-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
                margin-bottom: 20px;
            }

            .info-item {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .info-label {
                font-size: 12px;
                color: var(--text-secondary);
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .info-value {
                font-size: 15px;
                color: var(--text-primary);
                font-weight: 500;
            }

            .section-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .project-card, .client-card {
                background: var(--bg-darker);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                padding: 16px;
                margin-bottom: 12px;
                transition: all 0.2s ease;
            }

            .project-card:hover, .client-card:hover {
                border-color: var(--primary-purple);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(152, 62, 151, 0.2);
            }

            .empty-section {
                text-align: center;
                padding: 40px 20px;
                color: var(--text-secondary);
            }

            .empty-section svg {
                width: 48px;
                height: 48px;
                margin-bottom: 12px;
                opacity: 0.4;
            }
        </style>
    `;
}

// Toggle history view
window.toggleHistoryView = function() {
    showHistory = !showHistory;
    currentPage = 1; // Reset to first page
    renderTasksPage();
}

function filterAndSortTasks() {
    let tasks = [...window.crmState.tasks];

    // Search filter
    if (taskFilters.search) {
        const searchLower = taskFilters.search.toLowerCase();
        tasks = tasks.filter(task =>
            task.title.toLowerCase().includes(searchLower) ||
            (task.description && task.description.toLowerCase().includes(searchLower))
        );
    }

    // Status filter (only apply in non-history view)
    if (!showHistory && taskFilters.status !== 'all') {
        tasks = tasks.filter(task => task.status === taskFilters.status);
    }

    // Priority filter
    if (taskFilters.priority !== 'all') {
        tasks = tasks.filter(task => task.priority === taskFilters.priority);
    }

    // Sort
    switch(taskFilters.sortBy) {
        case 'newest':
            tasks.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
            break;
        case 'oldest':
            tasks.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateA - dateB;
            });
            break;
        case 'due-date':
            tasks.sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            });
            break;
        case 'a-z':
            tasks.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'z-a':
            tasks.sort((a, b) => b.title.localeCompare(a.title));
            break;
    }

    return tasks;
}

function getTaskStatusBadge(status) {
    switch(status) {
        case 'done': return 'success';
        case 'in-progress': return 'warning';
        case 'review': return 'info';
        case 'todo': return 'secondary';
        default: return 'secondary';
    }
}

function getTaskPriorityBadge(priority) {
    switch(priority) {
        case 'high': return 'danger';
        case 'medium': return 'warning';
        case 'low': return 'info';
        default: return 'info';
    }
}

// Handlers
window.handleTaskSearch = debounce(function(event) {
    taskFilters.search = event.target.value;
    currentPage = 1;
    renderTasksPage();
}, 300);

window.handleTaskStatusFilter = function(event) {
    taskFilters.status = event.target.value;
    currentPage = 1;
    renderTasksPage();
}

window.handleTaskPriorityFilter = function(event) {
    taskFilters.priority = event.target.value;
    currentPage = 1;
    renderTasksPage();
}

window.handleTaskSortFilter = function(event) {
    taskFilters.sortBy = event.target.value;
    currentPage = 1;
    renderTasksPage();
}

window.changeTaskPage = function(page) {
    currentPage = page;
    renderTasksPage();
}

// Export Tasks
window.exportTasks = function() {
    const tasks = window.crmState.tasks.map(task => {
        const project = window.crmState.projects.find(p => p.id === task.projectId);
        return {
            title: task.title,
            description: task.description || '',
            project: project ? project.name : '',
            status: task.status || '',
            priority: task.priority || '',
            dueDate: task.dueDate || '',
            assignee: task.assignee || ''
        };
    });
    
    // Simple CSV export
    const headers = Object.keys(tasks[0]).join(',');
    const rows = tasks.map(t => Object.values(t).map(v => `\"${v}\"`).join(','));
const csv = [headers, ...rows].join('\n');
const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks.csv';
    a.click();
}

// Open Add Task Modal
window.openAddTaskModal = function() {
    if (typeof window.closeModal === 'function') {
        window.closeModal('quickAddModal');
    }

    const projects = window.crmState.projects;
    const projectOptions = projects.map(p => `<option value=\"${p.id}\">${p.name}</option>`).join('');

    const modalHTML = `
        <div class=\"modal active\" id=\"taskModal\">
            <div class=\"modal-content\">
                <div class=\"modal-header\">
                    <h3>Add New Task</h3>
                        <button class="close-button" onclick="closeTaskModal()">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>
                <div class=\"modal-body\">
                    <form id=\"taskForm\" onsubmit=\"saveTask(event)\">
                        <div class=\"form-group\">
                            <label>Task Title *</label>
                            <input type=\"text\" name=\"title\" required placeholder=\"Enter task title\">
                        </div>
                        <div class=\"form-group\">
                            <label>Description</label>
                            <textarea name=\"description\" rows=\"3\" placeholder=\"Task description\"></textarea>
                        </div>
                        <div class=\"form-group\">
                            <label>Project</label>
                            <select name=\"projectId\">
                                <option value=\"\">No Project</option>
                                ${projectOptions}
                            </select>
                        </div>
                        <div class=\"form-row\">
                            <div class=\"form-group\">
                                <label>Status</label>
                                <select name=\"status\">
                                    <option value=\"todo\" selected>To Do</option>
                                    <option value=\"in-progress\">In Progress</option>
                                    <option value=\"review\">Review</option>
                                    <option value=\"done\">Done</option>
                                </select>
                            </div>
                            <div class=\"form-group\">
                                <label>Priority</label>
                                <select name=\"priority\">
                                    <option value=\"low\">Low</option>
                                    <option value=\"medium\" selected>Medium</option>
                                    <option value=\"high\">High</option>
                                </select>
                            </div>
                        </div>
                        <div class=\"form-row\">
                            <div class=\"form-group\">
                                <label>Due Date</label>
                                <input type=\"date\" name=\"dueDate\" style=\"position: relative;\">
                                <style>
                                    input[type=\"date\"]::-webkit-calendar-picker-indicator {
                                        filter: invert(1);
                                        cursor: pointer;
                                    }
                                </style>
                            </div>
                            <div class=\"form-group\">
                                <label>Assignee</label>
                                <input type=\"text\" name=\"assignee\" placeholder=\"Assign to...\">
                            </div>
                        </div>
                        <div class=\"form-actions\">
                            <button type="button" class="button secondary" onclick="closeTaskModal()">Cancel</button>
                            <button type=\"submit\" class=\"button primary\">Add Task</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Save Task
window.saveTask = async function(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const taskData = {
        title: formData.get('title'),
        description: formData.get('description'),
        projectId: formData.get('projectId'),
        status: formData.get('status'),
        priority: formData.get('priority'),
        dueDate: formData.get('dueDate'),
        assignee: formData.get('assignee'),
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, 'tasks'), taskData);
        window.closeModal('taskModal');
        document.getElementById('taskModal').remove();
        await window.loadAllData();
        showNotification('Task created successfully!', 'success');
    } catch (error) {
        console.error('Error creating task:', error);
        showNotification('Error creating task. Please try again.', 'error');
    }
}

// Edit Task
window.editTask = function(taskId) {
    const task = window.crmState.tasks.find(t => t.id === taskId);
    if (!task) return;

    const projects = window.crmState.projects;
    const projectOptions = projects.map(p =>
        `<option value=\"${p.id}\" ${p.id === task.projectId ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    const modalHTML = `
        <div class=\"modal active\" id=\"taskModal\">
            <div class=\"modal-content\">
                <div class=\"modal-header\">
                    <h3>Edit Task</h3>
                        <button class="close-button" onclick="closeTaskModal()">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>
                <div class=\"modal-body\">
                    <form id=\"taskForm\" onsubmit=\"updateTask(event, '${taskId}')\">
                        <div class=\"form-group\">
                            <label>Task Title *</label>
                            <input type=\"text\" name=\"title\" required value=\"${task.title}\">
                        </div>
                        <div class=\"form-group\">
                            <label>Description</label>
                            <textarea name=\"description\" rows=\"3\">${task.description || ''}</textarea>
                        </div>
                        <div class=\"form-group\">
                            <label>Project</label>
                            <select name=\"projectId\">
                                <option value=\"\">No Project</option>
                                ${projectOptions}
                            </select>
                        </div>
                        <div class=\"form-row\">
                            <div class=\"form-group\">
                                <label>Status</label>
                                <select name=\"status\">
                                    <option value=\"todo\" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
                                    <option value=\"in-progress\" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                                    <option value=\"review\" ${task.status === 'review' ? 'selected' : ''}>Review</option>
                                    <option value=\"done\" ${task.status === 'done' ? 'selected' : ''}>Done</option>
                                </select>
                            </div>
                            <div class=\"form-group\">
                                <label>Priority</label>
                                <select name=\"priority\">
                                    <option value=\"low\" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                                    <option value=\"medium\" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                                    <option value=\"high\" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                                </select>
                            </div>
                        </div>
                        <div class=\"form-row\">
                            <div class=\"form-group\">
                                <label>Due Date</label>
                                <input type=\"date\" name=\"dueDate\" value=\"${task.dueDate || ''}\" style=\"position: relative;\">
                                <style>
                                    input[type=\"date\"]::-webkit-calendar-picker-indicator {
                                        filter: invert(1);
                                        cursor: pointer;
                                    }
                                </style>
                            </div>
                            <div class=\"form-group\">
                                <label>Assignee</label>
                                <input type=\"text\" name=\"assignee\" value=\"${task.assignee || ''}\">
                            </div>
                        </div>
                        <div class=\"form-actions\">
                            <button type="button" class="button secondary" onclick="closeTaskModal()">Cancel</button>
                            <button type=\"submit\" class=\"button primary\">Update Task</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Ensure closeModal exists and works for task modals
if (typeof window.closeModal !== 'function') {
    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    };
}

// Close task modal (add/edit modals)
window.closeTaskModal = function() {
    const modal = document.getElementById('taskModal');
    if (modal) {
        modal.remove();
    }
}
// Update Task
window.updateTask = async function(event, taskId) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const taskData = {
        title: formData.get('title'),
        description: formData.get('description'),
        projectId: formData.get('projectId'),
        status: formData.get('status'),
        priority: formData.get('priority'),
        dueDate: formData.get('dueDate'),
        assignee: formData.get('assignee'),
        updatedAt: serverTimestamp()
    };

    try {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, taskData);
        window.closeModal('taskModal');
        document.getElementById('taskModal').remove();
        await window.loadAllData();
        showNotification('Task updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating task:', error);
        showNotification('Error updating task. Please try again.', 'error');
    }
}

// Delete Task
window.deleteTask = async function(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        const taskRef = doc(db, 'tasks', taskId);
        await deleteDoc(taskRef);
        await window.loadAllData();
        showNotification('Task deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting task:', error);
        showNotification('Error deleting task. Please try again.', 'error');
    }
}

// View Task Detail - Comprehensive Modal
window.viewTaskDetail = function(taskId) {
    const task = window.crmState.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Get linked project
    const linkedProject = window.crmState.projects.find(p => p.id === task.projectId);
    
    // Get linked client (through project)
    const linkedClient = linkedProject ? window.crmState.clients.find(c => c.name === linkedProject.client) : null;

    const modalHTML = `
        <div class=\"modal active\" id=\"taskDetailModal\" style=\"z-index: 1001;\">
            <div class=\"modal-content\" style=\"max-width: 800px;\">
                <div class=\"modal-header\">
                    <div>
                        <h3>${task.title}</h3>
                        <p style=\"color: var(--text-secondary); font-size: 14px; margin-top: 4px;\">
                            ${linkedProject ? `Project: ${linkedProject.name}` : 'No project assigned'}
                        </p>
                    </div>
                    <button class=\"close-button\" onclick=\"closeTaskDetailModal()\">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>

                <!-- Tabs -->
                <div class=\"detail-tabs\">
                    <button class=\"detail-tab active\" onclick=\"switchTaskTab(event, 'overview')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M9 11l3 3L22 4\"/>
                            <path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>
                        </svg>
                        Task Details
                    </button>
                    <button class=\"detail-tab\" onclick=\"switchTaskTab(event, 'project')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>
                        </svg>
                        Project Info
                    </button>
                    <button class=\"detail-tab\" onclick=\"switchTaskTab(event, 'client')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"/>
                            <circle cx=\"12\" cy=\"7\" r=\"4\"/>
                        </svg>
                        Client Info
                    </button>
                </div>

                <!-- Tab Contents -->
                <div class=\"modal-body\" style=\"max-height: 600px; overflow-y: auto;\">
                    <!-- Overview Tab -->
                    <div class=\"detail-tab-content active\" id=\"overview-tab\">
                        <div class=\"section-title\">
                            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                <path d=\"M9 11l3 3L22 4\"/>
                                <path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>
                            </svg>
                            Task Information
                        </div>
                        <div class=\"info-grid\">
                            <div class=\"info-item\">
                                <span class=\"info-label\">Task Title</span>
                                <span class=\"info-value\">${task.title}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Status</span>
                                <span class=\"badge ${getTaskStatusBadge(task.status)}\">${task.status || 'To Do'}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Priority</span>
                                <span class=\"badge ${getTaskPriorityBadge(task.priority)}\">${task.priority || 'Medium'}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Due Date</span>
                                <span class=\"info-value\">${task.dueDate || 'Not set'}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Assignee</span>
                                <span class=\"info-value\">${task.assignee || 'Unassigned'}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Project</span>
                                <span class=\"info-value\">${linkedProject ? linkedProject.name : 'No project'}</span>
                            </div>
                        </div>
                        ${task.description ? `
                            <div style=\"margin-top: 24px;\">
                                <div class=\"section-title\">
                                    <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                        <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/>
                                        <polyline points=\"14 2 14 8 20 8\"/>
                                        <line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/>
                                        <line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>
                                    </svg>
                                    Description
                                </div>
                                <div style=\"background: var(--bg-darker); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);\">
                                    <p style=\"color: var(--text-primary); line-height: 1.6; white-space: pre-wrap;\">${task.description}</p>
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Project Info Tab -->
                    <div class=\"detail-tab-content\" id=\"project-tab\">
                        <div class=\"section-title\">
                            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                <path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>
                            </svg>
                            Project Information
                        </div>
                        ${linkedProject ? `
                            <div class=\"project-card\">
                                <h4 style=\"font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px;\">${linkedProject.name}</h4>
                                <div class=\"info-grid\">
                                    <div class=\"info-item\">
                                        <span class=\"info-label\">Client</span>
                                        <span class=\"info-value\">${linkedProject.client || 'Not assigned'}</span>
                                    </div>
                                    <div class=\"info-item\">
                                        <span class=\"info-label\">Status</span>
                                        <span class=\"badge ${linkedProject.status === 'active' ? 'success' : linkedProject.status === 'completed' ? 'info' : 'warning'}\">${linkedProject.status || 'Active'}</span>
                                    </div>
                                    <div class=\"info-item\">
                                        <span class=\"info-label\">Due Date</span>
                                        <span class=\"info-value\">${linkedProject.dueDate || 'Not set'}</span>
                                    </div>
                                </div>
                                ${linkedProject.description ? `
                                    <div style=\"margin-top: 16px;\">
                                        <span class=\"info-label\">Description</span>
                                        <p style=\"color: var(--text-primary); margin-top: 6px; line-height: 1.6;\">${linkedProject.description}</p>
                                    </div>
                                ` : ''}
                            </div>
                        ` : `
                            <div class=\"empty-section\">
                                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                    <path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>
                                </svg>
                                <p>No project assigned to this task.</p>
                            </div>
                        `}
                    </div>

                    <!-- Client Info Tab -->
                    <div class=\"detail-tab-content\" id=\"client-tab\">
                        <div class=\"section-title\">
                            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                <path d=\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"/>
                                <circle cx=\"12\" cy=\"7\" r=\"4\"/>
                            </svg>
                            Client Information
                        </div>
                        ${linkedClient ? `
                            <div class=\"client-card\">
                                <h4 style=\"font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px;\">${linkedClient.name}</h4>
                                <div class=\"info-grid\">
                                    <div class=\"info-item\">
                                        <span class=\"info-label\">Email</span>
                                        <span class=\"info-value\">${linkedClient.email}</span>
                                    </div>
                                    <div class=\"info-item\">
                                        <span class=\"info-label\">Phone</span>
                                        <span class=\"info-value\">${linkedClient.phone || 'Not provided'}</span>
                                    </div>
                                    <div class=\"info-item\">
                                        <span class=\"info-label\">Company</span>
                                        <span class=\"info-value\">${linkedClient.company || 'Not provided'}</span>
                                    </div>
                                    <div class=\"info-item\">
                                        <span class=\"info-label\">Status</span>
                                        <span class=\"badge ${linkedClient.status === 'Lead' ? 'warning' : linkedClient.status === 'Active' ? 'success' : 'danger'}\">${linkedClient.status || 'Active'}</span>
                                    </div>
                                </div>
                                ${linkedClient.address ? `
                                    <div style=\"margin-top: 16px;\">
                                        <span class=\"info-label\">Address</span>
                                        <p style=\"color: var(--text-primary); margin-top: 6px;\">${linkedClient.address}</p>
                                    </div>
                                ` : ''}
                            </div>
                        ` : `
                            <div class=\"empty-section\">
                                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                    <path d=\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"/>
                                    <circle cx=\"12\" cy=\"7\" r=\"4\"/>
                                </svg>
                                <p>${linkedProject ? 'No client assigned to this project.' : 'Task has no project, so no client information available.'}</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Switch tabs in task detail modal
window.switchTaskTab = function(event, tabName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.detail-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.detail-tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked tab and corresponding content
    event.currentTarget.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
}

// Close task detail modal
window.closeTaskDetailModal = function() {
    const modal = document.getElementById('taskDetailModal');
    if (modal) {
        modal.remove();
    }
}

