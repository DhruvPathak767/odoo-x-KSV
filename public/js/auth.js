document.addEventListener('DOMContentLoaded', () => {
    // Select forms
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');
    const resetForm = document.getElementById('reset-form');

    // Helper for validating email pattern
    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    // Helper for rendering alert banner inside the form card
    const showAlert = (message, type = 'error') => {
        const alertContainer = document.getElementById('alert-container');
        if (!alertContainer) return;

        // Clear existing alerts
        alertContainer.innerHTML = '';

        // Create elements
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert-banner alert-banner-${type}`;

        const iconSvg = type === 'success' 
            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

        alertDiv.innerHTML = `
            ${iconSvg}
            <span>${message}</span>
        `;

        alertContainer.appendChild(alertDiv);
    };

    // Helper to toggle submit button loading state
    const setSubmitting = (form, isSubmitting) => {
        const submitBtn = form.querySelector('#btn-submit');
        if (!submitBtn) return;

        const textSpan = submitBtn.querySelector('span');
        if (isSubmitting) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            if (textSpan) textSpan.textContent = 'Processing request...';
        } else {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            if (textSpan) {
                if (form.id === 'login-form') textSpan.textContent = 'Sign In';
                else if (form.id === 'register-form') textSpan.textContent = 'Create Account';
                else if (form.id === 'forgot-form') textSpan.textContent = 'Send Reset Link';
                else if (form.id === 'reset-form') textSpan.textContent = 'Save Password & Sign In';
            }
        }
    };

    // Generic JSON submit helper
    const handleFormSubmit = async (form, url) => {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        setSubmitting(form, true);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showAlert(result.message, 'success');
                // Wait briefly for user to read success message before redirecting
                setTimeout(() => {
                    window.location.href = result.redirectUrl || '/dashboard';
                }, 1500);
            } else {
                showAlert(result.message || 'Something went wrong. Please check your inputs.', 'error');
                setSubmitting(form, false);
            }
        } catch (err) {
            console.error('AJAX Submit Error:', err);
            showAlert('Network error. Check connection or try again later.', 'error');
            setSubmitting(form, false);
        }
    };

    // 1. LOGIN FORM VALIDATION & AJAX SUBMISSION
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = loginForm.email.value.trim();
            const password = loginForm.password.value;

            if (!email || !password) {
                showAlert('Please fill in all fields.');
                return;
            }

            if (!validateEmail(email)) {
                showAlert('Please enter a valid email address.');
                return;
            }

            handleFormSubmit(loginForm, '/auth/login');
        });
    }

    // 2. REGISTER FORM VALIDATION & AJAX SUBMISSION
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = registerForm.name.value.trim();
            const email = registerForm.email.value.trim();
            const role = registerForm.role.value;
            const password = registerForm.password.value;
            const confirmPassword = registerForm.confirmPassword.value;

            if (!name || !email || !role || !password || !confirmPassword) {
                showAlert('All fields are required.');
                return;
            }

            if (!validateEmail(email)) {
                showAlert('Please enter a valid email address.');
                return;
            }

            if (password.length < 8) {
                showAlert('Password must be at least 8 characters long.');
                return;
            }

            if (password !== confirmPassword) {
                showAlert('Passwords do not match. Re-enter password.');
                return;
            }

            handleFormSubmit(registerForm, '/auth/register');
        });
    }

    // 3. FORGOT PASSWORD VALIDATION & AJAX SUBMISSION
    if (forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = forgotForm.email.value.trim();

            if (!email) {
                showAlert('Please enter your email.');
                return;
            }

            if (!validateEmail(email)) {
                showAlert('Please enter a valid email address.');
                return;
            }

            handleFormSubmit(forgotForm, '/auth/forgot-password');
        });
    }

    // 4. RESET PASSWORD VALIDATION & AJAX SUBMISSION
    if (resetForm) {
        resetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const password = resetForm.password.value;
            const confirmPassword = resetForm.confirmPassword.value;
            const token = resetForm.token.value;

            if (!token) {
                showAlert('Reset token is missing. Please restart recovery process.');
                return;
            }

            if (password.length < 8) {
                showAlert('Password must be at least 8 characters long.');
                return;
            }

            if (password !== confirmPassword) {
                showAlert('Passwords do not match.');
                return;
            }

            handleFormSubmit(resetForm, '/auth/reset-password');
        });
    }
});
