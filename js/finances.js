import { db, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot } from './firebase-config.js';

// Store unsubscribe function for real-time listener
let unsubscribeFinances = null;

// Whether the Recent Transactions table is showing all transactions or just the last 10
let showAllTransactions = false;

// Setup real-time sync for finances
export function setupFinancesSync() {

    unsubscribeFinances = onSnapshot(
        collection(db, 'finances'),
        (snapshot) => {
            const previousCount = window.crmState.finances.length;
            window.crmState.finances = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (previousCount > 0) {
                snapshot.docChanges().forEach((change) => {
                    const docData = change.doc.data();
                    if (change.type === 'added') {
                        window.showNotification(`New ${docData.type} added: ${docData.description}`, 'success');
                    } else if (change.type === 'modified') {
                        window.showNotification(`${docData.type} updated: ${docData.description}`, 'info');
                    } else if (change.type === 'removed') {
                        window.showNotification(`${docData.type} removed: ${docData.description}`, 'warning');
                    }
                });
            }

            if (window.crmState.currentPage === 'finances') {
                loadFinancesPage();
            }
        },
        (error) => {
            console.error('Error syncing finances:', error);
            if (window.showNotification) {
                window.showNotification('Error syncing finances', 'error');
            }
        }
    );
}

// Load finances page
export function loadFinancesPage() {
    const content = document.getElementById('pageContent');
    const finances = window.crmState.finances || [];
    const clients = window.crmState.clients || [];
    const projects = window.crmState.projects || [];
    const contractors = window.crmState.contractors || [];

    const totalIncome = finances
        .filter(f => f.type === 'income')
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

    const capitalFromIncome = finances
        .filter(f => f.type === 'income' && f.takeCapital === true)
        .reduce((sum, f) => sum + (parseFloat(f.amount) * 0.2 || 0), 0);

    const capitalInjections = finances
        .filter(f => f.type === 'capital_injection')
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

    const totalExpenses = finances
        .filter(f => f.type === 'expense')
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

    const capital = capitalFromIncome + capitalInjections - totalExpenses;

    const netProfitFromCapitalIncome = finances
        .filter(f => f.type === 'income' && f.takeCapital === true)
        .reduce((sum, f) => sum + (parseFloat(f.amount) * 0.8 || 0), 0);

    const netProfitFromOtherIncome = finances
        .filter(f => f.type === 'income' && f.takeCapital !== true)
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

    const netProfit = netProfitFromCapitalIncome + netProfitFromOtherIncome;

    const sortedTransactions = [...finances].sort((a, b) => new Date(b.date) - new Date(a.date));
    const visibleTransactions = showAllTransactions ? sortedTransactions : sortedTransactions.slice(0, 10);

    const categoryBreakdown = finances.reduce((acc, f) => {
        const category = f.category || 'Uncategorized';
        if (!acc[category]) {
            acc[category] = { income: 0, expense: 0 };
        }
        if (f.type === 'income') {
            acc[category].income += parseFloat(f.amount) || 0;
        } else {
            acc[category].expense += parseFloat(f.amount) || 0;
        }
        return acc;
    }, {});

    const unpaidPayments = finances.filter(f => f.status === 'unpaid');
    const unpaidTotal = unpaidPayments.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

    const clientOptions = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const projectOptions = projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const contractorOptions = contractors.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    content.innerHTML = `
        <div class="finances-page-header">
            <h2 style="margin: 0;">Finances</h2>
            <div class="header-actions">
                <button class="button secondary" onclick="window.openAddCapitalModal()" style="display: flex; align-items: center; gap: 6px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                    Add Capital
                </button>
                <button class="primary-button" onclick="window.openAddFinanceModal()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add Transaction
                </button>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card success">
                <div class="stat-icon success">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                </div>
                <div class="stat-details">
                    <div class="stat-label">Total Income</div>
                    <div class="stat-value">$${totalIncome.toFixed(2)}</div>
                </div>
            </div>
            <div class="stat-card danger">
                <div class="stat-icon danger">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
                    </svg>
                </div>
                <div class="stat-details">
                    <div class="stat-label">Total Expenses</div>
                    <div class="stat-value">$${totalExpenses.toFixed(2)}</div>
                </div>
            </div>
            <div class="stat-card info">
                <div class="stat-icon info">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                </div>
                <div class="stat-details">
                    <div class="stat-label">Net Profit/Loss</div>
                    <div class="stat-value" style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}</div>
                </div>
            </div>
            <div class="stat-card warning">
                <div class="stat-icon warning">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                </div>
                <div class="stat-details">
                    <div class="stat-label">Capital</div>
                    <div class="stat-value">$${capital.toFixed(2)}</div>
                </div>
            </div>
        </div>

        <div class="card finances-section">
            <div class="card-header">
                <h3 style="color: var(--danger);">⚠ Unpaid Payments (${unpaidPayments.length})</h3>
                <span class="section-total" style="color: var(--danger);">Total: $${unpaidTotal.toFixed(2)}</span>
            </div>
            ${unpaidPayments.length === 0 ? `
                <div class="empty-state" style="padding: 24px;">
                    <p style="color: var(--text-secondary);">No unpaid payments 🎉</p>
                </div>
            ` : `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Due Date</th>
                                <th>Client</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${unpaidPayments.sort((a, b) => new Date(a.dueDate || '9999') - new Date(b.dueDate || '9999')).map(f => `
                                <tr>
                                    <td style="color: ${f.dueDate && new Date(f.dueDate) < new Date() ? 'var(--danger)' : 'var(--text-primary)'}">
                                        ${f.dueDate ? window.formatDate(f.dueDate) : 'No due date'}
                                        ${f.dueDate && new Date(f.dueDate) < new Date() ? ' <span style="color:var(--danger); font-size:11px; font-weight:600;">OVERDUE</span>' : ''}
                                    </td>
                                    <td>${window.getClientName(f.clientId) || '-'}</td>
                                    <td>${f.description}</td>
                                    <td style="color: var(--danger); font-weight: 600;">$${parseFloat(f.amount).toFixed(2)}</td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="icon-button" style="color: var(--success);" onclick="window.markAsPaid('${f.id}')" title="Mark as Paid">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                                    <polyline points="22 4 12 14.01 9 11.01"/>
                                                </svg>
                                            </button>
                                            <button class="icon-button" onclick="window.editFinance('${f.id}')" title="Edit">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>

        <div class="card finances-section">
            <div class="card-header">
                <h3>${showAllTransactions ? `All Transactions (${finances.length})` : 'Recent Transactions'}</h3>
                ${finances.length > 10 ? `
                    <button class="button secondary" style="padding: 6px 14px; font-size: 13px;" onclick="window.toggleShowAllTransactions()">
                        ${showAllTransactions ? 'Show Recent Only' : `View All (${finances.length})`}
                    </button>
                ` : ''}
            </div>

            <div class="table-toolbar">
                <div class="modern-search-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input type="text" id="financeSearch" placeholder="Search by description, client, project..." onkeyup="window.filterFinances()">
                </div>
                <select id="financeTypeFilter" onchange="window.filterFinances()">
                    <option value="all">All Types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expenses</option>
                    <option value="unpaid">Unpaid</option>
                </select>
                <select id="financeCategoryFilter" onchange="window.filterFinances()">
                    <option value="all">All Categories</option>
                    ${getUniqueCategories().map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>
                <select id="financeClientFilter" onchange="window.filterFinances()">
                    <option value="all">All Clients</option>
                    ${clientOptions}
                </select>
                <select id="financeProjectFilter" onchange="window.filterFinances()">
                    <option value="all">All Projects</option>
                    ${projectOptions}
                </select>
                <select id="financeContractorFilter" onchange="window.filterFinances()">
                    <option value="all">All Contractors</option>
                    ${contractorOptions}
                </select>
                <input type="month" id="financeMonthFilter" onchange="window.filterFinances()" title="Filter by month">
                <div class="date-range">
                    <input type="date" id="financeFromDate" onchange="window.filterFinances()" title="From date">
                    <span>→</span>
                    <input type="date" id="financeToDate" onchange="window.filterFinances()" title="To date">
                </div>
                <button class="clear-filters-btn" onclick="window.clearFinanceFilters()">Clear</button>
            </div>

            ${finances.length === 0 ? `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="1" x2="12" y2="23"/>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    <h4>No transactions yet</h4>
                    <p>Add your first income or expense to get started.</p>
                    <button class="primary-button" onclick="window.openAddFinanceModal()">Add Transaction</button>
                </div>
            ` : `
                <div class="table-container" id="financeTableContainer">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Client</th>
                                <th>Project</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="financeTableBody">
                            ${renderFinanceRows(visibleTransactions)}
                        </tbody>
                    </table>
                </div>
            `}
        </div>

        <div class="card finances-section">
            <div class="card-header">
                <h3>Category Breakdown</h3>
            </div>
            ${Object.keys(categoryBreakdown).length === 0 ? `
                <div class="empty-state">
                    <p>No transactions yet</p>
                </div>
            ` : `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Income</th>
                                <th>Expenses</th>
                                <th>Net</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(categoryBreakdown).map(([category, data]) => {
                                const net = data.income - data.expense;
                                return `
                                    <tr>
                                        <td><strong>${category}</strong></td>
                                        <td style="color: var(--success)">$${data.income.toFixed(2)}</td>
                                        <td style="color: var(--danger)">$${data.expense.toFixed(2)}</td>
                                        <td style="color: ${net >= 0 ? 'var(--success)' : 'var(--danger)'}">${net >= 0 ? '+' : ''}$${net.toFixed(2)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>

      <!-- Add/Edit Finance Modal -->
        <div class="modal" id="addFinanceModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="financeModalTitle">Add Transaction</h3>
                    <button class="close-button" onclick="window.closeModal('addFinanceModal')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="financeForm" onsubmit="window.handleFinanceSubmit(event)">
                        <div class="form-group">
                            <label>Type *</label>
                            <select id="financeType" required style="background: var(--bg-darker); color: var(--text-primary);">
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                                <option value="capital_injection">Capital Injections</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Category *</label>
                            <select id="financeCategory" required style="background: var(--bg-darker); color: var(--text-primary);">
                                <option value="">Select Category</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Description *</label>
                            <input type="text" id="financeDescription" placeholder="Brief description" required>
                        </div>

                        <div class="form-group">
                            <label>Amount ($) *</label>
                            <input type="number" id="financeAmount" step="0.01" min="0" placeholder="0.00" required>
                        </div>

                        <div class="form-group">
                            <label>Date *</label>
                            <input type="date" id="financeDate" required>
                        </div>

                        <div class="form-group" id="takeCapitalGroup" style="display: none;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="financeTakeCapital" style="width: 18px; height: 18px; cursor: pointer;">
                                <span>Take Capital (20% of income)</span>
                            </label>
                            <p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px; margin-left: 28px;">
                                When checked, 20% of this income will be added to Capital
                            </p>
                        </div>

                        <div class="form-group">
                            <label>Client</label>
                            <select id="financeClient" style="background: var(--bg-darker); color: var(--text-primary);">
                                <option value="">No Client</option>
                                ${(window.crmState.clients || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Project</label>
                                <select id="financeProject" style="background: var(--bg-darker); color: var(--text-primary);">
                                    <option value="">No Project</option>
                                    ${(window.crmState.projects || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group" id="contractorFieldGroup" style="display: none;">
                                <label>Contractor</label>
                                <select id="financeContractor" style="background: var(--bg-darker); color: var(--text-primary);">
                                    <option value="">No Contractor</option>
                                    ${(window.crmState.contractors || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Payment Status</label>
                            <select id="financeStatus" style="background: var(--bg-darker); color: var(--text-primary);">
                                <option value="paid">Paid</option>
                                <option value="unpaid">Unpaid</option>
                            </select>
                        </div>

                        <div class="form-group" id="dueDateGroup" style="display:none;">
                            <label>Due Date</label>
                            <input type="date" id="financeDueDate">
                        </div>

                        <div class="form-group">
                            <label>Notes</label>
                            <textarea id="financeNotes" rows="3" placeholder="Additional notes (optional)"></textarea>
                        </div>

                        <input type="hidden" id="financeId">

                        <div class="modal-actions">
                            <button type="button" class="button secondary" onclick="window.closeModal('addFinanceModal')">Cancel</button>
                            <button type="submit" class="primary-button">Save Transaction</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>


        <!-- Add Capital Modal -->
<div class="modal" id="addCapitalModal">
    <div class="modal-content">
        <div class="modal-header">
            <h3>Add Capital</h3>
            <button class="close-button" onclick="window.closeModal('addCapitalModal')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
        <div class="modal-body">
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
                Manually inject capital from the owner's personal funds. This amount will be added directly to the Capital balance.
            </p>
            <form id="capitalForm" onsubmit="window.handleCapitalSubmit(event)">
                <div class="form-group">
                    <label>Amount ($) *</label>
                    <input type="number" id="capitalAmount" step="0.01" min="0.01" placeholder="0.00" required>
                </div>
                <div class="form-group">
                    <label>Date *</label>
                    <input type="date" id="capitalDate" required>
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea id="capitalNotes" rows="3" placeholder="e.g. Owner personal investment, emergency fund..."></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="button secondary" onclick="window.closeModal('addCapitalModal')">Cancel</button>
                    <button type="submit" class="primary-button">Add to Capital</button>
                </div>
            </form>
        </div>
    </div>
</div>
    `;

    const dateInput = document.getElementById('financeDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    const statusSelect = document.getElementById('financeStatus');
    if (statusSelect) {
        statusSelect.addEventListener('change', function() {
            const dueDateGroup = document.getElementById('dueDateGroup');
            dueDateGroup.style.display = this.value === 'unpaid' ? 'block' : 'none';
        });
    }

    function updateCategories() {
        const type = document.getElementById('financeType').value;
        const categorySelect = document.getElementById('financeCategory');

        const incomeCategories = ['Development', 'Marketing', 'Design', 'Retainer', 'Other Income'];
        const expenseCategories = ['Software', 'Marketing', 'Utilities', 'Salaries', 'Contractor Payment', 'Other Expense'];

        const categories = type === 'income' ? incomeCategories : expenseCategories;

        categorySelect.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }

    const typeSelect = document.getElementById('financeType');
    if (typeSelect) {
        typeSelect.addEventListener('change', function() {
            const takeCapitalGroup = document.getElementById('takeCapitalGroup');
            const contractorFieldGroup = document.getElementById('contractorFieldGroup');
            if (this.value === 'income') {
                takeCapitalGroup.style.display = 'block';
            } else {
                takeCapitalGroup.style.display = 'none';
                document.getElementById('financeTakeCapital').checked = false;
            }

            contractorFieldGroup.style.display = this.value === 'expense' ? 'block' : 'none';
            if (this.value !== 'expense') {
                document.getElementById('financeContractor').value = '';
            }

            updateCategories();
        });

        updateCategories();
        typeSelect.dispatchEvent(new Event('change'));
    }
}

function renderFinanceRows(transactions) {
    return transactions.map(finance => `
        <tr>
            <td>${window.formatDate(finance.date)}</td>
            <td>
                <span class="badge ${finance.type === 'income' ? 'success' : finance.type === 'capital_injection' ? 'info' : 'danger'}">
                    ${finance.type === 'income' ? '↑ Income' : finance.type === 'capital_injection' ? '⬡ Capital' : '↓ Expense'}
                </span>
            </td>
            <td>${window.getClientName(finance.clientId) || '-'}</td>
            <td>${window.getProjectName(finance.projectId) || '-'}</td>
            <td>${finance.category || 'Uncategorized'}</td>
            <td>${finance.description}</td>
            <td class="${finance.type === 'income' ? 'income-amount' : 'expense-amount'}">
                ${finance.type === 'income' ? '+' : '-'}$${parseFloat(finance.amount).toFixed(2)}
            </td>
            <td>
                <span class="badge ${finance.status === 'unpaid' ? 'danger' : 'success'}" style="font-size: 11px;">
                    ${finance.status === 'unpaid' ? 'Unpaid' : 'Paid'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="icon-button" onclick="window.editFinance('${finance.id}')" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="icon-button danger" onclick="window.deleteFinance('${finance.id}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getUniqueCategories() {
    const finances = window.crmState.finances || [];
    const categories = finances.map(f => f.category).filter(Boolean);
    return [...new Set(categories)].sort();
}

window.toggleShowAllTransactions = function() {
    showAllTransactions = !showAllTransactions;
    loadFinancesPage();
}

window.filterFinances = function() {
    const searchVal = document.getElementById('financeSearch')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('financeTypeFilter')?.value || 'all';
    const categoryFilter = document.getElementById('financeCategoryFilter')?.value || 'all';
    const clientFilter = document.getElementById('financeClientFilter')?.value || 'all';
    const projectFilter = document.getElementById('financeProjectFilter')?.value || 'all';
    const contractorFilter = document.getElementById('financeContractorFilter')?.value || 'all';
    const monthFilter = document.getElementById('financeMonthFilter')?.value || '';
    const fromDate = document.getElementById('financeFromDate')?.value || '';
    const toDate = document.getElementById('financeToDate')?.value || '';

    let filtered = [...window.crmState.finances];

    if (searchVal) {
        filtered = filtered.filter(f => {
            const clientName = (window.getClientName(f.clientId) || '').toLowerCase();
            const projectName = (window.getProjectName(f.projectId) || '').toLowerCase();
            return (f.description || '').toLowerCase().includes(searchVal) ||
                clientName.includes(searchVal) ||
                projectName.includes(searchVal) ||
                (f.category || '').toLowerCase().includes(searchVal);
        });
    }

    if (typeFilter === 'unpaid') {
        filtered = filtered.filter(f => f.status === 'unpaid');
    } else if (typeFilter !== 'all') {
        filtered = filtered.filter(f => f.type === typeFilter);
    }

    if (categoryFilter !== 'all') {
        filtered = filtered.filter(f => f.category === categoryFilter);
    }

    if (clientFilter !== 'all') {
        filtered = filtered.filter(f => f.clientId === clientFilter);
    }

    if (projectFilter !== 'all') {
        filtered = filtered.filter(f => f.projectId === projectFilter);
    }

    if (contractorFilter !== 'all') {
        filtered = filtered.filter(f => f.contractorId === contractorFilter);
    }

    if (monthFilter) {
        filtered = filtered.filter(f => {
            const financeMonth = new Date(f.date).toISOString().slice(0, 7);
            return financeMonth === monthFilter;
        });
    }

    if (fromDate) {
        filtered = filtered.filter(f => f.date >= fromDate);
    }
    if (toDate) {
        filtered = filtered.filter(f => f.date <= toDate);
    }

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('financeTableBody');
    if (tbody) {
        tbody.innerHTML = renderFinanceRows(filtered);
    }
}

window.clearFinanceFilters = function() {
    ['financeSearch', 'financeMonthFilter', 'financeFromDate', 'financeToDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['financeTypeFilter', 'financeCategoryFilter', 'financeClientFilter', 'financeProjectFilter', 'financeContractorFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'all';
    });
    window.filterFinances();
}

window.openAddFinanceModal = function() {
    document.getElementById('financeModalTitle').textContent = 'Add Transaction';
    document.getElementById('financeForm').reset();
    document.getElementById('financeId').value = '';
    document.getElementById('financeDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('financeStatus').value = 'paid';
    document.getElementById('dueDateGroup').style.display = 'none';
    window.openModal('addFinanceModal');
}

window.editFinance = async function(financeId) {
    const finance = window.crmState.finances.find(f => f.id === financeId);
    if (!finance) return;

    document.getElementById('financeModalTitle').textContent = 'Edit Transaction';
    document.getElementById('financeId').value = finance.id;
    document.getElementById('financeType').value = finance.type;
    // Fire change so the category dropdown repopulates with the right
    // income/expense options BEFORE we try to select finance.category below
    // (otherwise the option doesn't exist yet and the select silently stays blank)
    document.getElementById('financeType').dispatchEvent(new Event('change'));
    document.getElementById('financeCategory').value = finance.category;
    document.getElementById('financeDescription').value = finance.description;
    document.getElementById('financeAmount').value = finance.amount;
    document.getElementById('financeDate').value = finance.date;
    document.getElementById('financeNotes').value = finance.notes || '';
    document.getElementById('financeTakeCapital').checked = finance.takeCapital || false;
    document.getElementById('financeClient').value = finance.clientId || '';
    document.getElementById('financeProject').value = finance.projectId || '';
    document.getElementById('financeContractor').value = finance.contractorId || '';
    document.getElementById('financeStatus').value = finance.status || 'paid';
    document.getElementById('financeDueDate').value = finance.dueDate || '';
    document.getElementById('dueDateGroup').style.display = finance.status === 'unpaid' ? 'block' : 'none';

    const takeCapitalGroup = document.getElementById('takeCapitalGroup');
    const contractorFieldGroup = document.getElementById('contractorFieldGroup');
    if (finance.type === 'income') {
        takeCapitalGroup.style.display = 'block';
        contractorFieldGroup.style.display = 'none';
    } else if (finance.type === 'expense') {
        takeCapitalGroup.style.display = 'none';
        contractorFieldGroup.style.display = 'block';
    } else {
        takeCapitalGroup.style.display = 'none';
        contractorFieldGroup.style.display = 'none';
    }

    window.openModal('addFinanceModal');
}

window.deleteFinance = async function(financeId) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
        await deleteDoc(doc(db, 'finances', financeId));
    } catch (error) {
        console.error('Error deleting transaction:', error);
        window.showNotification('Failed to delete transaction', 'error');
    }
}

window.handleFinanceSubmit = async function(event) {
    event.preventDefault();

    const financeId = document.getElementById('financeId').value;
    const type = document.getElementById('financeType').value;
    const takeCapital = type === 'income' ? document.getElementById('financeTakeCapital').checked : false;

    const financeData = {
        type: type,
        category: document.getElementById('financeCategory').value,
        description: document.getElementById('financeDescription').value,
        amount: parseFloat(document.getElementById('financeAmount').value),
        date: document.getElementById('financeDate').value,
        notes: document.getElementById('financeNotes').value || '',
        takeCapital: takeCapital,
        clientId: document.getElementById('financeClient').value || null,
        projectId: document.getElementById('financeProject').value || null,
        contractorId: type === 'expense' ? (document.getElementById('financeContractor').value || null) : null,
        status: document.getElementById('financeStatus').value || 'paid',
        dueDate: document.getElementById('financeDueDate').value || '',
        updatedAt: new Date().toISOString()
    };

    try {
        if (financeId) {
            await updateDoc(doc(db, 'finances', financeId), financeData);
        } else {
            financeData.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'finances'), financeData);
        }

        window.closeModal('addFinanceModal');
    } catch (error) {
        console.error('Error saving transaction:', error);
        window.showNotification('Failed to save transaction', 'error');
    }
}

window.openAddCapitalModal = function() {
    document.getElementById('capitalForm').reset();
    document.getElementById('capitalDate').value = new Date().toISOString().split('T')[0];
    window.openModal('addCapitalModal');
}

window.handleCapitalSubmit = async function(event) {
    event.preventDefault();

    const capitalData = {
        type: 'capital_injection',
        amount: parseFloat(document.getElementById('capitalAmount').value),
        date: document.getElementById('capitalDate').value,
        notes: document.getElementById('capitalNotes').value || '',
        description: 'Manual capital injection',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, 'finances'), capitalData);
        window.closeModal('addCapitalModal');
        window.showNotification('Capital added successfully', 'success');
    } catch (error) {
        console.error('Error adding capital:', error);
        window.showNotification('Failed to add capital', 'error');
    }
}

window.markAsPaid = async function(financeId) {
    try {
        await updateDoc(doc(db, 'finances', financeId), {
            status: 'paid',
            updatedAt: new Date().toISOString()
        });
        window.showNotification('Payment marked as paid ✓', 'success');
    } catch (error) {
        console.error('Error marking as paid:', error);
        window.showNotification('Failed to update payment status', 'error');
    }
}