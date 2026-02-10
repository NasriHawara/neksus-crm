import { db, storage, collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, ref, uploadBytes, getDownloadURL, deleteObject } from './firebase-config.js';
import { showNotification, formatDate, exportToCSV, importFromCSV, debounce } from './utils.js';

// Client state
let clientFilters = {
    search: '',
    status: 'all',
    sortBy: 'newest'
};

let currentPage = 1;
const itemsPerPage = 10;

// Load Clients Page
window.loadClientsPage = function() {
    const content = document.getElementById('pageContent');
    const { clients } = window.crmState;

    if (clients.length === 0) {
        content.innerHTML = `
            <div class=\"card\">
                <div class=\"empty-state\">
                    <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                        <path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/>
                        <circle cx=\"9\" cy=\"7\" r=\"4\"/>
                        <path d=\"M23 21v-2a4 4 0 0 0-3-3.87\"/>
                        <path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>
                    </svg>
                    <h4>No clients yet</h4>
                    <p>Add your first client to get started.</p>
                    <button class=\"primary-button\" style=\"margin-top: 16px;\" onclick=\"openAddClientModal()\">Add Client</button>
                </div>
            </div>
        `;
        return;
    }

    renderClientsPage();
}

function renderClientsPage() {
    const content = document.getElementById('pageContent');
    let filteredClients = filterAndSortClients();

    // Pagination
    const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedClients = filteredClients.slice(startIndex, endIndex);

    content.innerHTML = `
        <div class=\"card\">
            <div class=\"card-header\">
                <h3>All Clients (${filteredClients.length})</h3>
                <div style=\"display: flex; gap: 12px;\">
                    <button class=\"button secondary\" onclick=\"exportClients()\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 8px;\">
                            <path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/>
                            <polyline points=\"17 8 12 3 7 8\"/>
                            <line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"15\"/>
                        </svg>
                        Export CSV
                    </button>
                    <button class=\"primary-button\" onclick=\"openAddClientModal()\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/>
                            <line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>
                        </svg>
                        Add Client
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
                        <input type=\"text\" id=\"clientSearch\" placeholder=\"Search by name, email, or company...\" value=\"${clientFilters.search}\" onkeyup=\"handleSearch(event)\">
                    </div>
                </div>

                <!-- Modern Filter Pills -->
                <div style=\"display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;\">
                    <div class=\"filter-pills\">
                        <span style=\"font-size: 13px; color: var(--text-secondary); margin-right: 12px; font-weight: 500;\">Status:</span>
                        <button class=\"filter-pill ${clientFilters.status === 'all' ? 'active' : ''}\" onclick=\"handleStatusFilter({target: {value: 'all'}})\">
                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                <circle cx=\"12\" cy=\"12\" r=\"10\"/>
                            </svg>
                            All
                        </button>
                        <button class=\"filter-pill ${clientFilters.status === 'Lead' ? 'active' : ''}\" onclick=\"handleStatusFilter({target: {value: 'Lead'}})\">
                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                <path d=\"M22 11.08V12a10 10 0 1 1-5.93-9.14\"/>
                                <polyline points=\"22 4 12 14.01 9 11.01\"/>
                            </svg>
                            Lead
                        </button>
                        <button class=\"filter-pill ${clientFilters.status === 'Active' ? 'active' : ''}\" onclick=\"handleStatusFilter({target: {value: 'Active'}})\">
                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                <path d=\"M22 11.08V12a10 10 0 1 1-5.93-9.14\"/>
                                <polyline points=\"22 4 12 14.01 9 11.01\"/>
                            </svg>
                            Active
                        </button>
                        <button class=\"filter-pill ${clientFilters.status === 'Lost' ? 'active' : ''}\" onclick=\"handleStatusFilter({target: {value: 'Lost'}})\">
                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 6px;\">
                                <circle cx=\"12\" cy=\"12\" r=\"10\"/>
                                <line x1=\"15\" y1=\"9\" x2=\"9\" y2=\"15\"/>
                                <line x1=\"9\" y1=\"9\" x2=\"15\" y2=\"15\"/>
                            </svg>
                            Lost
                        </button>
                    </div>

                    <!-- Modern Sort Dropdown -->
                    <div class=\"modern-sort-container\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 8px; color: var(--text-secondary);\">
                            <line x1=\"4\" y1=\"6\" x2=\"20\" y2=\"6\"/>
                            <line x1=\"8\" y1=\"12\" x2=\"20\" y2=\"12\"/>
                            <line x1=\"12\" y1=\"18\" x2=\"20\" y2=\"18\"/>
                        </svg>
                        <select id=\"sortFilter\" class=\"modern-select\" onchange=\"handleSortFilter(event)\">
                            <option value=\"newest\" ${clientFilters.sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
                            <option value=\"oldest\" ${clientFilters.sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
                            <option value=\"a-z\" ${clientFilters.sortBy === 'a-z' ? 'selected' : ''}>Name (A-Z)</option>
                            <option value=\"z-a\" ${clientFilters.sortBy === 'z-a' ? 'selected' : ''}>Name (Z-A)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class=\"table-container\">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Company</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedClients.map(client => `
                            <tr>
                                <td>
                                    <strong style=\"cursor: pointer; color: var(--primary-purple);\" onclick=\"viewClientDetail('${client.id}')\">${client.name}</strong>
                                </td>
                                <td>${client.email}</td>
                                <td>${client.phone || '-'}</td>
                                <td>${client.company || '-'}</td>
                                <td><span class=\"badge ${getStatusBadge(client.status)}\">${client.status || 'Active'}</span></td>
                                <td>
                                    <div class=\"action-buttons\">
                                        <button class=\"btn-icon\" onclick=\"viewClientDetail('${client.id}')\" title=\"View Details\">
                                            <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                <path d=\"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\"/>
                                                <circle cx=\"12\" cy=\"12\" r=\"3\"/>
                                            </svg>
                                        </button>
                                        <button class=\"btn-icon\" onclick=\"editClient('${client.id}')\" title=\"Edit\">
                                            <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                <path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/>
                                                <path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/>
                                            </svg>
                                        </button>
                                        <button class=\"btn-icon\" onclick=\"deleteClient('${client.id}')\" title=\"Delete\">
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
                    <button onclick=\"changePage(${currentPage - 1})\" ${currentPage === 1 ? 'disabled' : ''}>
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <polyline points=\"15 18 9 12 15 6\"/>
                        </svg>
                    </button>
                    ${Array.from({length: totalPages}, (_, i) => i + 1).map(page => `
                        <button class=\"${page === currentPage ? 'active' : ''}\" onclick=\"changePage(${page})\">${page}</button>
                    `).join('')}
                    <button onclick=\"changePage(${currentPage + 1})\" ${currentPage === totalPages ? 'disabled' : ''}>
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

            /* Client Detail Modal Tabs */
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

            .project-card, .task-card {
                background: var(--bg-darker);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                padding: 16px;
                margin-bottom: 12px;
                transition: all 0.2s ease;
            }

            .project-card:hover, .task-card:hover {
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

function filterAndSortClients() {
    let clients = [...window.crmState.clients];

    // Search filter
    if (clientFilters.search) {
        const searchLower = clientFilters.search.toLowerCase();
        clients = clients.filter(client =>
            client.name.toLowerCase().includes(searchLower) ||
            client.email.toLowerCase().includes(searchLower) ||
            (client.company && client.company.toLowerCase().includes(searchLower))
        );
    }

    // Status filter
    if (clientFilters.status !== 'all') {
        clients = clients.filter(client => client.status === clientFilters.status);
    }

    // Sort
    switch(clientFilters.sortBy) {
        case 'newest':
            clients.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
            break;
        case 'oldest':
            clients.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateA - dateB;
            });
            break;
        case 'a-z':
            clients.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'z-a':
            clients.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }

    return clients;
}

function getStatusBadge(status) {
    switch(status) {
        case 'Lead': return 'warning';
        case 'Active': return 'success';
        case 'Lost': return 'danger';
        default: return 'info';
    }
}

// Handlers
window.handleSearch = debounce(function(event) {
    clientFilters.search = event.target.value;
    currentPage = 1;
    renderClientsPage();
}, 300);

window.handleStatusFilter = function(event) {
    clientFilters.status = event.target.value;
    currentPage = 1;
    renderClientsPage();
}

window.handleSortFilter = function(event) {
    clientFilters.sortBy = event.target.value;
    currentPage = 1;
    renderClientsPage();
}

window.changePage = function(page) {
    currentPage = page;
    renderClientsPage();
}

// Export Clients
window.exportClients = function() {
    const clients = window.crmState.clients.map(client => ({
        name: client.name,
        email: client.email,
        phone: client.phone || '',
        company: client.company || '',
        address: client.address || '',
        status: client.status || '',
        notes: client.notes || ''
    }));
    exportToCSV(clients, 'clients.csv');
}

// Open Add Client Modal
window.openAddClientModal = function() {
    if (typeof window.closeModal === 'function') {
        window.closeModal('quickAddModal');
    }

    const modalHTML = `
        <div class=\"modal active\" id=\"clientModal\">
            <div class=\"modal-content\">
                <div class=\"modal-header\">
                    <h3>Add New Client</h3>
                    <button class=\"close-button\" onclick=\"closeModal('clientModal')\">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>
                <div class=\"modal-body\">
                    <form id=\"clientForm\" onsubmit=\"saveClient(event)\">
                        <div class=\"form-group\">
                            <label>Client Name *</label>
                            <input type=\"text\" name=\"name\" required placeholder=\"Enter client name\">
                        </div>
                        <div class=\"form-group\">
                            <label>Email *</label>
                            <input type=\"email\" name=\"email\" required placeholder=\"client@example.com\">
                        </div>
                        <div class=\"form-group\">
                            <label>Phone</label>
                            <input type=\"tel\" name=\"phone\" placeholder=\"+1 (555) 123-4567\">
                        </div>
                        <div class=\"form-group\">
                            <label>Company</label>
                            <input type=\"text\" name=\"company\" placeholder=\"Company name\">
                        </div>
                        <div class=\"form-group\">
                            <label>Address</label>
                            <textarea name=\"address\" rows=\"3\" placeholder=\"Full address\"></textarea>
                        </div>
                        <div class=\"form-group\">
                            <label>Status</label>
                            <select name=\"status\">
                                <option value=\"Lead\">Lead</option>
                                <option value=\"Active\" selected>Active</option>
                                <option value=\"Lost\">Lost</option>
                            </select>
                        </div>
                        <div class=\"form-group\">
                            <label>Notes</label>
                            <textarea name=\"notes\" rows=\"4\" placeholder=\"Additional notes about the client\"></textarea>
                        </div>
                        <div class=\"form-actions\">
                            <button type=\"button\" class=\"button secondary\" onclick=\"closeModal('clientModal')\">Cancel</button>
                            <button type=\"submit\" class=\"button primary\">Add Client</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Save Client
window.saveClient = async function(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const clientData = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company'),
        address: formData.get('address'),
        status: formData.get('status'),
        notes: formData.get('notes'),
        communicationLog: [],
        attachments: [],
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, 'clients'), clientData);
        window.closeModal('clientModal');
        document.getElementById('clientModal').remove();
        await window.loadAllData();
        showNotification('Client added successfully!', 'success');
    } catch (error) {
        console.error('Error adding client:', error);
        showNotification('Error adding client. Please try again.', 'error');
    }
}

// Edit Client
window.editClient = function(clientId) {
    const client = window.crmState.clients.find(c => c.id === clientId);
    if (!client) return;

    const modalHTML = `
        <div class=\"modal active\" id=\"clientModal\">
            <div class=\"modal-content\">
                <div class=\"modal-header\">
                    <h3>Edit Client</h3>
                    <button class=\"close-button\" onclick=\"closeModal('clientModal')\">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>
                <div class=\"modal-body\">
                    <form id=\"clientForm\" onsubmit=\"updateClient(event, '${clientId}')\">
                        <div class=\"form-group\">
                            <label>Client Name *</label>
                            <input type=\"text\" name=\"name\" required value=\"${client.name}\">
                        </div>
                        <div class=\"form-group\">
                            <label>Email *</label>
                            <input type=\"email\" name=\"email\" required value=\"${client.email}\">
                        </div>
                        <div class=\"form-group\">
                            <label>Phone</label>
                            <input type=\"tel\" name=\"phone\" value=\"${client.phone || ''}\">
                        </div>
                        <div class=\"form-group\">
                            <label>Company</label>
                            <input type=\"text\" name=\"company\" value=\"${client.company || ''}\">
                        </div>
                        <div class=\"form-group\">
                            <label>Address</label>
                            <textarea name=\"address\" rows=\"3\">${client.address || ''}</textarea>
                        </div>
                        <div class=\"form-group\">
                            <label>Status</label>
                            <select name=\"status\">
                                <option value=\"Lead\" ${client.status === 'Lead' ? 'selected' : ''}>Lead</option>
                                <option value=\"Active\" ${client.status === 'Active' ? 'selected' : ''}>Active</option>
                                <option value=\"Lost\" ${client.status === 'Lost' ? 'selected' : ''}>Lost</option>
                            </select>
                        </div>
                        <div class=\"form-group\">
                            <label>Notes</label>
                            <textarea name=\"notes\" rows=\"4\">${client.notes || ''}</textarea>
                        </div>
                        <div class=\"form-actions\">
                            <button type=\"button\" class=\"button secondary\" onclick=\"closeModal('clientModal')\">Cancel</button>
                            <button type=\"submit\" class=\"button primary\">Update Client</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Update Client
window.updateClient = async function(event, clientId) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const clientData = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company'),
        address: formData.get('address'),
        status: formData.get('status'),
        notes: formData.get('notes'),
        updatedAt: serverTimestamp()
    };

    try {
        const clientRef = doc(db, 'clients', clientId);
        await updateDoc(clientRef, clientData);
        window.closeModal('clientModal');
        document.getElementById('clientModal').remove();
        await window.loadAllData();
        showNotification('Client updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating client:', error);
        showNotification('Error updating client. Please try again.', 'error');
    }
}

// Delete Client
window.deleteClient = async function(clientId) {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) return;

    try {
        const clientRef = doc(db, 'clients', clientId);
        await deleteDoc(clientRef);
        await window.loadAllData();
        showNotification('Client deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting client:', error);
        showNotification('Error deleting client. Please try again.', 'error');
    }
}

// View Client Detail - Comprehensive Modal
window.viewClientDetail = function(clientId) {
    const client = window.crmState.clients.find(c => c.id === clientId);
    if (!client) return;

    // Get linked projects (projects where client field matches this client's name)
    const linkedProjects = window.crmState.projects.filter(p => p.client === client.name);
    
    // Get linked tasks (tasks that belong to this client's projects)
    const linkedTasks = window.crmState.tasks.filter(task => 
        linkedProjects.some(project => project.id === task.projectId)
    );

    const communicationLog = client.communicationLog || [];
    const attachments = client.attachments || [];

    const modalHTML = `
        <div class=\"modal active\" id=\"clientDetailModal\" style=\"z-index: 1001;\">
            <div class=\"modal-content\" style=\"max-width: 900px;\">
                <div class=\"modal-header\">
                    <div>
                        <h3>${client.name}</h3>
                        <p style=\"color: var(--text-secondary); font-size: 14px; margin-top: 4px;\">${client.email}</p>
                    </div>
                    <button class=\"close-button\" onclick=\"closeClientDetailModal()\">
                        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>
                            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>
                        </svg>
                    </button>
                </div>

                <!-- Tabs -->
                <div class=\"detail-tabs\">
                    <button class=\"detail-tab active\" onclick=\"switchDetailTab(event, 'overview')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"/>
                            <circle cx=\"12\" cy=\"7\" r=\"4\"/>
                        </svg>
                        Overview
                    </button>
                    <button class=\"detail-tab\" onclick=\"switchDetailTab(event, 'projects')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>
                        </svg>
                        Projects (${linkedProjects.length})
                    </button>
                    <button class=\"detail-tab\" onclick=\"switchDetailTab(event, 'tasks')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M9 11l3 3L22 4\"/>
                            <path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>
                        </svg>
                        Tasks (${linkedTasks.length})
                    </button>
                    <button class=\"detail-tab\" onclick=\"switchDetailTab(event, 'communication')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>
                        </svg>
                        Communication
                    </button>
                    <button class=\"detail-tab\" onclick=\"switchDetailTab(event, 'attachments')\">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"display: inline; margin-right: 6px;\">
                            <path d=\"M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48\"/>
                        </svg>
                        Attachments
                    </button>
                </div>

                <!-- Tab Contents -->
                <div class=\"modal-body\" style=\"max-height: 600px; overflow-y: auto;\">
                    <!-- Overview Tab -->
                    <div class=\"detail-tab-content active\" id=\"overview-tab\">
                        <div class=\"section-title\">
                            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                <path d=\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"/>
                                <circle cx=\"12\" cy=\"7\" r=\"4\"/>
                            </svg>
                            Personal Information
                        </div>
                        <div class=\"info-grid\">
                            <div class=\"info-item\">
                                <span class=\"info-label\">Full Name</span>
                                <span class=\"info-value\">${client.name}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Email Address</span>
                                <span class=\"info-value\">${client.email}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Phone Number</span>
                                <span class=\"info-value\">${client.phone || 'Not provided'}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Company</span>
                                <span class=\"info-value\">${client.company || 'Not provided'}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Status</span>
                                <span class=\"badge ${getStatusBadge(client.status)}\">${client.status || 'Active'}</span>
                            </div>
                            <div class=\"info-item\">
                                <span class=\"info-label\">Address</span>
                                <span class=\"info-value\">${client.address || 'Not provided'}</span>
                            </div>
                        </div>
                        ${client.notes ? `
                            <div style=\"margin-top: 24px;\">
                                <div class=\"section-title\">
                                    <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                        <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/>
                                        <polyline points=\"14 2 14 8 20 8\"/>
                                        <line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/>
                                        <line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>
                                        <polyline points=\"10 9 9 9 8 9\"/>
                                    </svg>
                                    Notes
                                </div>
                                <div style=\"background: var(--bg-darker); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);\">
                                    <p style=\"color: var(--text-primary); line-height: 1.6; white-space: pre-wrap;\">${client.notes}</p>
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Projects Tab -->
                    <div class=\"detail-tab-content\" id=\"projects-tab\">
                        <div class=\"section-title\">
                            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                <path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>
                            </svg>
                            Linked Projects
                        </div>
                        ${linkedProjects.length > 0 ? linkedProjects.map(project => `
                            <div class=\"project-card\">
                                <div style=\"display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;\">
                                    <div>
                                        <h4 style=\"font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;\">${project.name}</h4>
                                        <p style=\"font-size: 13px; color: var(--text-secondary);\">${project.description || 'No description'}</p>
                                    </div>
                                    <span class=\"badge ${project.status === 'active' ? 'success' : project.status === 'completed' ? 'info' : 'warning'}\">${project.status || 'Active'}</span>
                                </div>
                                <div style=\"display: flex; gap: 20px; font-size: 13px; color: var(--text-secondary);\">
                                    ${project.dueDate ? `
                                        <div style=\"display: flex; align-items: center; gap: 6px;\">
                                            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                <rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>
                                                <line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/>
                                                <line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/>
                                                <line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/>
                                            </svg>
                                            Due: ${project.dueDate}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('') : `
                            <div class=\"empty-section\">
                                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                    <path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>
                                </svg>
                                <p>No projects linked to this client yet.</p>
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
                            Linked Tasks
                        </div>
                        ${linkedTasks.length > 0 ? linkedTasks.map(task => {
                            const taskProject = linkedProjects.find(p => p.id === task.projectId);
                            return `
                                <div class=\"task-card\">
                                    <div style=\"display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;\">
                                        <h4 style=\"font-size: 15px; font-weight: 600; color: var(--text-primary);\">${task.title}</h4>
                                        <span class=\"badge ${task.status === 'done' ? 'success' : task.status === 'in-progress' ? 'warning' : 'secondary'}\">${task.status || 'To Do'}</span>
                                    </div>
                                    ${task.description ? `<p style=\"font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;\">${task.description}</p>` : ''}
                                    <div style=\"display: flex; gap: 16px; font-size: 12px; color: var(--text-muted);\">
                                        ${taskProject ? `
                                            <div style=\"display: flex; align-items: center; gap: 6px;\">
                                                <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                    <path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>
                                                </svg>
                                                ${taskProject.name}
                                            </div>
                                        ` : ''}
                                        ${task.priority ? `<span class=\"badge ${task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'info'}\">${task.priority}</span>` : ''}
                                        ${task.dueDate ? `
                                            <div style=\"display: flex; align-items: center; gap: 6px;\">
                                                <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                                    <rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>
                                                    <line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/>
                                                    <line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/>
                                                    <line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/>
                                                </svg>
                                                ${task.dueDate}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('') : `
                            <div class=\"empty-section\">
                                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                    <path d=\"M9 11l3 3L22 4\"/>
                                    <path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>
                                </svg>
                                <p>No tasks linked to this client yet.</p>
                            </div>
                        `}
                    </div>

                    <!-- Communication Tab -->
                    <div class=\"detail-tab-content\" id=\"communication-tab\">
                        <div class=\"section-title\">
                            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                <path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>
                            </svg>
                            Communication Log
                        </div>
                        ${communicationLog.length > 0 ? communicationLog.map(comm => `
                            <div class=\"project-card\">
                                <div style=\"margin-bottom: 8px;\">
                                    <span style=\"font-size: 12px; color: var(--text-muted);\">${comm.date || 'No date'}</span>
                                </div>
                                <p style=\"color: var(--text-primary); line-height: 1.6;\">${comm.message || comm.note || 'No details'}</p>
                            </div>
                        `).join('') : `
                            <div class=\"empty-section\">
                                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                    <path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>
                                </svg>
                                <p>No communication history recorded yet.</p>
                            </div>
                        `}
                    </div>

                    <!-- Attachments Tab -->
                    <div class=\"detail-tab-content\" id=\"attachments-tab\">
                        <div class=\"section-title\">
                            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                <path d=\"M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48\"/>
                            </svg>
                            Attachments
                        </div>
                        ${attachments.length > 0 ? attachments.map(att => `
                            <div class=\"project-card\">
                                <div style=\"display: flex; justify-content: space-between; align-items: center;\">
                                    <div style=\"display: flex; align-items: center; gap: 12px;\">
                                        <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"color: var(--primary-purple);\">
                                            <path d=\"M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z\"/>
                                            <polyline points=\"13 2 13 9 20 9\"/>
                                        </svg>
                                        <div>
                                            <p style=\"font-weight: 600; color: var(--text-primary);\">${att.name || 'Untitled'}</p>
                                            <p style=\"font-size: 12px; color: var(--text-secondary);\">${att.size || 'Unknown size'}</p>
                                        </div>
                                    </div>
                                    <a href=\"${att.url}\" target=\"_blank\" class=\"btn-icon\" title=\"Download\">
                                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                            <path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/>
                                            <polyline points=\"7 10 12 15 17 10\"/>
                                            <line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        `).join('') : `
                            <div class=\"empty-section\">
                                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                                    <path d=\"M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48\"/>
                                </svg>
                                <p>No attachments uploaded yet.</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Switch tabs in detail modal
window.switchDetailTab = function(event, tabName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.detail-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.detail-tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked tab and corresponding content
    event.currentTarget.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
}

// Close client detail modal
window.closeClientDetailModal = function() {
    const modal = document.getElementById('clientDetailModal');
    if (modal) {
        modal.remove();
    }
}

console.log('Clients.js loaded successfully!');
