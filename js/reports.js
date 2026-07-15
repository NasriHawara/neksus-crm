// Reports Module for CRM
// Requires Chart.js: <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

// Store chart instances to destroy them when updating
const chartInstances = {};

// Initialize reports page
window.loadReportsPage = function() {
    const content = document.getElementById('pageContent');
    const { clients, projects, tasks } = window.crmState;

    content.innerHTML = `
        <!-- Reports Header -->
        <div class="reports-header">
            <div class="reports-title-section">
                <h2>Business Reports & Analytics</h2>
                <p class="reports-subtitle">Comprehensive insights into your CRM data</p>
            </div>
            <div class="reports-actions">
                <select id="reportPeriod" class="report-period-select" onchange="updateReportPeriod(this.value)">
                    <option value="this-month">This Month</option>
                    <option value="last-month">Last Month</option>
                    <option value="this-quarter">This Quarter</option>
                    <option value="this-year">This Year</option>
                    <option value="all-time">All Time</option>
                </select>
                <button class="btn-primary" onclick="exportReportToPDF()" style="margin-left: 12px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Export PDF
                </button>
            </div>
        </div>

        <!-- Key Metrics Grid -->
        <div class="metrics-grid">
            <div class="metric-card blue">
                <div class="metric-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="1" x2="12" y2="23"/>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                </div>
                <div class="metric-info">
                    <p class="metric-label">Total Revenue</p>
                    <h3 class="metric-value" id="totalRevenue">$0</h3>
                    <p class="metric-change positive" id="revenueChange">+0%</p>
                </div>
            </div>

            <div class="metric-card green">
                <div class="metric-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                </div>
                <div class="metric-info">
                    <p class="metric-label">Active Clients</p>
                    <h3 class="metric-value" id="activeClients">0</h3>
                    <p class="metric-change positive" id="clientsChange">+0%</p>
                </div>
            </div>

            <div class="metric-card orange">
                <div class="metric-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <div class="metric-info">
                    <p class="metric-label">Active Projects</p>
                    <h3 class="metric-value" id="activeProjects">0</h3>
                    <p class="metric-change" id="projectsChange">0%</p>
                </div>
            </div>

            <div class="metric-card purple">
                <div class="metric-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                </div>
                <div class="metric-info">
                    <p class="metric-label">Completion Rate</p>
                    <h3 class="metric-value" id="completionRate">0%</h3>
                    <p class="metric-change positive" id="completionChange">+0%</p>
                </div>
            </div>
        </div>

        <!-- Charts Grid -->
        <div class="charts-grid">
            <!-- Revenue Chart -->
            <div class="card chart-card">
                <div class="card-header">
                    <h3>Revenue Over Time</h3>
                    <select id="revenueChartType" onchange="updateRevenueChart(this.value)" style="padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-color);">
                        <option value="line">Line Chart</option>
                        <option value="bar">Bar Chart</option>
                    </select>
                </div>
                <div class="chart-container">
                    <canvas id="revenueChart"></canvas>
                </div>
            </div>

            <!-- Project Status Chart -->
            <div class="card chart-card">
                <div class="card-header">
                    <h3>Projects by Status</h3>
                </div>
                <div class="chart-container">
                    <canvas id="projectStatusChart"></canvas>
                </div>
            </div>

            <!-- Task Priority Chart -->
            <div class="card chart-card">
                <div class="card-header">
                    <h3>Tasks by Priority</h3>
                </div>
                <div class="chart-container">
                    <canvas id="taskPriorityChart"></canvas>
                </div>
            </div>

            <!-- Client Growth Chart -->
            <div class="card chart-card">
                <div class="card-header">
                    <h3>Client Growth Trend</h3>
                </div>
                <div class="chart-container">
                    <canvas id="clientGrowthChart"></canvas>
                </div>
            </div>

            <!-- Income vs Expenses Chart -->
            <div class="card chart-card">
                <div class="card-header">
                    <h3>Income vs Expenses</h3>
                </div>
                <div class="chart-container">
                    <canvas id="pnlChart"></canvas>
                </div>
            </div>

            <!-- Top Clients Chart -->
            <div class="card chart-card">
                <div class="card-header">
                    <h3>Top 5 Clients by Revenue</h3>
                </div>
                <div class="chart-container">
                    <canvas id="topClientsChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Detailed Statistics Tables -->
        <div class="statistics-grid">
            <!-- Financial Summary -->
            <div class="card">
                <div class="card-header">
                    <h3>Financial Summary</h3>
                    <button class="btn-secondary" onclick="exportFinancialStats()">Export CSV</button>
                </div>
                <div id="financialStatsTable"></div>
            </div>

            <!-- Project Statistics -->
            <div class="card">
                <div class="card-header">
                    <h3>Project Performance</h3>
                    <button class="btn-secondary" onclick="exportProjectStats()">Export CSV</button>
                </div>
                <div id="projectStatsTable"></div>
            </div>
        </div>
    `;

    // Calculate and display metrics
    calculateMetrics();

    // Generate all charts
    setTimeout(() => {
        generateRevenueChart();
        generateProjectStatusChart();
        generateTaskPriorityChart();
        generateClientGrowthChart();
        generatePnlChart();
        generateTopClientsChart();
        generateFinancialStatsTable();
        generateProjectStatsTable();
    }, 100);
}

// Calculate key metrics
function calculateMetrics() {
    const { clients, projects, tasks, finances } = window.crmState;
    const period = document.getElementById('reportPeriod')?.value || 'this-month';
    
    // Get date range based on period
    const dateRange = getDateRange(period);
    
    // Filter data by date range
    const incomeRecords = (finances || []).filter(f => f.type === 'income');
    const filteredIncome = filterByDateRange(incomeRecords, dateRange, 'date');
    const filteredClients = filterByDateRange(clients, dateRange, 'createdAt');
    const filteredTasks = filterByDateRange(tasks, dateRange, 'createdAt');
    
    // Total Revenue
    const totalRevenue = filteredIncome.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    
    // Revenue change (compare with previous period)
    const prevDateRange = getPreviousDateRange(period);
    const prevIncome = filterByDateRange(incomeRecords, prevDateRange, 'date');
    const prevRevenue = prevIncome.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : 0;
    updateMetricChange('revenueChange', revenueChange);
    
    // Active Clients
    const activeClientsCount = filteredClients.length;
    document.getElementById('activeClients').textContent = activeClientsCount;
    
    const prevClients = filterByDateRange(clients, prevDateRange, 'createdAt');
    const clientsChange = prevClients.length > 0 ? ((activeClientsCount - prevClients.length) / prevClients.length * 100).toFixed(1) : 0;
    updateMetricChange('clientsChange', clientsChange);
    
    // Active Projects
    const activeProjectsCount = projects.filter(p => p.status === 'active').length;
    document.getElementById('activeProjects').textContent = activeProjectsCount;
    
    // Completion Rate (tasks)
    const completedTasks = filteredTasks.filter(t => t.status === 'done').length;
    const totalTasks = filteredTasks.length;
    const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;
    document.getElementById('completionRate').textContent = completionRate + '%';
}

// Update metric change display
function updateMetricChange(elementId, changeValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const isPositive = changeValue >= 0;
    element.className = `metric-change ${isPositive ? 'positive' : 'negative'}`;
    element.textContent = `${isPositive ? '+' : ''}${changeValue}%`;
}

// Generate Revenue Chart
function generateRevenueChart(type = 'line') {
    const { finances } = window.crmState;
    const incomeRecords = (finances || []).filter(f => f.type === 'income');
    const period = document.getElementById('reportPeriod')?.value || 'this-month';
    const dateRange = getDateRange(period);
    const filteredIncome = filterByDateRange(incomeRecords, dateRange, 'date');
    
    // Group by month
    const revenueByMonth = {};
    filteredIncome.forEach(f => {
        const date = new Date(f.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + (parseFloat(f.amount) || 0);
    });
    
    // Sort by date
    const sortedMonths = Object.keys(revenueByMonth).sort();
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    const data = sortedMonths.map(m => revenueByMonth[m]);
    
    // Destroy existing chart
    if (chartInstances.revenueChart) {
        chartInstances.revenueChart.destroy();
    }
    
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    chartInstances.revenueChart = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue',
                data: data,
                backgroundColor: type === 'bar' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                fill: type === 'line',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Revenue: ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Update revenue chart type
window.updateRevenueChart = function(type) {
    generateRevenueChart(type);
}

// Generate Project Status Chart
function generateProjectStatusChart() {
    const { projects } = window.crmState;
    
    const statusCounts = {
        'active': 0,
        'completed': 0,
        'on-hold': 0,
        'planning': 0
    };
    
    projects.forEach(p => {
        const status = p.status || 'planning';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    if (chartInstances.projectStatusChart) {
        chartInstances.projectStatusChart.destroy();
    }
    
    const ctx = document.getElementById('projectStatusChart');
    if (!ctx) return;
    
    chartInstances.projectStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Completed', 'On Hold', 'Planning'],
            datasets: [{
                data: [statusCounts.active, statusCounts.completed, statusCounts['on-hold'], statusCounts.planning],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(251, 146, 60, 0.8)',
                    'rgba(168, 85, 247, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Generate Task Priority Chart
function generateTaskPriorityChart() {
    const { tasks } = window.crmState;
    
    const priorityCounts = {
        'high': 0,
        'medium': 0,
        'low': 0
    };
    
    tasks.forEach(t => {
        const priority = t.priority || 'medium';
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });
    
    if (chartInstances.taskPriorityChart) {
        chartInstances.taskPriorityChart.destroy();
    }
    
    const ctx = document.getElementById('taskPriorityChart');
    if (!ctx) return;
    
    chartInstances.taskPriorityChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['High Priority', 'Medium Priority', 'Low Priority'],
            datasets: [{
                data: [priorityCounts.high, priorityCounts.medium, priorityCounts.low],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(251, 146, 60, 0.8)',
                    'rgba(59, 130, 246, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Generate Client Growth Chart
function generateClientGrowthChart() {
    const { clients } = window.crmState;
    
    // Group clients by month
    const clientsByMonth = {};
    clients.forEach(client => {
        if (client.createdAt) {
            const date = new Date(client.createdAt);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            clientsByMonth[monthKey] = (clientsByMonth[monthKey] || 0) + 1;
        }
    });
    
    // Calculate cumulative growth
    const sortedMonths = Object.keys(clientsByMonth).sort();
    let cumulative = 0;
    const cumulativeData = sortedMonths.map(month => {
        cumulative += clientsByMonth[month];
        return cumulative;
    });
    
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    
    if (chartInstances.clientGrowthChart) {
        chartInstances.clientGrowthChart.destroy();
    }
    
    const ctx = document.getElementById('clientGrowthChart');
    if (!ctx) return;
    
    chartInstances.clientGrowthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Clients',
                data: cumulativeData,
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Generate Income vs Expenses (P&L) Chart
function generatePnlChart() {
    const { finances } = window.crmState;
    const period = document.getElementById('reportPeriod')?.value || 'this-month';
    const dateRange = getDateRange(period);
    const filtered = filterByDateRange((finances || []).filter(f => f.type === 'income' || f.type === 'expense'), dateRange, 'date');

    // Group by month
    const incomeByMonth = {};
    const expenseByMonth = {};
    filtered.forEach(f => {
        const date = new Date(f.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (f.type === 'income') {
            incomeByMonth[monthKey] = (incomeByMonth[monthKey] || 0) + (parseFloat(f.amount) || 0);
        } else {
            expenseByMonth[monthKey] = (expenseByMonth[monthKey] || 0) + (parseFloat(f.amount) || 0);
        }
    });

    const sortedMonths = [...new Set([...Object.keys(incomeByMonth), ...Object.keys(expenseByMonth)])].sort();
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    const incomeData = sortedMonths.map(m => incomeByMonth[m] || 0);
    const expenseData = sortedMonths.map(m => expenseByMonth[m] || 0);

    if (chartInstances.pnlChart) {
        chartInstances.pnlChart.destroy();
    }

    const ctx = document.getElementById('pnlChart');
    if (!ctx) return;

    chartInstances.pnlChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderWidth: 0
                },
                {
                    label: 'Expenses',
                    data: expenseData,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Generate Top Clients Chart
function generateTopClientsChart() {
    const { clients, finances } = window.crmState;
    
    // Calculate revenue per client from income transactions
    const revenueByClient = {};
    (finances || []).filter(f => f.type === 'income').forEach(f => {
        if (f.clientId) {
            revenueByClient[f.clientId] = (revenueByClient[f.clientId] || 0) + (parseFloat(f.amount) || 0);
        }
    });
    
    // Get top 5 clients
    const topClients = Object.entries(revenueByClient)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const labels = topClients.map(([clientId]) => window.getClientName(clientId) || 'Unknown');
    
    const data = topClients.map(([, revenue]) => revenue);
    
    if (chartInstances.topClientsChart) {
        chartInstances.topClientsChart.destroy();
    }
    
    const ctx = document.getElementById('topClientsChart');
    if (!ctx) return;
    
    chartInstances.topClientsChart = new Chart(ctx, {
        type: 'horizontalBar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue',
                data: data,
                backgroundColor: 'rgba(168, 85, 247, 0.8)',
                borderWidth: 0
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Revenue: ' + formatCurrency(context.parsed.x);
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Generate Financial Summary Table
function generateFinancialStatsTable() {
    const { finances } = window.crmState;
    const period = document.getElementById('reportPeriod')?.value || 'this-month';
    const dateRange = getDateRange(period);
    const filtered = filterByDateRange(finances || [], dateRange, 'date');
    
    const income = filtered.filter(f => f.type === 'income');
    const expenses = filtered.filter(f => f.type === 'expense');
    const unpaid = filtered.filter(f => f.status === 'unpaid');
    
    const stats = {
        totalIncome: income.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0),
        incomeCount: income.length,
        totalExpenses: expenses.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0),
        expenseCount: expenses.length,
        unpaidCount: unpaid.length,
        unpaidAmount: unpaid.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0)
    };
    const netProfit = stats.totalIncome - stats.totalExpenses;
    
    const container = document.getElementById('financialStatsTable');
    if (!container) return;
    
    container.innerHTML = `
        <div class="stats-table">
            <div class="stats-row">
                <div class="stats-cell success">
                    <span class="stats-label">Income</span>
                    <span class="stats-value">${stats.incomeCount}</span>
                    <span class="stats-amount">${formatCurrency(stats.totalIncome)}</span>
                </div>
                <div class="stats-cell danger">
                    <span class="stats-label">Expenses</span>
                    <span class="stats-value">${stats.expenseCount}</span>
                    <span class="stats-amount">${formatCurrency(stats.totalExpenses)}</span>
                </div>
            </div>
            <div class="stats-row">
                <div class="stats-cell ${netProfit >= 0 ? 'success' : 'danger'}">
                    <span class="stats-label">Net Profit</span>
                    <span class="stats-amount">${netProfit >= 0 ? '+' : ''}${formatCurrency(netProfit)}</span>
                </div>
                <div class="stats-cell warning">
                    <span class="stats-label">Unpaid</span>
                    <span class="stats-value">${stats.unpaidCount}</span>
                    <span class="stats-amount">${formatCurrency(stats.unpaidAmount)}</span>
                </div>
            </div>
        </div>
    `;
}

// Generate Project Statistics Table
function generateProjectStatsTable() {
    const { projects, tasks } = window.crmState;
    
    const projectStats = projects.map(project => {
        const projectTasks = tasks.filter(t => t.projectId === project.id);
        const completedTasks = projectTasks.filter(t => t.status === 'done').length;
        const completionRate = projectTasks.length > 0 ? ((completedTasks / projectTasks.length) * 100).toFixed(1) : 0;
        
        return {
            name: project.name,
            status: project.status || 'planning',
            tasks: projectTasks.length,
            completed: completedTasks,
            completionRate: completionRate
        };
    }).sort((a, b) => b.completionRate - a.completionRate);
    
    const container = document.getElementById('projectStatsTable');
    if (!container) return;
    
    if (projectStats.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No projects found</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Project Name</th>
                        <th>Status</th>
                        <th>Tasks</th>
                        <th>Completed</th>
                        <th>Progress</th>
                    </tr>
                </thead>
                <tbody>
                    ${projectStats.map(project => `
                        <tr>
                            <td><strong>${project.name}</strong></td>
                            <td><span class="badge ${getStatusBadgeClass(project.status)}">${project.status}</span></td>
                            <td>${project.tasks}</td>
                            <td>${project.completed}</td>
                            <td>
                                <div class="progress-bar-container">
                                    <div class="progress-bar" style="width: ${project.completionRate}%"></div>
                                    <span class="progress-text">${project.completionRate}%</span>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Helper: Get status badge class
function getStatusBadgeClass(status) {
    const classes = {
        'active': 'success',
        'completed': 'info',
        'on-hold': 'warning',
        'planning': 'secondary'
    };
    return classes[status] || 'secondary';
}

// Helper: Get date range based on period
function getDateRange(period) {
    const now = new Date();
    let startDate, endDate = new Date();
    
    switch(period) {
        case 'this-month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'last-month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'this-quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            break;
        case 'this-year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'all-time':
            startDate = new Date(2000, 0, 1);
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    return { startDate, endDate };
}

// Helper: Get previous date range
function getPreviousDateRange(period) {
    const now = new Date();
    let startDate, endDate;
    
    switch(period) {
        case 'this-month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'last-month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            endDate = new Date(now.getFullYear(), now.getMonth() - 1, 0);
            break;
        case 'this-quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
            endDate = new Date(now.getFullYear(), quarter * 3, 0);
            break;
        case 'this-year':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31);
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    }
    
    return { startDate, endDate };
}

// Helper: Filter array by date range
function filterByDateRange(array, dateRange, dateField) {
    return array.filter(item => {
        if (!item[dateField]) return false;
        const itemDate = new Date(item[dateField]);
        return itemDate >= dateRange.startDate && itemDate <= dateRange.endDate;
    });
}

// Update report period
window.updateReportPeriod = function(period) {
    calculateMetrics();
    generateRevenueChart();
    generateFinancialStatsTable();
    
    if (typeof window.showNotification === 'function') {
        window.showNotification(`Report updated for: ${period.replace('-', ' ')}`, 'info');
    }
}

// Export Financial Statistics to CSV
window.exportFinancialStats = function() {
    const { finances } = window.crmState;
    const period = document.getElementById('reportPeriod')?.value || 'this-month';
    const dateRange = getDateRange(period);
    const filtered = filterByDateRange(finances || [], dateRange, 'date');
    
    const csvData = filtered.map(f => ({
        'Date': formatDate(f.date),
        'Type': f.type || 'N/A',
        'Category': f.category || 'Uncategorized',
        'Client': f.clientId ? window.getClientName(f.clientId) : 'N/A',
        'Project': f.projectId ? window.getProjectName(f.projectId) : 'N/A',
        'Amount': parseFloat(f.amount) || 0,
        'Status': f.status || 'paid'
    }));
    
    if (typeof window.exportToCSV === 'function') {
        window.exportToCSV(csvData, `financial-summary-${period}.csv`);
    } else {
        alert('Export function not available');
    }
}

// Export Project Statistics to CSV
window.exportProjectStats = function() {
    const { projects, tasks } = window.crmState;
    
    const csvData = projects.map(project => {
        const projectTasks = tasks.filter(t => t.projectId === project.id);
        const completedTasks = projectTasks.filter(t => t.status === 'done').length;
        const completionRate = projectTasks.length > 0 ? ((completedTasks / projectTasks.length) * 100).toFixed(1) : 0;
        
        return {
            'Project Name': project.name,
            'Status': project.status || 'planning',
            'Total Tasks': projectTasks.length,
            'Completed Tasks': completedTasks,
            'Completion Rate': completionRate + '%'
        };
    });
    
    if (typeof window.exportToCSV === 'function') {
        window.exportToCSV(csvData, 'project-stats.csv');
    } else {
        alert('Export function not available');
    }
}

// Export Report to PDF (simplified version - requires jsPDF library)
window.exportReportToPDF = function() {
    alert('PDF export requires jsPDF library. Add this to your HTML:\
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>\
\
Then this function will generate a PDF report.');
    
    // TODO: Implement PDF export with jsPDF
    // const { jsPDF } = window.jspdf;
    // const doc = new jsPDF();
    // doc.text('CRM Report', 10, 10);
    // doc.save('crm-report.pdf');
}

// Helper: Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

// Helper: Format date
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}