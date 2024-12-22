const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Store activity logs
const userLogs = {};

// Time to keep logs (7 days 8 hours in milliseconds)
const LOG_EXPIRY = 7 * 24 * 60 * 60 * 1000;

app.use(cors({
    origin: 'http://127.0.0.1', // Frontend origin
}));


// API credentials
const API_TOKEN = 'pk_55375489_89HPXA0TOGBQGBYARQ0ZGK3XG7T3SHTH';
const TEAM_ID = '37458550';

const headers = {
    'Authorization': API_TOKEN,
};


// Helper to format time
const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
};

// Track task changes locally
const lastChangeTracker = new Map();

// Function to update task changes periodically
async function updateTaskChanges() {
    console.log('Updating task changes...');
    try {
        const teamResponse = await axios.get(
            `https://api.clickup.com/api/v2/team/${TEAM_ID}`,
            { headers }
        );
        const members = teamResponse.data.team.members;

        const now = Date.now();

        for (const member of members) {
            const memberId = member.user.id;

            // Fetch current task for the member
            const taskResponse = await axios.get(
                `https://api.clickup.com/api/v2/team/${TEAM_ID}/time_entries/current`,
                { headers, params: { assignee: memberId } }
            );

            const task = taskResponse.data.data?.task || null;
            const taskName = task ? task.name : 'No Task';

            // Update the tracker if the task name has changed
            const trackedTask = lastChangeTracker.get(memberId) || { taskName: null, timestamp: now };
            if (trackedTask.taskName !== taskName) {
                lastChangeTracker.set(memberId, { taskName, timestamp: now });
                console.log(`Task updated for ${member.user.username}: ${taskName}`);
            }
        }
    } catch (error) {
        console.error('Error updating task changes:', error.response?.data || error.message);
    }
}

app.use(express.json());
// Endpoint to fetch team task data
app.get('/team-tasks', async (req, res) => {
    const now = Date.now();
    const results = [];

    try {
        const teamResponse = await axios.get(
            `https://api.clickup.com/api/v2/team/${TEAM_ID}`,
            { headers }
        );
        const members = teamResponse.data.team.members;

        for (const member of members) {
            const memberId = member.user.id;
            const username = member.user.username;

            // Retrieve task data from the tracker
            const trackedTask = lastChangeTracker.get(memberId) || { taskName: 'No Task', timestamp: now };
            const timeSinceLastChange = now - trackedTask.timestamp;

            results.push({
                username,
                taskName: trackedTask.taskName, // Use the task name
                timeSinceLastChange: formatDuration(timeSinceLastChange),
            });
        }

        res.json(results);
    } catch (error) {
        console.error('Error fetching data:', error.response?.data || error.message);
        res.status(500).send('Server error');
    }
});

// Periodic updates every minute
setInterval(updateTaskChanges, 60000); // 60 seconds

// Start the initial task update
updateTaskChanges();

//Test the server
app.get('/', (req, res) => {
    res.send('Server is running');
});

app.get('/tasks', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/logtime', (req, res) => {
    const { username, movement } = req.body;

    if (!username || !movement) {
        return res.status(400).send('Invalid data');
    }

    const now = Date.now();

    // Ensure there's an array for this user
    if (!userLogs[username]) {
        userLogs[username] = [];
    }

    // Add the new log
    if (movement > 50) {
        userLogs[username].push({ movement, timestamp: now });
    }

    // Clean up logs older than 8 hours
    userLogs[username] = userLogs[username].filter(log => now - log.timestamp <= LOG_EXPIRY);

    console.log(`Activity logged for ${username}: Movement ${movement}, Timestamp: ${now}`);
    res.send('Log received');
});

// Example route to view logs (for debugging purposes)
app.get('/logs', (req, res) => {
    res.json(userLogs);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
