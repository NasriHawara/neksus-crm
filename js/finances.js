import { db, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot } from './firebase-config.js';



// Store unsubscribe function for real-time listener
let unsubscribeFinances = null;

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

            // Show notifications after initial load
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

            
            // Refresh finances page if currently viewing it
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

    // Calculate totals
    const totalIncome = finances
        .filter(f => f.type === 'income')
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
    
    // Calculate capital portion from income (20% from income transactions with takeCapital flag)
    const capitalFromIncome = finances
        .filter(f => f.type === 'income' && f.takeCapital === true)
        .reduce((sum, f) => sum + (parseFloat(f.amount) * 0.2 || 0), 0);
    
    const totalExpenses = finances
        .filter(f => f.type === 'expense')
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
    
    // Capital = 20% of income - expenses (expenses are paid from capital)
    const capital = capitalFromIncome - totalExpenses;
    
    // Net Profit = 80% of income with takeCapital (expenses don't affect net profit)
    const netProfitFromCapitalIncome = finances
        .filter(f => f.type === 'income' && f.takeCapital === true)
        .reduce((sum, f) => sum + (parseFloat(f.amount) * 0.8 || 0), 0);
    
    // Add any income that doesn't have takeCapital flag (goes 100% to net profit)
    const netProfitFromOtherIncome = finances
        .filter(f => f.type === 'income' && f.takeCapital !== true)
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
    
    const netProfit = netProfitFromCapitalIncome + netProfitFromOtherIncome;

    // Get recent transactions (last 10)
    const recentTransactions = [...finances]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);

    // Category breakdown
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

    content.innerHTML = `
        <div class="finances-header">
            <div class="filters">
                <select id="financeTypeFilter" onchange="window.filterFinances()">
                    <option value="all">All Transactions</option>
                    <option value="income">Income Only</option>
                    <option value="expense">Expenses Only</option>
                </select>
                <select id="financeCategoryFilter" onchange="window.filterFinances()">
                    <option value="all">All Categories</option>
                    ${getUniqueCategories().map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>
                <input type="month" id="financeMonthFilter" onchange="window.filterFinances()">
            </div>
            <button class="primary-button" onclick="window.openAddFinanceModal()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Transaction
            </button>
        </div>

        <!-- Summary Cards -->
        <div class="stats-grid">
            <div class="stat-card success">
                <div class="stat-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                </div>
                <div class="stat-details">
                    <div class="stat-label">Total Income</div>
                    <div class="stat-value">$${totalIncome.toFixed(2)}</div>
                </div>
            </div>

            <div class="stat-card danger">
                <div class="stat-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                    </svg>
                </div>
                <div class="stat-details">
                    <div class="stat-label">Total Expenses</div>
                    <div class="stat-value">$${totalExpenses.toFixed(2)}</div>
                </div>
            </div>

            <div class="stat-card ${netProfit >= 0 ? 'info' : 'warning'}">
                <div class="stat-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="1" x2="12" y2="23"/>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                </div>
                <div class="stat-details">
                    <div class="stat-label">Net Profit/Loss</div>
                    <div class="stat-value" style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">
                        ${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}
                    </div>
                </div>
            </div>

            <div class="stat-card info">
                <div class="stat-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                </div>
                <div class="stat-details">
                    <div class="stat-label">Capital (20%)</div>
                    <div class="stat-value">$${capital.toFixed(2)}</div>
                </div>
            </div>
        </div>

        <!-- Category Breakdown -->
        <div class="card">
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

        <!-- Recent Transactions -->
        <div class="card">
            <div class="card-header">
                <h3>Recent Transactions</h3>
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
                                <th>Category</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="financeTableBody">
                            ${renderFinanceRows(recentTransactions)}
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
    `;

    // Set default date to today
    const dateInput = document.getElementById('financeDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Function to update categories based on type
    function updateCategories() {
        const type = document.getElementById('financeType').value;
        const categorySelect = document.getElementById('financeCategory');
        
        const incomeCategories = ['Development', 'Marketing', 'Design', 'Other Income'];
        const expenseCategories = ['Software', 'Marketing', 'Utilities', 'Salaries', 'Other Expense'];
        
        const categories = type === 'income' ? incomeCategories : expenseCategories;
        
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }

    // Add event listener to show/hide Take Capital checkbox and update categories based on type
    const typeSelect = document.getElementById('financeType');
    if (typeSelect) {
        typeSelect.addEventListener('change', function() {
            const takeCapitalGroup = document.getElementById('takeCapitalGroup');
            if (this.value === 'income') {
                takeCapitalGroup.style.display = 'block';
            } else {
                takeCapitalGroup.style.display = 'none';
                document.getElementById('financeTakeCapital').checked = false;
            }
            
            // Update categories when type changes
            updateCategories();
        });
        
        // Initialize categories and trigger change event on load
        updateCategories();
        typeSelect.dispatchEvent(new Event('change'));
    }
}

// Render finance table rows
function renderFinanceRows(transactions) {
    return transactions.map(finance => `
        <tr>
            <td>${formatDate(finance.date)}</td>
            <td>
                <span class="badge ${finance.type === 'income' ? 'success' : 'danger'}">
                    ${finance.type === 'income' ? '↑ Income' : '↓ Expense'}
                </span>
            </td>
            <td>${finance.category || 'Uncategorized'}</td>
            <td>${finance.description}</td>
            <td class="${finance.type === 'income' ? 'income-amount' : 'expense-amount'}">
                ${finance.type === 'income' ? '+' : '-'}$${parseFloat(finance.amount).toFixed(2)}
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

// Get unique categories
function getUniqueCategories() {
    const finances = window.crmState.finances || [];
    const categories = finances.map(f => f.category).filter(Boolean);
    return [...new Set(categories)].sort();
}

// Filter finances
window.filterFinances = function() {
    const typeFilter = document.getElementById('financeTypeFilter')?.value || 'all';
    const categoryFilter = document.getElementById('financeCategoryFilter')?.value || 'all';
    const monthFilter = document.getElementById('financeMonthFilter')?.value || '';

    let filtered = [...window.crmState.finances];

    // Filter by type
    if (typeFilter !== 'all') {
        filtered = filtered.filter(f => f.type === typeFilter);
    }

    // Filter by category
    if (categoryFilter !== 'all') {
        filtered = filtered.filter(f => f.category === categoryFilter);
    }

    // Filter by month
    if (monthFilter) {
        filtered = filtered.filter(f => {
            const financeMonth = new Date(f.date).toISOString().slice(0, 7);
            return financeMonth === monthFilter;
        });
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Update table
    const tbody = document.getElementById('financeTableBody');
    if (tbody) {
        tbody.innerHTML = renderFinanceRows(filtered);
    }
}

// Open add finance modal
window.openAddFinanceModal = function() {
    document.getElementById('financeModalTitle').textContent = 'Add Transaction';
    document.getElementById('financeForm').reset();
    document.getElementById('financeId').value = '';
    document.getElementById('financeDate').value = new Date().toISOString().split('T')[0];
    window.openModal('addFinanceModal');
}

// Edit finance
window.editFinance = async function(financeId) {
    const finance = window.crmState.finances.find(f => f.id === financeId);
    if (!finance) return;

    document.getElementById('financeModalTitle').textContent = 'Edit Transaction';
    document.getElementById('financeId').value = finance.id;
    document.getElementById('financeType').value = finance.type;
    document.getElementById('financeCategory').value = finance.category;
    document.getElementById('financeDescription').value = finance.description;
    document.getElementById('financeAmount').value = finance.amount;
    document.getElementById('financeDate').value = finance.date;
    document.getElementById('financeNotes').value = finance.notes || '';
    document.getElementById('financeTakeCapital').checked = finance.takeCapital || false;

    // Show/hide Take Capital based on type
    const takeCapitalGroup = document.getElementById('takeCapitalGroup');
    if (finance.type === 'income') {
        takeCapitalGroup.style.display = 'block';
    } else {
        takeCapitalGroup.style.display = 'none';
    }

    window.openModal('addFinanceModal');
}

// Delete finance
window.deleteFinance = async function(financeId) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
        await deleteDoc(doc(db, 'finances', financeId));
        // Real-time listener will handle the update
    } catch (error) {
        console.error('Error deleting transaction:', error);
        window.showNotification('Failed to delete transaction', 'error');
    }
}

// Handle finance form submission
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
        updatedAt: new Date().toISOString()
    };

    try {
        if (financeId) {
            // Update existing transaction
            await updateDoc(doc(db, 'finances', financeId), financeData);
        } else {
            // Add new transaction
            financeData.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'finances'), financeData);
        }

        window.closeModal('addFinanceModal');
        // Real-time listener will handle the update
    } catch (error) {
        console.error('Error saving transaction:', error);
        window.showNotification('Failed to save transaction', 'error');
    }
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}
