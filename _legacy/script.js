// Initialize Lucide Icons
lucide.createIcons();

let firebaseApp = null;
let auth = null;

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to load config');
        const config = await response.json();
        if (!config.firebase_api_key || !config.firebase_project_id) {
            console.warn('Firebase config incomplete; website auth disabled.');
            return;
        }
        firebaseApp = firebase.initializeApp({
            apiKey: config.firebase_api_key,
            authDomain: config.firebase_auth_domain,
            projectId: config.firebase_project_id,
            appId: config.firebase_app_id,
        });
        auth = firebase.auth();
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const token = await user.getIdToken();
                await syncUserWithBackend(token);
            } else {
                updateAuthUI(false);
            }
        });
    } catch (error) {
        console.error('Failed to load Firebase config:', error);
    }
}

async function syncUserWithBackend(token) {
    try {
        const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('userToken', token);
            localStorage.setItem('userData', JSON.stringify(data.user));
            updateAuthUI(true, data.user);
        }
    } catch (error) {
        console.error('Sync error:', error);
    }
}

// Mobile Menu Toggle
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

mobileMenuBtn.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});

// Auth Modal Handling
const authModal = document.getElementById('authModal');
const loginBtn = document.getElementById('loginBtn');
const closeModal = document.getElementById('closeModal');
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');
const switchTabs = document.querySelectorAll('.switch-tab');

loginBtn.addEventListener('click', () => {
    authModal.classList.add('active');
});

closeModal.addEventListener('click', () => {
    authModal.classList.remove('active');
});

authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
        authModal.classList.remove('active');
    }
});

authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        authForms.forEach(form => {
            form.classList.remove('active');
            if (form.id === `${targetTab}Form`) {
                form.classList.add('active');
            }
        });
    });
});

switchTabs.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = link.dataset.tab;
        
        authTabs.forEach(t => {
            t.classList.remove('active');
            if (t.dataset.tab === targetTab) {
                t.classList.add('active');
            }
        });
        
        authForms.forEach(form => {
            form.classList.remove('active');
            if (form.id === `${targetTab}Form`) {
                form.classList.add('active');
            }
        });
    });
});

// Profile Modal Handling
const profileModal = document.getElementById('profileModal');
const closeProfileModal = document.getElementById('closeProfileModal');
const profileBtn = document.getElementById('profileBtn');
const logoutBtn = document.getElementById('logoutBtn');

if (profileBtn) {
    profileBtn.addEventListener('click', () => {
        profileModal.classList.add('active');
    });
}

closeProfileModal.addEventListener('click', () => {
    profileModal.classList.remove('active');
});

profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
        profileModal.classList.remove('active');
    }
});

logoutBtn.addEventListener('click', async () => {
    if (auth) await auth.signOut();
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    updateAuthUI(false);
    profileModal.classList.remove('active');
});

async function checkAuth() {
    if (!auth) return;
    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        await syncUserWithBackend(token);
    }
}

function updateAuthUI(isLoggedIn, userData = null) {
    if (isLoggedIn && userData) {
        loginBtn.style.display = 'none';
        if (profileBtn) {
            profileBtn.style.display = 'block';
            profileBtn.textContent = getInitials(userData.name);
        }
        
        // Update profile modal
        document.getElementById('profileName').textContent = userData.name;
        document.getElementById('profileEmail').textContent = userData.email;
        document.getElementById('profileInitials').textContent = getInitials(userData.name);
        
        if (userData.business_name) {
            document.getElementById('businessName').value = userData.business_name;
        }
        if (userData.gstin) {
            document.getElementById('gstin').value = userData.gstin;
        }
        if (userData.phone) {
            document.getElementById('phone').value = userData.phone;
        }
        
        if (userData.subscription) {
            document.getElementById('subBadge').textContent = userData.subscription.plan;
            document.getElementById('subDetails').textContent = userData.subscription.details;
        }
    } else {
        loginBtn.style.display = 'inline-block';
        if (profileBtn) {
            profileBtn.style.display = 'none';
        }
    }
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Login Form Submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        if (!auth) {
            alert('Authentication is not configured yet.');
            return;
        }
        const credential = await auth.signInWithEmailAndPassword(email, password);
        const token = await credential.user.getIdToken();
        const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.ok) {
            const syncData = await response.json();
            localStorage.setItem('userToken', token);
            localStorage.setItem('userData', JSON.stringify(syncData.user));
            updateAuthUI(true, syncData.user);
            authModal.classList.remove('active');
        } else {
            alert('Failed to sync user data');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert(error.message || 'Login failed. Please try again.');
    }
});

// Register Form Submission
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    try {
        if (!auth) {
            alert('Authentication is not configured yet.');
            return;
        }
        const credential = await auth.createUserWithEmailAndPassword(email, password);
        await credential.user.updateProfile({ displayName: name });
        const token = await credential.user.getIdToken();
        const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ name }),
        });

        if (response.ok) {
            const syncData = await response.json();
            localStorage.setItem('userToken', token);
            localStorage.setItem('userData', JSON.stringify(syncData.user));
            updateAuthUI(true, syncData.user);
            authModal.classList.remove('active');
        } else {
            alert('Registration successful but failed to sync user data');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert(error.message || 'Registration failed. Please try again.');
    }
});

// Save Settings
document.getElementById('saveSettings').addEventListener('click', async () => {
    const businessName = document.getElementById('businessName').value;
    const gstin = document.getElementById('gstin').value;
    const phone = document.getElementById('phone').value;
    const token = localStorage.getItem('userToken');
    
    try {
        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ business_name: businessName, gstin, phone })
        });
        
        if (response.ok) {
            const userData = JSON.parse(localStorage.getItem('userData'));
            userData.business_name = businessName;
            userData.gstin = gstin;
            userData.phone = phone;
            localStorage.setItem('userData', JSON.stringify(userData));
            alert('Settings saved successfully');
        } else {
            alert('Failed to save settings');
        }
    } catch (error) {
        console.error('Save settings error:', error);
        alert('Failed to save settings');
    }
});

// Upgrade Subscription — redirect to pricing section
document.getElementById('upgradeBtn').addEventListener('click', () => {
    window.location.href = '#pricing';
    profileModal.classList.remove('active');
});

// Initialize Firebase auth after config load
loadConfig().then(() => checkAuth());

// Animated Counters
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number[data-count]');
    
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-count'));
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;
        
        const updateCounter = () => {
            current += step;
            if (current < target) {
                counter.textContent = formatNumber(Math.floor(current));
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = formatNumber(target);
            }
        };
        
        updateCounter();
    });
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M+';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K+';
    }
    return num.toString();
}

// Trigger counter animation when hero is visible
const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            heroObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const heroSection = document.querySelector('.hero');
if (heroSection) {
    heroObserver.observe(heroSection);
}

// Smooth Scroll for Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            // Close mobile menu if open
            navLinks.classList.remove('active');
        }
    });
});

// Navbar Background on Scroll
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
    }
});

// Intersection Observer for Animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe feature cards and pricing cards
document.querySelectorAll('.feature-card, .pricing-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(card);
});

// Contact Form Handling
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData);
        
        // Simple validation
        if (!data.name || !data.email || !data.subject || !data.message) {
            alert('Please fill in all fields');
            return;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            alert('Please enter a valid email address');
            return;
        }
        
        // Simulate form submission
        alert('Thank you for your message! We will get back to you soon.');
        contactForm.reset();
    });
}

// Pricing Card Selection
const pricingCards = document.querySelectorAll('.pricing-card');
pricingCards.forEach(card => {
    card.addEventListener('click', () => {
        // Remove active class from all cards
        pricingCards.forEach(c => c.classList.remove('active'));
        // Add active class to clicked card
        card.classList.add('active');
    });
});

// Download Button Tracking
const downloadButtons = document.querySelectorAll('.download-btn:not(.disabled)');
downloadButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Track download event (you can add analytics here)
        console.log('Download button clicked');
    });
});

// Lazy Loading for Images
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// Pricing Button Handling — Razorpay Standard Checkout
const pricingButtons = document.querySelectorAll('[data-plan]');
pricingButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const plan = btn.dataset.plan;
        if (!plan) return;

        if (plan === 'free') {
            const token = localStorage.getItem('userToken');
            if (!token) {
                authModal.classList.add('active');
                return;
            }
            window.location.href = '#download';
            return;
        }

        const token = localStorage.getItem('userToken');
        if (!token) {
            authModal.classList.add('active');
            return;
        }

        startRazorpayCheckout(plan);
    });
});

const PLAN_LABELS = {
    business: 'Business Plan',
    accountant: 'Accountant Plan',
    extra_gstin: 'Extra GSTIN',
};

async function startRazorpayCheckout(plan) {
    try {
        const orderRes = await fetch('/.netlify/functions/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan }),
        });

        if (!orderRes.ok) {
            const err = await orderRes.json().catch(() => ({}));
            throw new Error(err.error || err.details || 'Failed to create order');
        }

        const order = await orderRes.json();
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');

        const options = {
            key: order.key_id,
            order_id: order.order_id,
            amount: order.amount,
            currency: order.currency || 'INR',
            name: 'Argus - GST Billing',
            description: PLAN_LABELS[plan] || plan,
            prefill: {
                email: userData.email || '',
                contact: userData.phone || '',
            },
            theme: { color: '#5B5BD6' },
            handler: async function (response) {
                await verifyRazorpayPayment(response, plan);
            },
            modal: {
                ondismiss: function () {
                    console.log('Razorpay checkout dismissed by user');
                },
            },
        };

        const rzp = new Razorpay(options);

        rzp.on('payment.failed', function (response) {
            const err = response.error || {};
            alert(`Payment failed: ${err.description || 'Unknown error'}. Please try again.`);
        });

        rzp.open();
    } catch (error) {
        console.error('Razorpay checkout error:', error);
        alert(error.message || 'Unable to start payment. Please try again.');
    }
}

async function verifyRazorpayPayment(response, plan) {
    try {
        const verifyRes = await fetch('/.netlify/functions/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
            }),
        });

        const data = await verifyRes.json();

        if (verifyRes.ok && data.verified) {
            alert(`Payment successful! Your ${PLAN_LABELS[plan] || plan} subscription is now active.`);
            if (profileModal) profileModal.classList.remove('active');
        } else {
            alert(`Payment received but verification failed. Please contact support with payment ID: ${response.razorpay_payment_id}`);
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        alert(`Payment received but verification failed. Please contact support with payment ID: ${response.razorpay_payment_id}`);
    }
}

// Dynamic Year in Footer
const footerYear = document.querySelector('.footer-bottom p');
if (footerYear) {
    const currentYear = new Date().getFullYear();
    footerYear.textContent = `© ${currentYear} B&L Softwares and Logistics. All rights reserved.`;
}

// Performance Optimization: Debounce Resize Events
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Handle resize events
        if (window.innerWidth > 768) {
            navLinks.classList.remove('active');
        }
    }, 250);
});

// Add loading state for buttons
const buttons = document.querySelectorAll('button, .btn-primary, .btn-secondary, .btn-outline');
buttons.forEach(btn => {
    btn.addEventListener('click', function() {
        if (!this.classList.contains('disabled')) {
            this.classList.add('loading');
            setTimeout(() => {
                this.classList.remove('loading');
            }, 1000);
        }
    });
});

// Console welcome message
console.log('%c Argus - GST Billing Made Simple ', 'background: #5B5BD6; color: white; font-size: 20px; padding: 10px;');
console.log('%c Built with ❤️ by B&L Softwares and Logistics', 'color: #5B5BD6; font-size: 14px;');

// Initialize config on page load
loadConfig();
