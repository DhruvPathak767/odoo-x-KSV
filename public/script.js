document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // 1. CANVAS PARTICLES SYSTEM (Interactive Connected Web)
    // ----------------------------------------------------
    const canvas = document.getElementById('particles-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        const particleCount = 60;
        const connectionDistance = 110;
        const mouseConnectionDistance = 160;

        // Global mouse coordinate tracking
        let mouse = { x: null, y: null };
        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;

            // Coordinate background spotlight positions
            document.documentElement.style.setProperty('--global-x', `${e.clientX}px`);
            document.documentElement.style.setProperty('--global-y', `${e.clientY}px`);
        });

        window.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.radius = Math.random() * 1.8 + 0.8;
                this.vx = (Math.random() - 0.5) * 0.2;
                this.vy = (Math.random() - 0.5) * 0.2;
                this.alpha = Math.random() * 0.4 + 0.1;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(236, 72, 153, ${this.alpha})`;
                ctx.fill();
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                if (this.x < 0) this.x = canvas.width;
                if (this.x > canvas.width) this.x = 0;
                if (this.y < 0) this.y = canvas.height;
                if (this.y > canvas.height) this.y = 0;
            }
        }

        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        function drawConnections() {
            for (let i = 0; i < particles.length; i++) {
                const p1 = particles[i];

                // Connect particles to each other
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

                    if (dist < connectionDistance) {
                        const opacity = (1 - (dist / connectionDistance)) * 0.12;
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`; // Violet connector
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }

                // Connect particles to the mouse
                if (mouse.x !== null && mouse.y !== null) {
                    const mDist = Math.hypot(p1.x - mouse.x, p1.y - mouse.y);
                    if (mDist < mouseConnectionDistance) {
                        const opacity = (1 - (mDist / mouseConnectionDistance)) * 0.22;
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.strokeStyle = `rgba(236, 72, 153, ${opacity})`; // Magenta hover connector
                        ctx.lineWidth = 0.6;
                        ctx.stroke();
                    }
                }
            }
        }

        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            drawConnections();
            requestAnimationFrame(animateParticles);
        }
        animateParticles();
    }

    // ----------------------------------------------------
    // 2. MOUSE CURSOR GLOW EFFECT (Card Trackers)
    // ----------------------------------------------------
    const glassCards = document.querySelectorAll('.glass-card');
    glassCards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // ----------------------------------------------------
    // 3. STICKY NAVBAR SCROLL EVENT
    // ----------------------------------------------------
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // ----------------------------------------------------
    // 4. MOBILE MENU OVERLAY & TOGGLE
    // ----------------------------------------------------
    const mobileToggle = document.getElementById('mobile-toggle');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    function toggleMobileMenu() {
        mobileToggle.classList.toggle('active');
        mobileMenuOverlay.classList.toggle('active');
        document.body.classList.toggle('no-scroll');
    }

    if (mobileToggle && mobileMenuOverlay) {
        mobileToggle.addEventListener('click', toggleMobileMenu);

        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (mobileMenuOverlay.classList.contains('active')) {
                    toggleMobileMenu();
                }
            });
        });
    }

    // ----------------------------------------------------
    // 5. HERO PARALLAX & TILT INTERACTION
    // ----------------------------------------------------
    const heroVisual = document.querySelector('.hero-visual');
    const mockupContainer = document.querySelector('.mockup-container');

    if (heroVisual && mockupContainer) {
        heroVisual.addEventListener('mousemove', e => {
            const rect = heroVisual.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const xPct = (x / rect.width) - 0.5;
            const yPct = (y / rect.height) - 0.5;

            const rotateX = 8 - (yPct * 12);
            const rotateY = -10 + (xPct * 12);
            
            mockupContainer.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        heroVisual.addEventListener('mouseleave', () => {
            mockupContainer.style.transform = 'rotateX(8deg) rotateY(-10deg)';
            mockupContainer.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        });

        heroVisual.addEventListener('mouseenter', () => {
            mockupContainer.style.transition = 'transform 0.1s ease-out';
        });
    }

    // ----------------------------------------------------
    // 6. SCROLL REVEAL (IntersectionObserver)
    // ----------------------------------------------------
    const revealElements = document.querySelectorAll('.reveal-fade-up');
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // ----------------------------------------------------
    // 7. STATISTICS COUNTER ANIMATION
    // ----------------------------------------------------
    const statSection = document.getElementById('benefits');
    const statNums = document.querySelectorAll('.stat-num');
    let animatedStats = false;

    function animateCount(el) {
        const target = parseInt(el.getAttribute('data-val'), 10);
        let current = 0;
        const duration = 2000;
        const stepTime = 16;
        const increment = target / (duration / stepTime);

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                clearInterval(timer);
                if (target === 10000) {
                    el.textContent = '10,000+';
                } else if (target === 500) {
                    el.textContent = '500+';
                } else if (target === 95 || target === 50) {
                    el.textContent = target + '%';
                } else {
                    el.textContent = target;
                }
            } else {
                el.textContent = Math.floor(current);
            }
        }, stepTime);
    }

    if (statSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !animatedStats) {
                    statNums.forEach(num => animateCount(num));
                    animatedStats = true;
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        statsObserver.observe(statSection);
    }

    // ----------------------------------------------------
    // 8. INTERACTIVE SEQUENTIAL WORKFLOW HIGHLIGHTER
    // ----------------------------------------------------
    const steps = document.querySelectorAll('.workflow-step');
    let currentStep = 0;
    let workflowInterval;

    function setStep(index) {
        steps.forEach((step, i) => {
            if (i === index) {
                step.classList.add('active-step');
                const prevConnector = document.getElementById(`line-${i}`);
                if (prevConnector) {
                    prevConnector.style.strokeDashoffset = '0';
                    prevConnector.style.transition = 'stroke-dashoffset 0.8s ease';
                }
            } else {
                step.classList.remove('active-step');
                if (i > index) {
                    const nextConnector = document.getElementById(`line-${i}`);
                    if (nextConnector) {
                        nextConnector.style.strokeDashoffset = '100';
                        nextConnector.style.transition = 'none';
                    }
                }
            }
        });
    }

    function startWorkflowCycle() {
        workflowInterval = setInterval(() => {
            currentStep = (currentStep + 1) % steps.length;
            setStep(currentStep);
        }, 3200);
    }

    steps.forEach((step, index) => {
        step.addEventListener('mouseenter', () => {
            clearInterval(workflowInterval);
            currentStep = index;
            setStep(index);
        });

        step.addEventListener('mouseleave', () => {
            startWorkflowCycle();
        });
    });

    if (steps.length > 0) {
        setStep(0);
        startWorkflowCycle();
    }

    // ----------------------------------------------------
    // 9. MODULE INTERACTIVE SIMULATIONS (Features Hover Effects)
    // ----------------------------------------------------
    
    // Module 1: Vendor Compliance Dial
    const vendorCard = document.getElementById('card-vendor-mgmt');
    const compFill = document.querySelector('.comp-fill');
    const compVal = document.querySelector('.compliance-value');
    let vendorInterval;

    if (vendorCard && compFill && compVal) {
        vendorCard.addEventListener('mouseenter', () => {
            let score = 0;
            compFill.style.transition = 'stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)';
            compFill.style.strokeDasharray = '98, 100';
            
            clearInterval(vendorInterval);
            vendorInterval = setInterval(() => {
                score += 3;
                if (score >= 98) {
                    score = 98;
                    clearInterval(vendorInterval);
                }
                compVal.textContent = score + '%';
            }, 30);
        });

        vendorCard.addEventListener('mouseleave', () => {
            clearInterval(vendorInterval);
            compFill.style.transition = 'stroke-dasharray 0.4s ease';
            compFill.style.strokeDasharray = '0, 100';
            compVal.textContent = '0%';
        });
    }

    // Module 2: RFQ Terminal Logger
    const rfqCard = document.getElementById('card-rfq-mgmt');
    const terminalLog = document.querySelector('.terminal-log');
    const logs = [
        'Connecting to vendor directory...',
        'Handshaking 524 vendors...',
        'Syncing requirement details...',
        'RFQ successfully broadcasted!'
    ];
    let logTimeout1, logTimeout2, logTimeout3, logTimeout4;

    if (rfqCard && terminalLog) {
        rfqCard.addEventListener('mouseenter', () => {
            terminalLog.textContent = 'Initializing engine...';
            
            logTimeout1 = setTimeout(() => { terminalLog.textContent = logs[0]; }, 600);
            logTimeout2 = setTimeout(() => { terminalLog.textContent = logs[1]; }, 1300);
            logTimeout3 = setTimeout(() => { terminalLog.textContent = logs[2]; }, 2000);
            logTimeout4 = setTimeout(() => { 
                terminalLog.textContent = logs[3];
                terminalLog.style.color = 'var(--color-primary)';
            }, 2700);
        });

        rfqCard.addEventListener('mouseleave', () => {
            clearTimeout(logTimeout1);
            clearTimeout(logTimeout2);
            clearTimeout(logTimeout3);
            clearTimeout(logTimeout4);
            terminalLog.textContent = '';
            terminalLog.style.color = 'var(--color-text-secondary)';
        });
    }

    // Module 3: Quotation Comparison Heights
    const quoteCard = document.getElementById('card-quote-mgmt');
    const barInners = document.querySelectorAll('.bar-chart-sim .bar-inner');

    if (quoteCard && barInners.length > 0) {
        quoteCard.addEventListener('mouseenter', () => {
            barInners.forEach(bar => {
                const height = bar.parentElement.getAttribute('style').match(/--target-h:\s*([^;]+)/)[1];
                bar.style.height = height;
            });
        });

        quoteCard.addEventListener('mouseleave', () => {
            barInners.forEach(bar => {
                bar.style.height = '0%';
            });
        });
    }

    // Module 4: Approval Slider Slide
    const approvalCard = document.getElementById('card-approval-mgmt');
    const approvalSim = document.querySelector('.approval-sim');
    const handle = document.querySelector('.approval-slider-handle');
    let sliderTimeout;

    if (approvalCard && approvalSim && handle) {
        approvalCard.addEventListener('mouseenter', () => {
            handle.style.left = 'calc(100% - 34px)';
            sliderTimeout = setTimeout(() => {
                approvalSim.classList.add('approved');
            }, 450);
        });

        approvalCard.addEventListener('mouseleave', () => {
            clearTimeout(sliderTimeout);
            approvalSim.classList.remove('approved');
            handle.style.left = '2px';
        });
    }

    // Module 5: Purchase Order Shipment Route Dispatcher
    const poCard = document.getElementById('card-po-mgmt');
    const nodes = document.querySelectorAll('.po-path-visual .path-node');
    const lineFills = document.querySelectorAll('.po-path-visual .path-line-fill');
    let poTimeout1, poTimeout2, poTimeout3, poTimeout4;

    if (poCard && nodes.length > 0 && lineFills.length > 0) {
        poCard.addEventListener('mouseenter', () => {
            // Node 1 is already active by default
            poTimeout1 = setTimeout(() => {
                lineFills[0].style.width = '100%';
            }, 300);

            poTimeout2 = setTimeout(() => {
                nodes[1].classList.add('active-node');
            }, 1000);

            poTimeout3 = setTimeout(() => {
                lineFills[1].style.width = '100%';
            }, 1300);

            poTimeout4 = setTimeout(() => {
                nodes[2].classList.add('active-node');
            }, 2000);
        });

        poCard.addEventListener('mouseleave', () => {
            clearTimeout(poTimeout1);
            clearTimeout(poTimeout2);
            clearTimeout(poTimeout3);
            clearTimeout(poTimeout4);
            
            nodes[1].classList.remove('active-node');
            nodes[2].classList.remove('active-node');
            lineFills[0].style.width = '0%';
            lineFills[1].style.width = '0%';
        });
    }

    // Module 6: Invoice 3-Way Match Checkboxes
    const invoiceCard = document.getElementById('card-invoice-mgmt');
    const invoiceSim = document.querySelector('.invoice-sim');
    const ledgerRows = document.querySelectorAll('.matching-ledger .ledger-row');
    const matchStatus = document.querySelector('.matching-status');
    let invoiceTimeout1, invoiceTimeout2, invoiceTimeout3, invoiceTimeout4;

    if (invoiceCard && invoiceSim && ledgerRows.length > 0 && matchStatus) {
        invoiceCard.addEventListener('mouseenter', () => {
            matchStatus.textContent = 'CHECKING LEDGERS...';
            
            invoiceTimeout1 = setTimeout(() => { ledgerRows[0].classList.add('checked'); }, 400);
            invoiceTimeout2 = setTimeout(() => { ledgerRows[1].classList.add('checked'); }, 900);
            invoiceTimeout3 = setTimeout(() => { ledgerRows[2].classList.add('checked'); }, 1400);
            invoiceTimeout4 = setTimeout(() => {
                invoiceSim.classList.add('matched');
                matchStatus.textContent = '3-WAY MATCH VERIFIED';
            }, 1800);
        });

        invoiceCard.addEventListener('mouseleave', () => {
            clearTimeout(invoiceTimeout1);
            clearTimeout(invoiceTimeout2);
            clearTimeout(invoiceTimeout3);
            clearTimeout(poTimeout4);
            
            invoiceSim.classList.remove('matched');
            ledgerRows.forEach(row => row.classList.remove('checked'));
            matchStatus.textContent = 'MATCHING LEDGER...';
        });
    }
});
