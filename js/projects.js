import { db, collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from './firebase-config.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { showNotification, debounce } from './utils.js';

// Get storage instance
const storage = getStorage();

// Project state
let projectFilters = {
    search: '',
    status: 'all',
    sortBy: 'newest'
};

let currentPage = 1;
const itemsPerPage = 10;

// Load Projects Page
window.loadProjectsPage = function() {
    const content = document.getElementById('pageContent');
    const { projects } = window.crmState;

    if (projects.length === 0) {
        content.innerHTML = `
            <div class=\"card\">
                <div class=\"empty-state\">
                    <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                        <path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>
                    </svg>
                    <h4>No projects yet</h4>
                    <p>Create your first project to get started.</p>
                    <button class=\"primary-button\" style=\"margin-top: 16px;\" onclick=\"openAddProjectModal()\">New Project</button>
                </div>
            </div>
        `;
        return;
    }

    renderProjectsPage();
}

function renderProjectsPage() {
    const content = document.getElementById('pageContent');
    let filteredProjects = filterAndSortProjects();

    // Pagination
    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

    content.innerHTML = `
        <div class=\"card\">
            <div class=\"card-header\">
                <h3>All Projects (${filteredProjects.length})</h3>
                <div style=\"display: flex; gap: 12px;\">
                    <button class=\"button secondary\" onclick=\"exportProjects()\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 8px;\">
                            <path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/>
                            <polyline points=\"17 8 12 3 7 8\"/>
                            <line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"15\"/>
                        </svg>
                        Export CSV
                    </button>
                    <button class=\"primary-button\" onclick=\"openAddProjectModal()\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/>
                            <line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>
                        </svg>
                        New Project
                    </button>
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
                        <input type=\"text\" id=\"projectSearch\" placeholder=\"Search by project name, client, or description...\" value=\"${projectFilters.search}\" onkeyup=\"handleProjectSearch(event)\">
                    </div>
                </div>

                <!-- Modern Filter Pills -->
                <div style=\"display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;\">
                    <div class=\"filter-pills\">
                        <span style=\"font-size: 13px; color: var(--text-secondary); margin-right: 12px; font-weight: 500;\">Status:</span>
                        <button class=\"filter-pill ${projectFilters.status === 'all' ? 'active' : ''}\" onclick=\"handleProjectStatusFilter({target: {value: 'all'}})\">
                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                <circle cx=\"12\" cy=\"12\" r=\"10\"/>
                            </svg>
                            All
                        </button>
                        <button class=\"filter-pill ${projectFilters.status === 'active' ? 'active' : ''}\" onclick=\"handleProjectStatusFilter({target: {value: 'active'}})\">
                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                <circle cx=\"12\" cy=\"12\" r=\"10\"/>
                                <path d=\"m9 12 2 2 4-4\"/>
                            </svg>
                            Active
                        </button>
                        <button class=\"filter-pill ${projectFilters.status === 'completed' ? 'active' : ''}\" onclick=\"handleProjectStatusFilter({target: {value: 'completed'}})\">
                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                <path d=\"M22 11.08V12a10 10 0 1 1-5.93-9.14\"/>
                                <polyline points=\"22 4 12 14.01 9 11.01\"/>
                            </svg>
                            Completed
                        </button>
                        <button class=\"filter-pill ${projectFilters.status === 'on-hold' ? 'active' : ''}\" onclick=\"handleProjectStatusFilter({target: {value: 'on-hold'}})\">
                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                <circle cx=\"12\" cy=\"12\" r=\"10\"/>
                                <line x1=\"10\" y1=\"15\" x2=\"10\" y2=\"9\"/>
                                <line x1=\"14\" y1=\"15\" x2=\"14\" y2=\"9\"/>
                            </svg>
                            On Hold
                        </button>
                    </div>

                    <!-- Modern Sort Dropdown -->
                    <div class=\"modern-sort-container\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 8px; color: var(--text-secondary);\">
                            <line x1=\"4\" y1=\"6\" x2=\"20\" y2=\"6\"/>
                            <line x1=\"8\" y1=\"12\" x2=\"20\" y2=\"12\"/>
                            <line x1=\"12\" y1=\"18\" x2=\"20\" y2=\"18\"/>
                        </svg>
                        <select id=\"projectSortFilter\" class=\"modern-select\" onchange=\"handleProjectSortFilter(event)\">
                            <option value=\"newest\" ${projectFilters.sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
                            <option value=\"oldest\" ${projectFilters.sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
                            <option value=\"a-z\" ${projectFilters.sortBy === 'a-z' ? 'selected' : ''}>Name (A-Z)</option>
                            <option value=\"z-a\" ${projectFilters.sortBy === 'z-a' ? 'selected' : ''}>Name (Z-A)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class=\"table-container\">
                <table>
                    <thead>
                        <tr>
                            <th>Project Name</th>
                            <th>Client</th>
                            <th>Status</th>
                            <th>Due Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedProjects.map(project => `
                            <tr>
                                <td>
                                    <strong style=\"cursor: pointer; color: var(--primary-purple);\" onclick=\"viewProjectDetail('${project.id}')\">${project.name}</strong>
                                </td>
                                <td>${project.client || '-'}</td>
                                <td><span class=\"badge ${getProjectStatusBadge(project.status)}\">${project.status || 'Active'}</span></td>
                                <td>${project.dueDate || '-'}</td>
                                <td>
                                    <div class=\"action-buttons\">
                                        <button class=\"btn-icon\" onclick=\"viewProjectDetail('${project.id}')\" title=\"View Details\">
                                            <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                <path d=\"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\"/>
                                                <circle cx=\"12\" cy=\"12\" r=\"3\"/>
                                            </svg>
                                        </button>
                                        <button class=\"btn-icon\" onclick=\"editProject('${project.id}')\" title=\"Edit\">
                                            <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                <path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/>
                                                <path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/>
                                            </svg>
                                        </button>
                                        <button class=\"btn-icon\" onclick=\"deleteProject('${project.id}')\" title=\"Delete\">
                                            <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                <polyline points=\"3 6 5 6 21 6\"/>
                                                <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            ${totalPages > 1 ? `
                <div class=\"pagination\">
                    <button onclick=\"changeProjectPage(${currentPage - 1})\" ${currentPage === 1 ? 'disabled' : ''}>
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <polyline points=\"15 18 9 12 15 6\"/>
                        </svg>
                    </button>
                    ${Array.from({length: totalPages}, (_, i) => i + 1).map(page => `
                        <button class=\"${page === currentPage ? 'active' : ''}\" onclick=\"changeProjectPage(${page})\">${page}</button>
                    `).join('')}
                    <button onclick=\"changeProjectPage(${currentPage + 1})\" ${currentPage === totalPages ? 'disabled' : ''}>
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

            /* Project Detail Modal Tabs */
            .detail-tabs {
                display: flex;
                gap: 8px;
                padding: 16px 24px 0;
                border-bottom: 1px solid var(--border-color);
                overflow-x: auto;
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
                white-space: nowrap;
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

            .task-card, .invoice-card, .client-card {
                background: var(--bg-darker);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                padding: 16px;
                margin-bottom: 12px;
                transition: all 0.2s ease;
            }

            .task-card:hover, .invoice-card:hover, .client-card:hover {
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

            .stats-row {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                margin-bottom: 24px;
            }

            .stat-box {
                background: var(--bg-darker);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                padding: 16px;
                text-align: center;
            }

            .stat-box .stat-number {
                font-size: 24px;
                font-weight: 700;
                color: var(--primary-purple);
                margin-bottom: 4px;
            }

            .stat-box .stat-label {
                font-size: 12px;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            /* Attachments Styles */
            .attachments-container {
                padding: 0;
            }

            .attachments-upload-area {
                border: 2px dashed var(--border-color);
                border-radius: 12px;
                padding: 40px 20px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-bottom: 24px;
                background: var(--bg-darker);
            }

            .attachments-upload-area:hover, .attachments-upload-area.drag-over {
                border-color: var(--primary-purple);
                background: var(--bg-hover);
            }

            .attachments-upload-area svg {
                width: 48px;
                height: 48px;
                margin-bottom: 16px;
                color: var(--text-secondary);
            }

            .attachments-upload-area p {
                color: var(--text-primary);
                margin-bottom: 8px;
            }

            .upload-hint {
                font-size: 12px;
                color: var(--text-muted) !important;
            }

            .attachments-list {
                display: grid;
                gap: 12px;
            }

            .attachment-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: var(--bg-darker);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                transition: all 0.2s ease;
            }

            .attachment-item:hover {
                border-color: var(--primary-purple);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(152, 62, 151, 0.2);
            }

            .attachment-icon {
                flex-shrink: 0;
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--primary-purple);
                border-radius: 8px;
                color: white;
            }

            .attachment-info {
                flex: 1;
                min-width: 0;
            }

            .attachment-name {
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .attachment-meta {
                font-size: 12px;
                color: var(--text-secondary);
                display: flex;
                gap: 8px;
            }

            .attachment-actions {
                display: flex;
                gap: 8px;
            }

            .attachment-btn {
                padding: 8px;
                background: var(--bg-hover);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                color: var(--text-primary);
            }

            .attachment-btn:hover {
                background: var(--primary-purple);
                border-color: var(--primary-purple);
                color: white;
            }

            .attachment-btn.delete:hover {
                background: #ff4444;
                border-color: #ff4444;
            }

            .empty-attachments {
                text-align: center;
                padding: 60px 20px;
                color: var(--text-secondary);
            }

            .empty-attachments svg {
                width: 64px;
                height: 64px;
                margin-bottom: 16px;
                opacity: 0.3;
            }

            .uploading-indicator {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px;
                background: var(--bg-darker);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                margin-bottom: 24px;
            }

            .uploading-spinner {
                width: 20px;
                height: 20px;
                border: 3px solid var(--border-color);
                border-top-color: var(--primary-purple);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            /* Notes Styles */
            .notes-container {
                padding: 0;
            }

            .notes-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
            }

            .add-note-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 20px;
                background: var(--primary-purple);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .add-note-btn:hover {
                background: var(--primary-purple-dark);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(152, 62, 151, 0.3);
            }

            .notes-list {
                display: grid;
                gap: 16px;
            }

            .note-item {
                background: var(--bg-darker);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                padding: 20px;
                transition: all 0.2s ease;
            }

            .note-item:hover {
                border-color: var(--primary-purple);
                box-shadow: 0 4px 12px rgba(152, 62, 151, 0.2);
            }

            .note-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--border-color);
            }

            .note-timestamp {
                font-size: 12px;
                color: var(--text-muted);
            }

            .note-actions {
                display: flex;
                gap: 8px;
            }

            .btn-icon-small {
                padding: 6px;
                background: transparent;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                color: var(--text-secondary);
            }

            .btn-icon-small:hover {
                background: var(--bg-hover);
                border-color: var(--primary-purple);
                color: var(--primary-purple);
            }

            .note-content {
                color: var(--text-primary);
                line-height: 1.6;
            }

            .note-content p {
                margin-bottom: 12px;
            }

            .note-content h1, .note-content h2, .note-content h3 {
                margin-bottom: 12px;
                font-weight: 600;
            }

            .note-content ul, .note-content ol {
                margin-left: 24px;
                margin-bottom: 12px;
            }

            .note-content code {
                background: var(--bg-hover);
                padding: 2px 6px;
                border-radius: 4px;
                font-family: monospace;
            }

            .note-content blockquote {
                border-left: 4px solid var(--primary-purple);
                padding-left: 16px;
                margin: 16px 0;
                color: var(--text-secondary);
            }

            .empty-notes {
                text-align: center;
                padding: 60px 20px;
                color: var(--text-secondary);
            }

            .empty-notes svg {
                width: 64px;
                height: 64px;
                margin-bottom: 16px;
                opacity: 0.3;
            }

            .note-editor-container {
                background: var(--bg-darker);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 24px;
            }

            .note-editor-container .ql-container {
                border: none;
                font-family: inherit;
                font-size: 14px;
            }

            .note-editor-container .ql-editor {
                min-height: 200px;
                background: var(--bg-card);
                border-radius: 8px;
                color: var(--text-primary);
            }

            .note-editor-container .ql-toolbar {
                background: var(--bg-card);
                border: none;
                border-bottom: 1px solid var(--border-color);
                border-radius: 8px 8px 0 0;
            }

            .note-editor-actions {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                margin-top: 16px;
            }

            /* Quill theme adjustments */
            .ql-snow .ql-stroke {
                stroke: var(--text-primary);
            }

            .ql-snow .ql-fill {
                fill: var(--text-primary);
            }

            .ql-snow .ql-picker-label {
                color: var(--text-primary);
            }

            .ql-snow .ql-picker-options {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
            }

            .ql-snow .ql-picker-item:hover {
                color: var(--primary-purple);
            }
        </style>
    `;
}

function filterAndSortProjects() {
    let projects = [...window.crmState.projects];

    // Search filter
    if (projectFilters.search) {
        const searchLower = projectFilters.search.toLowerCase();
        projects = projects.filter(project =>
            project.name.toLowerCase().includes(searchLower) ||
            (project.client && project.client.toLowerCase().includes(searchLower)) ||
            (project.description && project.description.toLowerCase().includes(searchLower))
        );
    }

    // Status filter
    if (projectFilters.status !== 'all') {
        projects = projects.filter(project => project.status === projectFilters.status);
    }

    // Sort
    switch(projectFilters.sortBy) {
        case 'newest':
            projects.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
            break;
        case 'oldest':
            projects.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateA - dateB;
            });
            break;
        case 'a-z':
            projects.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'z-a':
            projects.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }

    return projects;
}

function getProjectStatusBadge(status) {
    switch(status) {
        case 'active': return 'success';
        case 'completed': return 'info';
        case 'on-hold': return 'warning';
        default: return 'success';
    }
}

// Handlers
window.handleProjectSearch = debounce(function(event) {
    projectFilters.search = event.target.value;
    currentPage = 1;
    renderProjectsPage();
}, 300);

window.handleProjectStatusFilter = function(event) {
    projectFilters.status = event.target.value;
    currentPage = 1;
    renderProjectsPage();
}

window.handleProjectSortFilter = function(event) {
    projectFilters.sortBy = event.target.value;
    currentPage = 1;
    renderProjectsPage();
}

window.changeProjectPage = function(page) {
    currentPage = page;
    renderProjectsPage();
}

// Export Projects
window.exportProjects = function() {
    const projects = window.crmState.projects.map(project => ({
        name: project.name,
        client: project.client || '',
        status: project.status || '',
        dueDate: project.dueDate || '',
        description: project.description || ''
    }));

    // Simple CSV export
    const headers = Object.keys(projects[0]).join(',');
    const rows = projects.map(p => Object.values(p).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'projects.csv';
    a.click();
}

// Open Add Project Modal
window.openAddProjectModal = function() {
    if (typeof window.closeModal === 'function') {
        window.closeModal('quickAddModal');
    }

    const clients = window.crmState.clients;
    const clientOptions = clients.map(c => `<option value=\"${c.name}\">${c.name}</option>`).join('');

    const modalHTML = `
        <div class=\"modal active\" id=\"projectModal\">
            <div class=\"modal-content\">
                <div class=\"modal-header\">
                    <h3>New Project</h3>
                    <button class=\"close-button\" onclick=\"closeModal('projectModal')\">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>
                <div class=\"modal-body\">
                    <form id=\"projectForm\" onsubmit=\"saveProject(event)\">
                        <div class=\"form-group\">
                            <label>Project Name *</label>
                            <input type=\"text\" name=\"name\" required placeholder=\"Enter project name\">
                        </div>
                        <div class=\"form-group\">
                            <label>Client</label>
                            <select name=\"client\">
                                <option value=\"\">Select a client</option>
                                ${clientOptions}
                            </select>
                        </div>
                        <div class=\"form-group\">
                            <label>Status</label>
                            <select name=\"status\">
                                <option value=\"active\" selected>Active</option>
                                <option value=\"completed\">Completed</option>
                                <option value=\"on-hold\">On Hold</option>
                            </select>
                        </div>
                        <div class=\"form-group\">
                            <label>Due Date</label>
                            <input type=\"date\" name=\"dueDate\">
                        </div>
                        <div class=\"form-group\">
                            <label>Description</label>
                            <textarea name=\"description\" rows=\"4\" placeholder=\"Project details\"></textarea>
                        </div>
                        <div class=\"form-actions\">
                            <button type=\"button\" class=\"button secondary\" onclick=\"closeModal('projectModal')\">Cancel</button>
                            <button type=\"submit\" class=\"button primary\">Create Project</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Save Project
window.saveProject = async function(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const projectData = {
        name: formData.get('name'),
        client: formData.get('client'),
        status: formData.get('status'),
        dueDate: formData.get('dueDate'),
        description: formData.get('description'),
        attachments: [],
        notes: [],
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, 'projects'), projectData);
        window.closeModal('projectModal');
        document.getElementById('projectModal').remove();
        await window.loadAllData();
        showNotification('Project created successfully!', 'success');
    } catch (error) {
        console.error('Error creating project:', error);
        showNotification('Error creating project. Please try again.', 'error');
    }
}

// Edit Project
window.editProject = function(projectId) {
    const project = window.crmState.projects.find(p => p.id === projectId);
    if (!project) return;

    const clients = window.crmState.clients;
    const clientOptions = clients.map(c =>
        `<option value=\"${c.name}\" ${c.name === project.client ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const modalHTML = `
        <div class=\"modal active\" id=\"projectModal\">
            <div class=\"modal-content\">
                <div class=\"modal-header\">
                    <h3>Edit Project</h3>
                    <button class=\"close-button\" onclick=\"closeModal('projectModal')\">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>
                <div class=\"modal-body\">
                    <form id=\"projectForm\" onsubmit=\"updateProject(event, '${projectId}')\">
                        <div class=\"form-group\">
                            <label>Project Name *</label>
                            <input type=\"text\" name=\"name\" required value=\"${project.name}\">
                        </div>
                        <div class=\"form-group\">
                            <label>Client</label>
                            <select name=\"client\">
                                <option value=\"\">Select a client</option>
                                ${clientOptions}
                            </select>
                        </div>
                        <div class=\"form-group\">
                            <label>Status</label>
                            <select name=\"status\">
                                <option value=\"active\" ${project.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value=\"completed\" ${project.status === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value=\"on-hold\" ${project.status === 'on-hold' ? 'selected' : ''}>On Hold</option>
                            </select>
                        </div>
                        <div class=\"form-group\">
                            <label>Due Date</label>
                            <input type=\"date\" name=\"dueDate\" value=\"${project.dueDate || ''}\">
                        </div>
                        <div class=\"form-group\">
                            <label>Description</label>
                            <textarea name=\"description\" rows=\"4\">${project.description || ''}</textarea>
                        </div>
                        <div class=\"form-actions\">
                            <button type=\"button\" class=\"button secondary\" onclick=\"closeModal('projectModal')\">Cancel</button>
                            <button type=\"submit\" class=\"button primary\">Update Project</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Update Project
window.updateProject = async function(event, projectId) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const projectData = {
        name: formData.get('name'),
        client: formData.get('client'),
        status: formData.get('status'),
        dueDate: formData.get('dueDate'),
        description: formData.get('description'),
        updatedAt: serverTimestamp()
    };

    try {
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, projectData);
        window.closeModal('projectModal');
        document.getElementById('projectModal').remove();
        await window.loadAllData();
        showNotification('Project updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating project:', error);
        showNotification('Error updating project. Please try again.', 'error');
    }
}

// Delete Project
window.deleteProject = async function(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
        const projectRef = doc(db, 'projects', projectId);
        await deleteDoc(projectRef);
        await window.loadAllData();
        showNotification('Project deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting project:', error);
        showNotification('Error deleting project. Please try again.', 'error');
    }
}

// View Project Detail - Comprehensive Modal with Attachments and Notes
window.viewProjectDetail = function(projectId) {
    const project = window.crmState.projects.find(p => p.id === projectId);
    if (!project) return;

    // Get linked client
    const linkedClient = window.crmState.clients.find(c => c.name === project.client);

    // Get linked tasks (tasks with this projectId)
    const linkedTasks = window.crmState.tasks.filter(task => task.projectId === projectId);

    // Get linked invoices (invoices with this projectId or project name)
    const linkedInvoices = window.crmState.invoices.filter(invoice =>
        invoice.projectId === projectId || invoice.project === project.name
    );

    // Get attachments and notes
    const attachments = project.attachments || [];
    const notes = project.notes || [];

    // Calculate project stats
    const totalTasks = linkedTasks.length;
    const completedTasks = linkedTasks.filter(t => t.status === 'done').length;
    const totalInvoices = linkedInvoices.reduce((sum, inv) => sum + (inv.total || inv.amount || 0), 0);

    const modalHTML = `
        <div class=\"modal active\" id=\"projectDetailModal\" style=\"z-index: 1001;\">
            <div class=\"modal-content\" style=\"max-width: 900px;\">
                <div class=\"modal-header\">
                    <div>
                        <h3>${project.name}</h3>
                        <p style=\"color: var(--text-secondary); font-size: 14px; margin-top: 4px;\">
                            ${project.client ? `Client: ${project.client}` : 'No client assigned'}
                        </p>
                    </div>
                    <button class=\"close-button\" onclick=\"closeProjectDetailModal()\">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>

                <!-- Tabs with Attachments and Notes -->
                <div class=\"detail-tabs\">
                    <button class=\"detail-tab active\" onclick=\"switchProjectTab(event, 'overview')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>
                        </svg>
                        Overview
                    </button>
                    <button class=\"detail-tab\" onclick=\"switchProjectTab(event, 'client')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"/>
                            <circle cx=\"12\" cy=\"7\" r=\"4\"/>
                        </svg>
                        Client Info
                    </button>
                    <button class=\"detail-tab\" onclick=\"switchProjectTab(event, 'tasks')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M9 11l3 3L22 4\"/>
                            <path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>
                        </svg>
                        Tasks (${linkedTasks.length})
                    </button>
                    <button class=\"detail-tab\" onclick=\"switchProjectTab(event, 'invoices')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/>
                            <polyline points=\"14 2 14 8 20 8\"/>
                            <line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/>
                            <line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>
                        </svg>
                        Invoices (${linkedInvoices.length})
                    </button>
                    <button class=\"detail-tab\" onclick=\"switchProjectTab(event, 'attachments')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48\"/>
                        </svg>
                        Attachments (${attachments.length})
                    </button>
                    <button class=\"detail-tab\" onclick=\"switchProjectTab(event, 'notes')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/>
                            <polyline points=\"14 2 14 8 20 8\"/>
                            <line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/>
                            <line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>
                            <line x1=\"10\" y1=\"9\" x2=\"8\" y2=\"9\"/>
                        </svg>
                        Notes (${notes.length})
                    </button>
                </div>

                <!-- Tab Contents -->
                <div class=\"modal-body\" style=\"max-height: 600px; overflow-y: auto;\">
                    <!-- Overview Tab -->
                    <div class=\"detail-tab-content active\" id=\"overview-tab\">
                        <!-- Project Stats -->
                        <div class=\"stats-row\">
                            <div class=\"stat-box\">
                                <div class=\"stat-number\">${totalTasks}</div>
                                <div class=\"stat-label\">Total Tasks</div>
                            </div>
                            <div class=\"stat-box\">
                                <div class=\"stat-number\">${completedTasks}</div>
                                <div class=\"stat-label\">Completed</div>
                            </div>
                            <div class=\"stat-box\">
                                <div class=\"stat-number\">$${(parseFloat(totalInvoices) || 0).toFixed(2)}</div>
                                <div class=\"stat-label\">Total Value</div>
                            </div>
                        </div>

                        <div class=\"section-title\">
                            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                <path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>
                            </svg>
                            Project Information
                        </div>
                        <div class=\"info-grid\">
                            <div class=\"info-item\">
                                <span class=\"info-label\">Project Name</span>
                                <span class=\"info-value\">${project.name}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Client</span>
                                <span class=\"info-value\">${project.client || 'Not assigned'}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Status</span>
                                <span class=\"badge ${getProjectStatusBadge(project.status)}\">${project.status || 'Active'}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Due Date</span>
                                <span class=\"info-value\">${project.dueDate || 'Not set'}</span>
                            </div>
                        </div>
                        ${project.description ? `
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
                                    <p style=\"color: var(--text-primary); line-height: 1.6; white-space: pre-wrap;\">${project.description}</p>
                                </div>
                            </div>
                        ` : ''}
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
                                <p>No client assigned to this project.</p>
                            </div>
                        `}
                    </div>

                    <!-- Tasks Tab -->
                    <div class=\"detail-tab-content\" id=\"tasks-tab\">
                        <div class=\"section-title\">
                            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                <path d=\"M9 11l3 3L22 4\"/>
                                <path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>
                            </svg>
                            Project Tasks
                        </div>
                        ${linkedTasks.length > 0 ? linkedTasks.map(task => `
                            <div class=\"task-card\">
                                <div style=\"display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;\">
                                    <h4 style=\"font-size: 15px; font-weight: 600; color: var(--text-primary);\">${task.title}</h4>
                                    <span class=\"badge ${task.status === 'done' ? 'success' : task.status === 'in-progress' ? 'warning' : 'secondary'}\">${task.status || 'To Do'}</span>
                                </div>
                                ${task.description ? `<p style=\"font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;\">${task.description}</p>` : ''}
                                <div style=\"display: flex; gap: 16px; font-size: 12px; color: var(--text-muted); flex-wrap: wrap;\">
                                    ${task.priority ? `<span class=\"badge ${task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'info'}\">${task.priority}</span>` : ''}
                                    ${task.dueDate ? `
                                        <div style=\"display: flex; align-items: center; gap: 6px;\">
                                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                <rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>
                                                <line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/>
                                                <line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/>
                                                <line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/>
                                            </svg>
                                            Due: ${task.dueDate}
                                        </div>
                                    ` : ''}
                                    ${task.assignee ? `
                                        <div style=\"display: flex; align-items: center; gap: 6px;\">
                                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                <path d=\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"/>
                                                <circle cx=\"12\" cy=\"7\" r=\"4\"/>
                                            </svg>
                                            ${task.assignee}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('') : `
                            <div class=\"empty-section\">
                                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                    <path d=\"M9 11l3 3L22 4\"/>
                                    <path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>
                                </svg>
                                <p>No tasks linked to this project yet.</p>
                            </div>
                        `}
                    </div>

                    <!-- Invoices Tab -->
                    <div class=\"detail-tab-content\" id=\"invoices-tab\">
                        <div class=\"section-title\">
                            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/>
                                <polyline points=\"14 2 14 8 20 8\"/>
                                <line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/>
                                <line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>
                            </svg>
                            Project Invoices
                        </div>
                        ${linkedInvoices.length > 0 ? linkedInvoices.map(invoice => `
                            <div class=\"invoice-card\">
                                <div style=\"display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;\">
                                    <div>
                                        <h4 style=\"font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;\">
                                            ${invoice.invoiceNumber || 'Invoice'}
                                        </h4>
                                        <p style=\"font-size: 13px; color: var(--text-secondary);\">
                                            ${invoice.clientName || invoice.client || 'No client'}
                                        </p>
                                    </div>
                                    <div style=\"text-align: right;\">
                                        <div style=\"font-size: 20px; font-weight: 700; color: var(--primary-purple); margin-bottom: 4px;\">
                                            $${(parseFloat(invoice.total) || parseFloat(invoice.amount) || 0).toFixed(2)}
                                        </div>
                                        <span class=\"badge ${invoice.status === 'paid' ? 'success' : invoice.status === 'sent' ? 'warning' : 'danger'}\">
                                            ${invoice.status || 'Unpaid'}
                                        </span>
                                    </div>
                                </div>
                                <div style=\"display: flex; gap: 20px; font-size: 13px; color: var(--text-secondary);\">
                                    ${invoice.date ? `
                                        <div style=\"display: flex; align-items: center; gap: 6px;\">
                                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                <rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>
                                                <line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/>
                                                <line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/>
                                                <line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/>
                                            </svg>
                                            ${invoice.date}
                                        </div>
                                    ` : ''}
                                    ${invoice.dueDate ? `
                                        <div style=\"display: flex; align-items: center; gap: 6px;\">
                                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                <circle cx=\"12\" cy=\"12\" r=\"10\"/>
                                                <polyline points=\"12 6 12 12 16 14\"/>
                                            </svg>
                                            Due: ${invoice.dueDate}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('') : `
                            <div class=\"empty-section\">
                                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                    <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/>
                                    <polyline points=\"14 2 14 8 20 8\"/>
                                    <line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/>
                                    <line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>
                                </svg>
                                <p>No invoices linked to this project yet.</p>
                            </div>
                        `}
                    </div>

                    <!-- Attachments Tab -->
                    <div class=\"detail-tab-content\" id=\"attachments-tab\">
                        <!-- Content will be rendered by renderProjectAttachments() -->
                    </div>

                    <!-- Notes Tab -->
                    <div class=\"detail-tab-content\" id=\"notes-tab\">
                        <!-- Content will be rendered by renderProjectNotes() -->
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Render attachments and notes after modal is inserted
    renderProjectAttachments(projectId);
    renderProjectNotes(projectId);
}

// Switch tabs in project detail modal
window.switchProjectTab = function(event, tabName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.detail-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.detail-tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to clicked tab and corresponding content
    event.currentTarget.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
}

// Close project detail modal
window.closeProjectDetailModal = function() {
    const modal = document.getElementById('projectDetailModal');
    if (modal) {
        modal.remove();
    }
}

// ========================================
// ATTACHMENTS FUNCTIONS
// ========================================

// Upload file to Firebase Storage
window.uploadProjectAttachment = async function(projectId, file) {
    if (!file) return;

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
        showNotification('File size must be less than 10MB', 'error');
        return;
    }

    try {
        // Show uploading indicator
        showUploadingIndicator(file.name);

        // Create a storage reference
        const storageRef = ref(storage, `project-attachments/${projectId}/${Date.now()}_${file.name}`);

        // Upload file
        const snapshot = await uploadBytes(storageRef, file);

        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Create attachment data
        const attachmentData = {
            id: Date.now().toString(),
            fileName: file.name,
            fileUrl: downloadURL,
            fileSize: file.size,
            fileType: file.type || 'application/octet-stream',
            uploadedAt: new Date().toISOString(),
            storagePath: snapshot.ref.fullPath
        };

        // Get current project
        const project = window.crmState.projects.find(p => p.id === projectId);
        if (!project) throw new Error('Project not found');

        // Add attachment to project
        const attachments = project.attachments || [];
        attachments.push(attachmentData);

        // Update project in Firestore
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, {
            attachments: attachments,
            updatedAt: serverTimestamp()
        });

        // Reload data
        await window.loadAllData();

        // Refresh the project detail view
        hideUploadingIndicator();
        showNotification('File uploaded successfully!', 'success');

        // Re-render the attachments tab
        renderProjectAttachments(projectId);

    } catch (error) {
        console.error('Error uploading file:', error);
        hideUploadingIndicator();
        showNotification('Error uploading file. Please try again.', 'error');
    }
};

// Delete attachment
window.deleteProjectAttachment = async function(projectId, attachmentId, storagePath) {
    if (!confirm('Are you sure you want to delete this attachment?')) return;

    try {
        // Delete from Firebase Storage
        if (storagePath) {
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef);
        }

        // Get current project
        const project = window.crmState.projects.find(p => p.id === projectId);
        if (!project) throw new Error('Project not found');

        // Remove attachment from array
        const attachments = (project.attachments || []).filter(a => a.id !== attachmentId);

        // Update project in Firestore
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, {
            attachments: attachments,
            updatedAt: serverTimestamp()
        });

        // Reload data
        await window.loadAllData();

        showNotification('Attachment deleted successfully!', 'success');

        // Re-render the attachments tab
        renderProjectAttachments(projectId);

    } catch (error) {
        console.error('Error deleting attachment:', error);
        showNotification('Error deleting attachment. Please try again.', 'error');
    }
};

// Render attachments tab
function renderProjectAttachments(projectId) {
    const project = window.crmState.projects.find(p => p.id === projectId);
    if (!project) return;

    const attachments = project.attachments || [];
    const attachmentsTab = document.getElementById('attachments-tab');

    if (!attachmentsTab) return;

    attachmentsTab.innerHTML = `
        <div class=\"attachments-container\">
            <div class=\"attachments-upload-area\" onclick=\"document.getElementById('attachment-file-input-${projectId}').click()\" ondrop=\"handleAttachmentDrop(event, '${projectId}')\" ondragover=\"handleAttachmentDragOver(event)\" ondragleave=\"handleAttachmentDragLeave(event)\">
                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                    <path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/>
                    <polyline points=\"17 8 12 3 7 8\"/>
                    <line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"15\"/>
                </svg>
                <p><strong>Click to upload</strong> or drag and drop</p>
                <p class=\"upload-hint\">Max file size: 10MB</p>
                <input type=\"file\" id=\"attachment-file-input-${projectId}\" onchange=\"handleAttachmentUpload(event, '${projectId}')\" style=\"display: none;\">
            </div>

            <div id=\"uploading-indicator-${projectId}\" style=\"display: none;\"></div>

            ${attachments.length > 0 ? `
                <div class=\"attachments-list\">
                    ${attachments.map(attachment => `
                        <div class=\"attachment-item\">
                            <div class=\"attachment-icon\">
                                ${getFileIcon(attachment.fileType)}
                            </div>
                            <div class=\"attachment-info\">
                                <div class=\"attachment-name\">${attachment.fileName}</div>
                                <div class=\"attachment-meta\">
                                    <span>${formatFileSize(attachment.fileSize)}</span>
                                    <span>•</span>
                                    <span>${formatDate(attachment.uploadedAt)}</span>
                                </div>
                            </div>
                            <div class=\"attachment-actions\">
                                <button class=\"attachment-btn\" onclick=\"window.open('${attachment.fileUrl}', '_blank')\" title=\"Download\">
                                    <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                        <path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/>
                                        <polyline points=\"7 10 12 15 17 10\"/>
                                        <line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>
                                    </svg>
                                </button>
                                <button class=\"attachment-btn delete\" onclick=\"deleteProjectAttachment('${projectId}', '${attachment.id}', '${attachment.storagePath || ''}')\" title=\"Delete\">
                                    <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                        <polyline points=\"3 6 5 6 21 6\"/>
                                        <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class=\"empty-attachments\">
                    <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                        <path d=\"M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48\"/>
                    </svg>
                    <h4>No attachments yet</h4>
                    <p>Upload files to attach them to this project</p>
                </div>
            `}
        </div>
    `;
}

// Handle file input change
window.handleAttachmentUpload = function(event, projectId) {
    const file = event.target.files[0];
    if (file) {
        uploadProjectAttachment(projectId, file);
    }
    // Reset input
    event.target.value = '';
};

// Handle drag and drop
window.handleAttachmentDrop = function(event, projectId) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');

    const file = event.dataTransfer.files[0];
    if (file) {
        uploadProjectAttachment(projectId, file);
    }
};

window.handleAttachmentDragOver = function(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('drag-over');
};

window.handleAttachmentDragLeave = function(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
};

// Show/hide uploading indicator
function showUploadingIndicator(fileName) {
    const indicators = document.querySelectorAll('[id^=\"uploading-indicator-\"]');
    indicators.forEach(indicator => {
        indicator.style.display = 'block';
        indicator.innerHTML = `
            <div class=\"uploading-indicator\">
                <div class=\"uploading-spinner\"></div>
                <span>Uploading ${fileName}...</span>
            </div>
        `;
    });
}

function hideUploadingIndicator() {
    const indicators = document.querySelectorAll('[id^=\"uploading-indicator-\"]');
    indicators.forEach(indicator => {
        indicator.style.display = 'none';
        indicator.innerHTML = '';
    });
}

// Helper functions
function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) {
        return `<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
            <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>
            <circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"/>
            <polyline points=\"21 15 16 10 5 21\"/>
        </svg>`;
    } else if (fileType.includes('pdf')) {
        return `<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
            <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/>
            <polyline points=\"14 2 14 8 20 8\"/>
            <line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/>
            <line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>
            <line x1=\"10\" y1=\"9\" x2=\"8\" y2=\"9\"/>
        </svg>`;
    } else if (fileType.includes('word') || fileType.includes('document')) {
        return `<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
            <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/>
            <polyline points=\"14 2 14 8 20 8\"/>
            <line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/>
            <line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>
        </svg>`;
    } else if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
        return `<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
            <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/>
            <polyline points=\"14 2 14 8 20 8\"/>
            <rect x=\"8\" y=\"12\" width=\"8\" height=\"6\"/>
            <line x1=\"8\" y1=\"15\" x2=\"16\" y2=\"15\"/>
            <line x1=\"12\" y1=\"12\" x2=\"12\" y2=\"18\"/>
        </svg>`;
    } else {
        return `<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
            <path d=\"M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z\"/>
            <polyline points=\"13 2 13 9 20 9\"/>
        </svg>`;
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
}

// ========================================
// NOTES FUNCTIONS
// ========================================

let currentNoteEditor = null;
let editingNoteId = null;

// Initialize Quill editor
function initializeNoteEditor(projectId) {
    const editorElement = document.getElementById(`note-editor-${projectId}`);
    if (!editorElement) return null;

    const editor = new Quill(editorElement, {
        theme: 'snow',
        placeholder: 'Write your note here...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                ['link'],
                ['clean']
            ]
        }
    });

    return editor;
}

// Add new note
window.addNewNote = function(projectId) {
    const notesContainer = document.querySelector('.notes-container');
    if (!notesContainer) return;

    // Check if editor already exists
    if (document.getElementById(`note-editor-container-${projectId}`)) {
        return;
    }

    // Create editor container
    const editorHTML = `
        <div class=\"note-editor-container\" id=\"note-editor-container-${projectId}\">
            <div id=\"note-editor-${projectId}\"></div>
            <div class=\"note-editor-actions\">
                <button class=\"button secondary\" onclick=\"cancelNoteEdit('${projectId}')\">Cancel</button>
                <button class=\"button primary\" onclick=\"saveProjectNote('${projectId}')\">Save Note</button>
            </div>
        </div>
    `;

    // Insert after notes header
    const notesHeader = notesContainer.querySelector('.notes-header');
    if (notesHeader) {
        notesHeader.insertAdjacentHTML('afterend', editorHTML);

        // Initialize Quill editor
        currentNoteEditor = initializeNoteEditor(projectId);
        editingNoteId = null;
    }
};

// Edit existing note
window.editProjectNote = function(projectId, noteId) {
    const project = window.crmState.projects.find(p => p.id === projectId);
    if (!project) return;

    const note = (project.notes || []).find(n => n.id === noteId);
    if (!note) return;

    // Remove existing editor if any
    cancelNoteEdit(projectId);

    // Create editor container
    const editorHTML = `
        <div class=\"note-editor-container\" id=\"note-editor-container-${projectId}\">
            <div id=\"note-editor-${projectId}\"></div>
            <div class=\"note-editor-actions\">
                <button class=\"button secondary\" onclick=\"cancelNoteEdit('${projectId}')\">Cancel</button>
                <button class=\"button primary\" onclick=\"saveProjectNote('${projectId}', '${noteId}')\">Update Note</button>
            </div>
        </div>
    `;

    // Insert after notes header
    const notesHeader = document.querySelector('.notes-header');
    if (notesHeader) {
        notesHeader.insertAdjacentHTML('afterend', editorHTML);

        // Initialize Quill editor
        currentNoteEditor = initializeNoteEditor(projectId);
        editingNoteId = noteId;

        // Set content
        if (currentNoteEditor) {
            currentNoteEditor.root.innerHTML = note.content;
        }
    }
};

// Save note
window.saveProjectNote = async function(projectId, noteId = null) {
    if (!currentNoteEditor) return;

    const content = currentNoteEditor.root.innerHTML;

    // Check if content is empty
    if (!content || content.trim() === '<p><br></p>' || content.trim() === '') {
        showNotification('Please enter some content for the note', 'error');
        return;
    }

    try {
        const project = window.crmState.projects.find(p => p.id === projectId);
        if (!project) throw new Error('Project not found');

        let notes = project.notes || [];

        if (noteId) {
            // Update existing note
            notes = notes.map(note => {
                if (note.id === noteId) {
                    return {
                        ...note,
                        content: content,
                        updatedAt: new Date().toISOString()
                    };
                }
                return note;
            });
        } else {
            // Add new note
            const newNote = {
                id: Date.now().toString(),
                content: content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            notes.push(newNote);
        }

        // Update project in Firestore
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, {
            notes: notes,
            updatedAt: serverTimestamp()
        });

        // Reload data
        await window.loadAllData();

        showNotification(noteId ? 'Note updated successfully!' : 'Note added successfully!', 'success');

        // Clean up and re-render
        cancelNoteEdit(projectId);
        renderProjectNotes(projectId);

    } catch (error) {
        console.error('Error saving note:', error);
        showNotification('Error saving note. Please try again.', 'error');
    }
};

// Cancel note editing
window.cancelNoteEdit = function(projectId) {
    const editorContainer = document.getElementById(`note-editor-container-${projectId}`);
    if (editorContainer) {
        editorContainer.remove();
    }
    currentNoteEditor = null;
    editingNoteId = null;
};

// Delete note
window.deleteProjectNote = async function(projectId, noteId) {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
        const project = window.crmState.projects.find(p => p.id === projectId);
        if (!project) throw new Error('Project not found');

        // Remove note from array
        const notes = (project.notes || []).filter(n => n.id !== noteId);

        // Update project in Firestore
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, {
            notes: notes,
            updatedAt: serverTimestamp()
        });

        // Reload data
        await window.loadAllData();

        showNotification('Note deleted successfully!', 'success');

        // Re-render the notes tab
        renderProjectNotes(projectId);

    } catch (error) {
        console.error('Error deleting note:', error);
        showNotification('Error deleting note. Please try again.', 'error');
    }
};

// Render notes tab
function renderProjectNotes(projectId) {
    const project = window.crmState.projects.find(p => p.id === projectId);
    if (!project) return;

    const notes = project.notes || [];
    const notesTab = document.getElementById('notes-tab');

    if (!notesTab) return;

    notesTab.innerHTML = `
        <div class=\"notes-container\">
            <div class=\"notes-header\">
                <h4 class=\"section-title\">
                    <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                        <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/>
                        <polyline points=\"14 2 14 8 20 8\"/>
                        <line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/>
                        <line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>
                        <line x1=\"10\" y1=\"9\" x2=\"8\" y2=\"9\"/>
                    </svg>
                    Project Notes
                </h4>
                <button class=\"add-note-btn\" onclick=\"addNewNote('${projectId}')\">
                    <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                        <line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/>
                        <line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>
                    </svg>
                    Add Note
                </button>
            </div>

            ${notes.length > 0 ? `
                <div class=\"notes-list\">
                    ${notes.map(note => `
                        <div class=\"note-item\">
                            <div class=\"note-header\">
                                <div class=\"note-timestamp\">
                                    ${formatNoteDate(note.createdAt)}${note.updatedAt && note.updatedAt !== note.createdAt ? ' (edited)' : ''}
                                </div>
                                <div class=\"note-actions\">
                                    <button class=\"btn-icon-small\" onclick=\"editProjectNote('${projectId}', '${note.id}')\" title=\"Edit\">
                                        <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                            <path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/>
                                            <path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/>
                                        </svg>
                                    </button>
                                    <button class=\"btn-icon-small\" onclick=\"deleteProjectNote('${projectId}', '${note.id}')\" title=\"Delete\">
                                        <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                            <polyline points=\"3 6 5 6 21 6\"/>
                                            <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div class=\"note-content\">
                                ${note.content}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class=\"empty-notes\">
                    <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                        <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/>
                        <polyline points=\"14 2 14 8 20 8\"/>
                        <line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/>
                        <line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>
                        <line x1=\"10\" y1=\"9\" x2=\"8\" y2=\"9\"/>
                    </svg>
                    <h4>No notes yet</h4>
                    <p>Add notes to keep track of important information about this project</p>
                </div>
            `}
        </div>
    `;
}

function formatNoteDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Export functions for use in modified viewProjectDetail
window.renderProjectAttachments = renderProjectAttachments;
window.renderProjectNotes = renderProjectNotes;

console.log('Projects.js with Attachments and Notes loaded successfully!');
