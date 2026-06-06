import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { initializeDatabase } from './src/config/initDb.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await initializeDatabase();
        
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

