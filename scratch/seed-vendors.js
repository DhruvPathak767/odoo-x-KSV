const db = require('../config/db');
const bcrypt = require('bcryptjs');

const vendorsData = [
    { name: 'raj', email: 'raj@gmail.com', company: 'Raj Enterprises', gst: '27GST9999990001', category: 'Raw Materials' },
    { name: 'sahil', email: 'sahil@gmail.com', company: 'Sahil Steel Corporation', gst: '27GST9999990002', category: 'IT & Software Services' },
    { name: 'harsh', email: 'harsh@gmail.com', company: 'Harsh Chemicals', gst: '27GST9999990003', category: 'Chemicals' },
    { name: 'neel', email: 'neel@gmail.com', company: 'Neel Logistics', gst: '27GST9999990004', category: 'Logistics & Freight' },
    { name: 'akash', email: 'akash@gmail.com', company: 'Akash Mfg Co', gst: '27GST9999990005', category: 'Raw Materials' },
    { name: 'aryan', email: 'aryan@gmail.com', company: 'Aryan Solutions', gst: '27GST9999990006', category: 'IT & Software Services' }
];

async function seed() {
    try {
        console.log('Generating password hash...');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('password123', salt);
        console.log('Password hash generated successfully.');

        for (const v of vendorsData) {
            console.log(`Checking if user ${v.email} exists...`);
            const [existing] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [v.email]);
            
            let userId;
            if (existing.length === 0) {
                console.log(`Inserting user for ${v.name}...`);
                const [userResult] = await db.execute(
                    'INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
                    [v.name, v.email, passwordHash, 'vendor', 1]
                );
                userId = userResult.insertId;
                console.log(`User created with ID ${userId}.`);
            } else {
                userId = existing[0].id;
                console.log(`User already exists with ID ${userId}. Updating password...`);
                await db.execute('UPDATE users SET password = ?, role = "vendor", is_active = 1 WHERE id = ?', [passwordHash, userId]);
            }

            console.log(`Checking if vendor profile for user ${userId} exists...`);
            const [existingProfile] = await db.execute('SELECT id FROM vendor_profiles WHERE user_id = ? LIMIT 1', [userId]);

            if (existingProfile.length === 0) {
                console.log(`Inserting vendor profile for company ${v.company}...`);
                await db.execute(
                    `INSERT INTO vendor_profiles 
                     (user_id, company_name, gst_number, category, contact_person, phone, address, city, state, country, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        v.company,
                        v.gst,
                        v.category,
                        v.name,
                        '9876543210',
                        '123 Industrial Area, Sector 5',
                        'Mumbai',
                        'Maharashtra',
                        'India',
                        'Approved'
                    ]
                );
                console.log(`Vendor profile created successfully.`);
            } else {
                console.log(`Vendor profile already exists for user ${userId}. Updating...`);
                await db.execute(
                    `UPDATE vendor_profiles 
                     SET company_name = ?, gst_number = ?, category = ?, contact_person = ?, status = 'Approved' 
                     WHERE user_id = ?`,
                    [v.company, v.gst, v.category, v.name, userId]
                );
                console.log(`Vendor profile updated successfully.`);
            }
            console.log('--------------------------------------------------');
        }
        console.log('Seeding complete! All vendor users seeded successfully.');
        console.log('Credentials for all accounts:');
        vendorsData.forEach(v => {
            console.log(`- Email: ${v.email} | Password: password123`);
        });
    } catch (err) {
        console.error('Error during seeding:', err);
    } finally {
        process.exit(0);
    }
}

seed();
