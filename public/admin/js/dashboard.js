// Dashboard JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('show');
        });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        }
    });
    
    // Profile dropdown toggle
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (dropdownToggle && !dropdownToggle.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });
    
    // Sidebar navigation active state
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const navItem = link.closest('.nav-item');
        if (link.getAttribute('href') === currentPath) {
            navItem.classList.add('active');
        } else {
            navItem.classList.remove('active');
        }
    });
    
    // Chart bar hover effects and tooltips
    const bars = document.querySelectorAll('.bar');
    bars.forEach((bar, index) => {
        const month = bar.getAttribute('data-month');
        const value = Math.floor(Math.random() * 400) + 100; // Random value for demo
        
        bar.addEventListener('mouseenter', function() {
            // Create tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'chart-tooltip';
            tooltip.textContent = `${month}: ${value}`;
            tooltip.style.cssText = `
                position: absolute;
                background: #333;
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 1000;
                pointer-events: none;
                transform: translate(-50%, -100%);
                margin-top: -10px;
            `;
            
            const rect = bar.getBoundingClientRect();
            tooltip.style.left = rect.left + rect.width / 2 + 'px';
            tooltip.style.top = rect.top + window.scrollY + 'px';
            
            document.body.appendChild(tooltip);
            bar.tooltip = tooltip;
        });
        
        bar.addEventListener('mouseleave', function() {
            if (bar.tooltip) {
                document.body.removeChild(bar.tooltip);
                bar.tooltip = null;
            }
        });
    });
    
    // Animate progress circle on load
    const progressCircle = document.querySelector('.circle-progress');
    if (progressCircle) {
        const percentage = progressCircle.getAttribute('data-percentage');
        const degrees = (percentage / 100) * 360;
        
        setTimeout(() => {
            progressCircle.style.background = `conic-gradient(#667eea 0deg ${degrees}deg, #e0e0e0 ${degrees}deg 360deg)`;
        }, 500);
    }
    
    // Animate stats on load
    const statNumbers = document.querySelectorAll('.stat-number');
    const animateStats = () => {
        statNumbers.forEach(stat => {
            const finalValue = stat.textContent;
            const numericValue = parseInt(finalValue.replace(/[^\d]/g, ''));
            const prefix = finalValue.replace(/[\d,]/g, '');
            
            if (numericValue) {
                let currentValue = 0;
                const increment = numericValue / 50;
                const timer = setInterval(() => {
                    currentValue += increment;
                    if (currentValue >= numericValue) {
                        currentValue = numericValue;
                        clearInterval(timer);
                    }
                    stat.textContent = prefix + Math.floor(currentValue).toLocaleString();
                }, 20);
            }
        });
    };
    
    // Start animation after page load
    setTimeout(animateStats, 300);
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('show');
        }
    });
    
    // Handle chart period change
    const chartSelect = document.querySelector('.chart-select');
    if (chartSelect) {
        chartSelect.addEventListener('change', function() {
            // Here you would typically fetch new data based on selected period
            console.log('Chart period changed to:', this.value);
            
            // Animate bars with new data (demo)
            bars.forEach(bar => {
                const newHeight = Math.floor(Math.random() * 100) + 20;
                bar.style.height = newHeight + '%';
            });
        });
    }
    
    // Add click handlers for action buttons
    const accountBtn = document.querySelector('.account-btn');
    const logoutBtn = document.querySelector('.logout-btn');
    
    if (accountBtn) {
        accountBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Handle account page navigation
            window.location.href = '/admin/account';
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Handle logout confirmation
            if (confirm('Are you sure you want to logout?')) {
                window.location.href = '/admin/logout';
            }
        });
    }
    
    // Initialize dashboard
    console.log('Dashboard initialized successfully');
});

// Additional utility functions
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function updateStats(data) {
    // Function to update dashboard stats with real data
    const statsMapping = {
        'customers': '.stat-card.customers .stat-number',
        'orders': '.stat-card.orders .stat-number',
        'sales': '.stat-card.sales .stat-number',
        'pending': '.stat-card.pending .stat-number'
    };
    
    Object.keys(data).forEach(key => {
        const element = document.querySelector(statsMapping[key]);
        if (element) {
            element.textContent = formatNumber(data[key]);
        }
    });
}

// Export functions for use in other files
window.dashboardUtils = {
    formatNumber,
    updateStats
};