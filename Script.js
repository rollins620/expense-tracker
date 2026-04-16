// ===== USER MANAGEMENT SYSTEM =====
class UserManager {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('expenseflow_users')) || [];
        this.currentUser = JSON.parse(localStorage.getItem('expenseflow_currentUser')) || null;
        this.verificationCodes = new Map();
    }

    // Generate user ID
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Hash password (simple implementation - in production use proper hashing)
    hashPassword(password) {
        return btoa(password); // Simple base64 encoding for demo
    }

    // Generate verification code
    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Send verification code (simulated)
    sendVerificationCode(email, code) {
        // In a real app, this would send an email
        console.log(`Verification code for ${email}: ${code}`);
        // Store code with timestamp
        this.verificationCodes.set(email, {
            code: code,
            timestamp: Date.now(),
            attempts: 0
        });
        
        // Remove code after 10 minutes
        setTimeout(() => {
            this.verificationCodes.delete(email);
        }, 10 * 60 * 1000);
        
        return true;
    }

    // Register new user
    registerUser(name, email, password) {
        // Check if user already exists
        if (this.users.find(user => user.email === email)) {
            return { success: false, message: 'User with this email already exists' };
        }

        // Validate password strength
        if (password.length < 6) {
            return { success: false, message: 'Password must be at least 6 characters long' };
        }

        const user = {
            id: this.generateUserId(),
            name: name,
            email: email,
            password: this.hashPassword(password),
            createdAt: new Date().toISOString(),
            lastLogin: null,
            settings: {
                currency: 'KES',
                savingsGoal: 25000,
                theme: 'light'
            }
        };

        this.users.push(user);
        localStorage.setItem('expenseflow_users', JSON.stringify(this.users));
        
        return { success: true, message: 'Account created successfully!', user: user };
    }

    // Login user
    loginUser(email, password, rememberMe = false) {
        const user = this.users.find(user => user.email === email);
        
        if (!user) {
            return { success: false, message: 'Invalid email or password' };
        }

        if (user.password !== this.hashPassword(password)) {
            return { success: false, message: 'Invalid email or password' };
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        localStorage.setItem('expenseflow_users', JSON.stringify(this.users));
        
        // Set current user
        this.currentUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            settings: user.settings
        };
        
        if (rememberMe) {
            localStorage.setItem('expenseflow_rememberMe', 'true');
            localStorage.setItem('expenseflow_rememberedEmail', email);
        } else {
            localStorage.removeItem('expenseflow_rememberMe');
            localStorage.removeItem('expenseflow_rememberedEmail');
        }
        
        localStorage.setItem('expenseflow_currentUser', JSON.stringify(this.currentUser));
        
        return { success: true, message: 'Login successful!', user: this.currentUser };
    }

    // Reset password
    resetPassword(email, code, newPassword) {
        const verification = this.verificationCodes.get(email);
        
        if (!verification) {
            return { success: false, message: 'Verification code expired or invalid' };
        }

        if (verification.code !== code) {
            verification.attempts++;
            if (verification.attempts >= 3) {
                this.verificationCodes.delete(email);
                return { success: false, message: 'Too many failed attempts. Please request a new code.' };
            }
            return { success: false, message: 'Invalid verification code' };
        }

        if (newPassword.length < 6) {
            return { success: false, message: 'Password must be at least 6 characters long' };
        }

        const user = this.users.find(user => user.email === email);
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        user.password = this.hashPassword(newPassword);
        localStorage.setItem('expenseflow_users', JSON.stringify(this.users));
        
        // Clear verification code
        this.verificationCodes.delete(email);
        
        return { success: true, message: 'Password reset successfully!' };
    }

    // Update user profile
    updateUserProfile(userId, updates) {
        const user = this.users.find(user => user.id === userId);
        if (!user) return { success: false, message: 'User not found' };

        if (updates.name) user.name = updates.name;
        if (updates.settings) user.settings = { ...user.settings, ...updates.settings };
        
        localStorage.setItem('expenseflow_users', JSON.stringify(this.users));
        
        // Update current user if it's the same user
        if (this.currentUser && this.currentUser.id === userId) {
            this.currentUser = { ...this.currentUser, ...updates };
            localStorage.setItem('expenseflow_currentUser', JSON.stringify(this.currentUser));
        }
        
        return { success: true, message: 'Profile updated successfully!', user: user };
    }

    // Change password
    changePassword(userId, currentPassword, newPassword) {
        const user = this.users.find(user => user.id === userId);
        if (!user) return { success: false, message: 'User not found' };

        if (user.password !== this.hashPassword(currentPassword)) {
            return { success: false, message: 'Current password is incorrect' };
        }

        if (newPassword.length < 6) {
            return { success: false, message: 'Password must be at least 6 characters long' };
        }

        user.password = this.hashPassword(newPassword);
        localStorage.setItem('expenseflow_users', JSON.stringify(this.users));
        
        return { success: true, message: 'Password changed successfully!' };
    }

    // Logout user
    logout() {
        this.currentUser = null;
        localStorage.removeItem('expenseflow_currentUser');
        return { success: true, message: 'Logged out successfully' };
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if user is logged in
    isLoggedIn() {
        return !!this.currentUser;
    }
}

// ===== APPLICATION STATE =====
const userManager = new UserManager();
let expenses = [];
let incomes = {};
let savings = 0;
let charts = {};
let analyzer = null;

// ===== INITIALIZATION =====
function initializeApp() {
    checkAuth();
    setupEventListeners();
    
    // Add demo account if no users exist
    if (userManager.users.length === 0) {
        userManager.registerUser('Demo User', 'demo@expenseflow.com', 'demo123');
    }
}

// ===== AUTHENTICATION FUNCTIONS =====
function checkAuth() {
    const currentUser = userManager.getCurrentUser();
    
    if (!currentUser) {
        document.getElementById("login-page").style.display = "flex";
        document.getElementById("app-page").style.display = "none";
        
        // Load remembered email
        const rememberedEmail = localStorage.getItem('expenseflow_rememberedEmail');
        if (rememberedEmail) {
            document.getElementById("login-email").value = rememberedEmail;
            document.getElementById("remember-me").checked = true;
        }
    } else {
        document.getElementById("login-page").style.display = "none";
        document.getElementById("app-page").style.display = "block";
        updateUserInterface(currentUser);
        loadUserData(currentUser.id);
    }
}

function updateUserInterface(user) {
    document.getElementById("current-user").textContent = `Welcome, ${user.name}`;
    document.getElementById("user-email").textContent = user.email;
    
    // Generate initials for avatar
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById("user-initials").textContent = initials.substring(0, 2);
}

// ===== MODAL FUNCTIONS =====
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    clearModalForms(modalId);
}

function clearModalForms(modalId) {
    const modal = document.getElementById(modalId);
    const inputs = modal.querySelectorAll('input');
    inputs.forEach(input => {
        input.value = '';
        input.classList.remove('error');
    });
    
    // Reset password strength bars
    const strengthBars = modal.querySelectorAll('.strength-bar');
    strengthBars.forEach(bar => bar.classList.remove('weak', 'medium', 'strong'));
}

function showRegister() {
    showModal('register-modal');
}

function showForgotPassword() {
    showModal('forgot-password-modal');
}

function showUserSettings() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    document.getElementById('settings-name').value = currentUser.name;
    document.getElementById('settings-email').value = currentUser.email;
    
    // Load savings goal if it exists
    if (currentUser.settings && currentUser.settings.savingsGoal) {
        document.getElementById('settings-savings-goal').value = currentUser.settings.savingsGoal;
    } else {
        document.getElementById('settings-savings-goal').value = 25000; // Default value
    }
    
    showModal('settings-modal');
}

// ===== EVENT LISTENERS SETUP =====
function setupEventListeners() {
    // Login form
    document.getElementById("login-form").addEventListener("submit", handleLogin);
    
    // Registration form
    document.getElementById("register-form").addEventListener("submit", handleRegister);
    
    // Forgot password form
    document.getElementById("forgot-password-form").addEventListener("submit", handlePasswordReset);
    
    // Settings form
    document.getElementById("settings-form").addEventListener("submit", handleSettingsUpdate);
    
    // Password strength indicator
    const passwordInput = document.getElementById('register-password');
    if (passwordInput) {
        passwordInput.addEventListener('input', updatePasswordStrength);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (document.getElementById("name-input")?.value) {
                addExpense();
            }
        }
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            if (document.getElementById("income-input")?.value) {
                addIncome();
            }
        }
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            downloadPDFReport();
        }
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal.active');
            modals.forEach(modal => modal.classList.remove('active'));
        }
    });
    
    // Enter key support for forms
    const addEnterKeySupport = (inputId, callback) => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    callback();
                }
            });
        }
    };
    
    addEnterKeySupport('name-input', addExpense);
    addEnterKeySupport('income-input', addIncome);
    addEnterKeySupport('savings-input', addToSavings);
}

// ===== PASSWORD STRENGTH CHECKER =====
function updatePasswordStrength() {
    const password = document.getElementById('register-password').value;
    const strengthBars = document.querySelectorAll('.strength-bar');
    
    // Reset all bars
    strengthBars.forEach(bar => {
        bar.classList.remove('weak', 'medium', 'strong');
    });
    
    if (password.length === 0) return;
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    for (let i = 0; i < strengthBars.length; i++) {
        if (i < strength) {
            if (strength === 1) strengthBars[i].classList.add('weak');
            else if (strength === 2) strengthBars[i].classList.add('medium');
            else if (strength >= 3) strengthBars[i].classList.add('strong');
        }
    }
}

// ===== AUTHENTICATION HANDLERS =====
function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const rememberMe = document.getElementById("remember-me").checked;
    
    const result = userManager.loginUser(email, password, rememberMe);
    
    if (result.success) {
        showNotification(result.message, "success");
        setTimeout(() => {
            document.getElementById("login-email").value = "";
            document.getElementById("login-password").value = "";
            checkAuth();
        }, 1000);
    } else {
        showNotification(result.message, "error");
    }
}

function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("register-confirm-password").value;
    const acceptTerms = document.getElementById("accept-terms").checked;
    
    // Validation
    if (!name) {
        showNotification("Please enter your full name", "error");
        return;
    }
    
    if (!email.includes('@')) {
        showNotification("Please enter a valid email address", "error");
        return;
    }
    
    if (password.length < 6) {
        showNotification("Password must be at least 6 characters long", "error");
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification("Passwords do not match", "error");
        return;
    }
    
    if (!acceptTerms) {
        showNotification("Please accept the terms and conditions", "error");
        return;
    }
    
    const result = userManager.registerUser(name, email, password);
    
    if (result.success) {
        showNotification(result.message, "success");
        closeModal('register-modal');
        
        // Auto login after registration
        setTimeout(() => {
            const loginResult = userManager.loginUser(email, password);
            if (loginResult.success) {
                checkAuth();
            }
        }, 1500);
    } else {
        showNotification(result.message, "error");
    }
}

function handlePasswordReset(e) {
    e.preventDefault();
    
    const email = document.getElementById("reset-email").value.trim();
    const code = document.getElementById("reset-code").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-new-password").value;
    
    if (!email.includes('@')) {
        showNotification("Please enter a valid email address", "error");
        return;
    }
    
    if (!code) {
        showNotification("Please enter the verification code", "error");
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification("Password must be at least 6 characters long", "error");
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification("Passwords do not match", "error");
        return;
    }
    
    const result = userManager.resetPassword(email, code, newPassword);
    
    if (result.success) {
        showNotification(result.message, "success");
        closeModal('forgot-password-modal');
    } else {
        showNotification(result.message, "error");
    }
}

function handleSettingsUpdate(e) {
    e.preventDefault();
    
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const name = document.getElementById("settings-name").value.trim();
    const savingsGoal = parseFloat(document.getElementById("settings-savings-goal").value);
    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("settings-new-password").value;
    const confirmPassword = document.getElementById("settings-confirm-password").value;
    
    const updates = {
        settings: {}
    };
    
    // Update name if changed
    if (name && name !== currentUser.name) {
        updates.name = name;
    }
    
    // Update savings goal if provided and valid
    if (!isNaN(savingsGoal) && savingsGoal >= 0) {
        updates.settings.savingsGoal = savingsGoal;
    }
    
    // Update password if provided
    if (currentPassword || newPassword || confirmPassword) {
        if (!currentPassword) {
            showNotification("Please enter your current password", "error");
            return;
        }
        
        if (!newPassword) {
            showNotification("Please enter a new password", "error");
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showNotification("New passwords do not match", "error");
            return;
        }
        
        if (newPassword.length < 6) {
            showNotification("New password must be at least 6 characters long", "error");
            return;
        }
        
        const passwordResult = userManager.changePassword(currentUser.id, currentPassword, newPassword);
        if (!passwordResult.success) {
            showNotification(passwordResult.message, "error");
            return;
        }
    }
    
    // Apply updates
    if (Object.keys(updates).length > 0 || Object.keys(updates.settings).length > 0) {
        // If settings object is empty, remove it
        if (Object.keys(updates.settings).length === 0) {
            delete updates.settings;
        }
        
        const result = userManager.updateUserProfile(currentUser.id, updates);
        if (result.success) {
            showNotification("Settings updated successfully!", "success");
            updateUserInterface(result.user);
            
            // Refresh insights with new savings goal
            if (analyzer) {
                analyzer.generateInsights();
            }
            updateDashboard();
            
            closeModal('settings-modal');
        } else {
            showNotification(result.message, "error");
        }
    } else {
        showNotification("No changes made", "info");
        closeModal('settings-modal');
    }
}

// ===== VERIFICATION CODE FUNCTIONS =====
function sendVerificationCode() {
    const email = document.getElementById("reset-email").value.trim();
    
    if (!email.includes('@')) {
        showNotification("Please enter a valid email address", "error");
        return;
    }
    
    // Check if user exists
    const userExists = userManager.users.find(user => user.email === email);
    if (!userExists) {
        showNotification("No account found with this email", "error");
        return;
    }
    
    const code = userManager.generateVerificationCode();
    const sent = userManager.sendVerificationCode(email, code);
    
    if (sent) {
        showNotification("Verification code sent to your email", "success");
        document.getElementById("reset-code").disabled = false;
        document.getElementById("new-password").disabled = false;
        document.getElementById("confirm-new-password").disabled = false;
        document.getElementById("reset-password-btn").disabled = false;
    }
}

// ===== DATA MANAGEMENT =====
function getUserDataKey(userId, dataType) {
    return `expenseflow_${userId}_${dataType}`;
}

function loadUserData(userId) {
    expenses = JSON.parse(localStorage.getItem(getUserDataKey(userId, "expenses"))) || [];
    incomes = JSON.parse(localStorage.getItem(getUserDataKey(userId, "incomes"))) || {};
    savings = JSON.parse(localStorage.getItem(getUserDataKey(userId, "savings"))) || 0;
    
    renderExpenses();
    renderIncomeHistory();
    updateDashboard();
    initializeCharts();
}

function saveUserData(userId) {
    localStorage.setItem(getUserDataKey(userId, "expenses"), JSON.stringify(expenses));
    localStorage.setItem(getUserDataKey(userId, "incomes"), JSON.stringify(incomes));
    localStorage.setItem(getUserDataKey(userId, "savings"), JSON.stringify(savings));
}

function resetUserData(userId) {
    localStorage.removeItem(getUserDataKey(userId, "expenses"));
    localStorage.removeItem(getUserDataKey(userId, "incomes"));
    localStorage.removeItem(getUserDataKey(userId, "savings"));
    
    expenses = [];
    incomes = {};
    savings = 0;
    
    renderExpenses();
    renderIncomeHistory();
    updateDashboard();
}

// ===== EXPENSE FUNCTIONS =====
function addExpense() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const name = document.getElementById("name-input").value.trim();
    const amount = parseFloat(document.getElementById("amount-input").value);
    const date = document.getElementById("date-input").value;
    const time = document.getElementById("time-input").value;
    const category = document.getElementById("category-input").value;

    if (!name || amount <= 0 || !date || !time || !category) {
        showNotification("Please fill all fields correctly", "error");
        return;
    }

    const selectedDate = new Date(`${date}T${time}`);
    if (selectedDate > new Date()) {
        showNotification("Future expenses are not allowed", "error");
        return;
    }

    const expense = {
        id: Date.now(),
        name,
        amount,
        date,
        time,
        category,
        createdAt: new Date().toISOString()
    };

    expenses.push(expense);
    saveUserData(currentUser.id);
    renderExpenses();
    updateDashboard();
    
    // Clear form
    document.getElementById("name-input").value = "";
    document.getElementById("amount-input").value = "";
    document.getElementById("date-input").value = "";
    document.getElementById("time-input").value = "";
    document.getElementById("category-input").value = "";
    
    showNotification("Expense added successfully!", "success");
}

function renderExpenses() {
    const tbody = document.getElementById("expenses-table-body");
    tbody.innerHTML = "";

    if (expenses.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No expenses added yet</td>
            </tr>
        `;
        return;
    }

    // Sort by date (newest first)
    const sortedExpenses = [...expenses].sort((a, b) => 
        new Date(b.date + "T" + b.time) - new Date(a.date + "T" + a.time)
    );

    // Show only recent expenses
    const recentExpenses = sortedExpenses.slice(0, 10);

    recentExpenses.forEach(exp => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${exp.name}</td>
            <td>${formatCurrency(exp.amount)}</td>
            <td>${formatDate(exp.date)}</td>
            <td>${exp.time}</td>
            <td><span class="category-tag">${exp.category}</span></td>
            <td>
                <button class="delete-btn" onclick="deleteExpense(${exp.id})">
                    Delete
                </button>
            </td>
        `;
    });
}

function deleteExpense(id) {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    
    expenses = expenses.filter(e => e.id !== id);
    const currentUser = userManager.getCurrentUser();
    if (currentUser) {
        saveUserData(currentUser.id);
    }
    renderExpenses();
    updateDashboard();
    showNotification("Expense deleted successfully!", "success");
}

// ===== INCOME FUNCTIONS =====
function addIncome() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const amount = parseFloat(document.getElementById("income-input").value);
    if (amount <= 0) {
        showNotification("Please enter a valid income amount", "error");
        return;
    }

    const month = getMonthYear(new Date());
    incomes[month] = (incomes[month] || 0) + amount;
    
    saveUserData(currentUser.id);
    renderIncomeHistory();
    updateDashboard();
    
    document.getElementById("income-input").value = "";
    showNotification("Income added successfully!", "success");
}

function renderIncomeHistory() {
    const container = document.getElementById("income-history");
    container.innerHTML = "";

    const months = Object.keys(incomes).sort().reverse();
    
    if (months.length === 0) {
        container.innerHTML = `<p class="text-muted">No income records yet</p>`;
        return;
    }

    months.forEach(month => {
        const div = document.createElement("div");
        div.className = "income-item";
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #ecf0f1;">
                <span>${formatMonth(month)}</span>
                <span style="font-weight: bold;">${formatCurrency(incomes[month])}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

// ===== SAVINGS FUNCTIONS =====
function addToSavings() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const amount = parseFloat(document.getElementById("savings-input").value);
    if (amount <= 0) {
        showNotification("Please enter a valid amount", "error");
        return;
    }

    savings += amount;
    saveUserData(currentUser.id);
    updateDashboard();
    
    document.getElementById("savings-input").value = "";
    showNotification(`${formatCurrency(amount)} added to savings!`, "success");
}

function withdrawFromSavings() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const amount = parseFloat(document.getElementById("savings-input").value);
    if (amount <= 0) {
        showNotification("Please enter a valid amount", "error");
        return;
    }

    if (amount > savings) {
        showNotification("Insufficient savings balance", "error");
        return;
    }

    savings -= amount;
    saveUserData(currentUser.id);
    updateDashboard();
    
    document.getElementById("savings-input").value = "";
    showNotification(`${formatCurrency(amount)} withdrawn from savings`, "warning");
}

// ===== QUICK SAVINGS GOAL UPDATE =====
function quickUpdateSavingsGoal() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const newGoal = parseFloat(document.getElementById("quick-savings-goal").value);
    
    if (isNaN(newGoal) || newGoal < 0) {
        showNotification("Please enter a valid savings goal", "error");
        return;
    }
    
    const updates = {
        settings: {
            savingsGoal: newGoal
        }
    };
    
    const result = userManager.updateUserProfile(currentUser.id, updates);
    
    if (result.success) {
        showNotification(`Savings goal updated to ${formatCurrency(newGoal)}`, "success");
        document.getElementById("quick-savings-goal").value = "";
        
        // Refresh insights
        if (analyzer) {
            analyzer.generateInsights();
        }
        updateDashboard();
    } else {
        showNotification(result.message, "error");
    }
}

// ===== UTILITY FUNCTIONS =====
function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = "0";
        notification.style.transform = "translateX(100%)";
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function getMonthYear(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-KE', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
}

// ===== DASHBOARD FUNCTIONS =====
function updateDashboard() {
    const currentMonth = getMonthYear(new Date());
    
    // Calculate totals
    const income = incomes[currentMonth] || 0;
    const expenseTotal = expenses
        .filter(e => getMonthYear(e.date) === currentMonth)
        .reduce((sum, e) => sum + e.amount, 0);
    const balance = income - expenseTotal - savings;
    
    // Update summary cards
    document.getElementById("summary-income").textContent = formatCurrency(income);
    document.getElementById("summary-expenses").textContent = formatCurrency(expenseTotal);
    document.getElementById("summary-savings").textContent = formatCurrency(savings);
    document.getElementById("summary-balance").textContent = formatCurrency(balance);
    
    // Update charts and insights
    if (charts.distribution) {
        updateCharts();
    }
    if (analyzer) {
        analyzer.generateInsights();
        analyzer.updateUI();
    }
}

// ===== ANALYTICS & CHARTS =====
class ExpenseAnalyzer {
    constructor() {
        this.categories = {
            food: { name: 'Food & Dining', color: '#27ae60' },
            transport: { name: 'Transportation', color: '#3498db' },
            shopping: { name: 'Shopping', color: '#9b59b6' },
            entertainment: { name: 'Entertainment', color: '#f39c12' },
            bills: { name: 'Bills & Utilities', color: '#e74c3c' },
            health: { name: 'Health & Fitness', color: '#1abc9c' },
            other: { name: 'Other', color: '#7f8c8d' }
        };
    }

    getCurrentMonth() {
        return getMonthYear(new Date());
    }

    getLastMonths(count) {
        const months = [];
        const now = new Date();
        
        for (let i = count - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(getMonthYear(date));
        }
        
        return months;
    }

    getCategoryData() {
        const currentMonth = this.getCurrentMonth();
        const monthlyExpenses = expenses.filter(exp => 
            getMonthYear(exp.date) === currentMonth
        );

        const categoryData = {};
        monthlyExpenses.forEach(exp => {
            const category = exp.category || 'other';
            categoryData[category] = (categoryData[category] || 0) + exp.amount;
        });

        return categoryData;
    }

    generateInsights() {
        const currentMonth = this.getCurrentMonth();
        const monthlyExpenses = expenses.filter(exp => 
            getMonthYear(exp.date) === currentMonth
        );
        const monthlyIncome = incomes[currentMonth] || 0;
        
        // Top Recommendation
        const totalExpenses = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const savingsRate = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;
        
        if (monthlyIncome === 0) {
            document.getElementById("top-insight").textContent = 
                "Start by adding your monthly income to get personalized recommendations.";
        } else if (totalExpenses > monthlyIncome * 0.8) {
            document.getElementById("top-insight").textContent = 
                "Your expenses are high relative to income. Consider reviewing discretionary spending.";
        } else if (savingsRate < 10) {
            document.getElementById("top-insight").textContent = 
                "Try to increase your savings rate to at least 20% of your income.";
        } else {
            document.getElementById("top-insight").textContent = 
                "Great financial discipline! Keep tracking your expenses and savings.";
        }
        
        // Spending Pattern
        if (monthlyExpenses.length > 0) {
            const dailyAvg = totalExpenses / 30;
            document.getElementById("avg-daily").textContent = formatCurrency(dailyAvg);
            
            // Find largest category
            const categoryData = this.getCategoryData();
            const largest = Object.entries(categoryData)
                .sort((a, b) => b[1] - a[1])[0];
            
            if (largest) {
                document.getElementById("peak-category").textContent = 
                    this.categories[largest[0]]?.name || largest[0];
            }
        }
        
        // Savings Advice - Enhanced with user's savings goal
        const currentUser = userManager.getCurrentUser();
        const savingsGoal = currentUser?.settings?.savingsGoal || 25000;
        const progress = savingsGoal > 0 ? (savings / savingsGoal) * 100 : 0;
        document.getElementById("savings-percentage").textContent = `${Math.round(progress)}%`;
        document.getElementById("savings-progress").style.width = `${Math.min(progress, 100)}%`;
        
        // Calculate monthly savings rate
        const monthlySavingsRate = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;
        
        if (progress >= 100) {
            document.getElementById("savings-advice").textContent = 
                `Congratulations! You've exceeded your savings goal of ${formatCurrency(savingsGoal)}. Consider setting a new higher goal.`;
        } else if (progress >= 75) {
            document.getElementById("savings-advice").textContent = 
                `Excellent progress! You're ${Math.round(progress)}% towards your goal of ${formatCurrency(savingsGoal)}. Keep going!`;
        } else if (progress >= 50) {
            document.getElementById("savings-advice").textContent = 
                `Good progress! You're halfway to your goal of ${formatCurrency(savingsGoal)}. Stay consistent!`;
        } else if (progress >= 25) {
            document.getElementById("savings-advice").textContent = 
                `You're ${Math.round(progress)}% towards your goal of ${formatCurrency(savingsGoal)}. Every bit counts!`;
        } else {
            const remaining = savingsGoal - savings;
            document.getElementById("savings-advice").textContent = 
                `You need ${formatCurrency(remaining)} more to reach your goal of ${formatCurrency(savingsGoal)}. Start saving today!`;
        }
        
        // Add recommendation based on savings rate
        if (monthlyIncome > 0) {
            if (monthlySavingsRate < 10) {
                document.getElementById("top-insight").textContent = 
                    `Try to save at least 10% of your income to reach your ${formatCurrency(savingsGoal)} goal faster.`;
            } else if (monthlySavingsRate >= 20) {
                document.getElementById("top-insight").textContent = 
                    `Great job! You're saving ${Math.round(monthlySavingsRate)}% of your income. You'll reach your goal soon!`;
            }
        }
        
        // Category Analysis
        const categoryData = this.getCategoryData();
        const tagsContainer = document.getElementById("category-tags");
        tagsContainer.innerHTML = "";
        
        Object.entries(categoryData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .forEach(([category, amount]) => {
                const tag = document.createElement("span");
                tag.className = "category-tag";
                tag.textContent = `${this.categories[category]?.name || category}: ${formatCurrency(amount)}`;
                tag.style.backgroundColor = `${this.categories[category]?.color || '#7f8c8d'}20`;
                tag.style.border = `1px solid ${this.categories[category]?.color || '#7f8c8d'}`;
                tagsContainer.appendChild(tag);
            });
        
        if (Object.keys(categoryData).length === 0) {
            document.getElementById("category-insight").textContent = 
                "No expense categories to analyze yet.";
        } else {
            document.getElementById("category-insight").textContent = 
                "Track your spending patterns across different categories.";
        }
        
        // Monthly Forecast - Enhanced with savings goal
        if (monthlyIncome > 0 && monthlyExpenses.length > 0) {
            const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
            const daysPassed = new Date().getDate();
            const dailySpend = totalExpenses / daysPassed;
            const daysLeft = daysInMonth - daysPassed;
            const projectedSpend = dailySpend * daysLeft;
            const projectedBalance = monthlyIncome - totalExpenses - projectedSpend - savings;
            
            document.getElementById("projected-balance").textContent = formatCurrency(projectedBalance);
            
            // Calculate if you'll reach savings goal at this rate
            const monthsToGoal = savings > 0 ? (savingsGoal - savings) / (savings / daysPassed * 30) : Infinity;
            
            let riskLevel = "Low";
            let forecastMessage = "";
            
            if (projectedBalance < 0) {
                riskLevel = "High";
                document.getElementById("risk-level").style.color = "#e74c3c";
                forecastMessage = "You may exceed your budget this month. Consider reducing expenses.";
            } else if (projectedBalance < monthlyIncome * 0.1) {
                riskLevel = "Medium";
                document.getElementById("risk-level").style.color = "#f39c12";
                forecastMessage = "Your projected balance is tight. Watch your spending.";
            } else {
                document.getElementById("risk-level").style.color = "#27ae60";
                if (monthsToGoal < 12 && monthsToGoal > 0) {
                    forecastMessage = `On track to reach your savings goal in ${Math.ceil(monthsToGoal)} months!`;
                } else {
                    forecastMessage = "You're on track for a healthy financial month.";
                }
            }
            
            document.getElementById("risk-level").textContent = riskLevel;
            document.getElementById("monthly-forecast").textContent = forecastMessage;
        }
    }

    updateUI() {
        // Updates are done in generateInsights
    }
}

function initializeCharts() {
    const distributionCtx = document.getElementById('expenseDistributionChart');
    if (distributionCtx) {
        analyzer = new ExpenseAnalyzer();
        updateCharts();
    }
}

function updateCharts() {
    const distributionCtx = document.getElementById('expenseDistributionChart');
    const trendsCtx = document.getElementById('monthlyTrendsChart');
    const savingsCtx = document.getElementById('savingsProgressChart');
    
    // Destroy existing charts
    if (charts.distribution) charts.distribution.destroy();
    if (charts.trends) charts.trends.destroy();
    if (charts.savings) charts.savings.destroy();
    
    // Expense Distribution Chart
    const categoryData = analyzer.getCategoryData();
    const categoryLabels = Object.keys(categoryData).map(cat => 
        analyzer.categories[cat]?.name || cat
    );
    const categoryValues = Object.values(categoryData);
    const categoryColors = Object.keys(categoryData).map(cat => 
        analyzer.categories[cat]?.color || '#7f8c8d'
    );
    
    if (categoryValues.length > 0) {
        charts.distribution = new Chart(distributionCtx, {
            type: 'doughnut',
            data: {
                labels: categoryLabels,
                datasets: [{
                    data: categoryValues,
                    backgroundColor: categoryColors,
                    borderColor: 'white',
                    borderWidth: 2,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                family: 'Times New Roman',
                                size: 14
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Monthly Trends Chart
    const months = analyzer.getLastMonths(6);
    const incomeData = months.map(month => incomes[month] || 0);
    const expenseData = months.map(month => 
        expenses
            .filter(exp => getMonthYear(exp.date) === month)
            .reduce((sum, exp) => sum + exp.amount, 0)
    );
    
    const monthLabels = months.map(month => {
        const [year, monthNum] = month.split('-');
        return new Date(year, monthNum - 1).toLocaleDateString('en-US', { 
            month: 'short', 
            year: '2-digit' 
        });
    });
    
    charts.trends = new Chart(trendsCtx, {
        type: 'line',
        data: {
            labels: monthLabels,
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Expenses',
                    data: expenseData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        font: {
                            family: 'Times New Roman',
                            size: 14
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `KES${value}`
                    }
                }
            }
        }
    });
    
    // Savings Progress Chart
    const currentUser = userManager.getCurrentUser();
    const savingsGoal = currentUser?.settings?.savingsGoal || 25000;
    charts.savings = new Chart(savingsCtx, {
        type: 'bar',
        data: {
            labels: ['Current', 'Goal'],
            datasets: [{
                label: 'Savings',
                data: [savings, savingsGoal],
                backgroundColor: ['#3498db', '#7f8c8d'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `KES${value}`
                    }
                }
            }
        }
    });
}

function generateAIInsights() {
    if (!analyzer) {
        analyzer = new ExpenseAnalyzer();
    }
    analyzer.generateInsights();
    showNotification("New insights generated!", "success");
}

// ===== REPORT GENERATION =====
function downloadPDFReport() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(24);
    doc.setFont("times", "bold");
    doc.text('ExpenseFlow Financial Report', 20, 30);
    
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 40);
    doc.text(`User: ${currentUser.name}`, 20, 45);
    doc.text(`Email: ${currentUser.email}`, 20, 50);
    
    // Summary Section
    const currentMonth = getMonthYear(new Date());
    const income = incomes[currentMonth] || 0;
    const expenseTotal = expenses
        .filter(e => getMonthYear(e.date) === currentMonth)
        .reduce((sum, e) => sum + e.amount, 0);
    const savingsGoal = currentUser?.settings?.savingsGoal || 25000;
    
    doc.setFontSize(16);
    doc.setFont("times", "bold");
    doc.text('Financial Summary', 20, 70);
    
    doc.autoTable({
        startY: 80,
        head: [['Metric', 'Amount']],
        body: [
            ['Monthly Income', formatCurrency(income)],
            ['Monthly Expenses', formatCurrency(expenseTotal)],
            ['Total Savings', formatCurrency(savings)],
            ['Savings Goal', formatCurrency(savingsGoal)],
            ['Progress to Goal', `${Math.round((savings/savingsGoal)*100)}%`],
            ['Net Balance', formatCurrency(income - expenseTotal - savings)]
        ],
        theme: 'grid',
        headStyles: { 
            fillColor: [44, 62, 80],
            fontStyle: 'bold',
            font: 'times'
        },
        bodyStyles: { font: 'times' }
    });
    
    // Expenses Table
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont("times", "bold");
    doc.text('Recent Expenses', 20, 30);
    
    const expenseData = expenses.slice(-20).map(exp => [
        exp.name,
        formatCurrency(exp.amount),
        formatDate(exp.date),
        exp.category
    ]);
    
    if (expenseData.length > 0) {
        doc.autoTable({
            startY: 40,
            head: [['Description', 'Amount', 'Date', 'Category']],
            body: expenseData,
            theme: 'grid',
            headStyles: { 
                fillColor: [44, 62, 80],
                fontStyle: 'bold',
                font: 'times'
            },
            bodyStyles: { font: 'times' }
        });
    } else {
        doc.text('No expenses recorded yet', 20, 40);
    }
    
    // Save PDF
    doc.save(`ExpenseFlow_Report_${currentUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification("PDF report generated successfully!", "success");
}

// ===== SYSTEM FUNCTIONS =====
function resetAllData() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    if (!confirm("This will permanently delete all your financial data. Are you sure?")) return;
    
    resetUserData(currentUser.id);
    showNotification("All data has been reset", "warning");
}

function logout() {
    if (!confirm("Are you sure you want to logout?")) return;
    
    userManager.logout();
    showNotification("Logged out successfully", "info");
    setTimeout(checkAuth, 500);
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    
    // Set current date and time
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
    
    const dateInput = document.getElementById("date-input");
    const timeInput = document.getElementById("time-input");
    
    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = timeString;
});

// ===== GLOBAL EXPORTS =====
window.addExpense = addExpense;
window.addIncome = addIncome;
window.addToSavings = addToSavings;
window.withdrawFromSavings = withdrawFromSavings;
window.deleteExpense = deleteExpense;
window.generateAIInsights = generateAIInsights;
window.downloadPDFReport = downloadPDFReport;
window.resetAllData = resetAllData;
window.logout = logout;
window.showRegister = showRegister;
window.showForgotPassword = showForgotPassword;
window.showUserSettings = showUserSettings;
window.closeModal = closeModal;
window.sendVerificationCode = sendVerificationCode;
window.quickUpdateSavingsGoal = quickUpdateSavingsGoal;