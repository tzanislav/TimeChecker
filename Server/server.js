const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Your API credentials
const API_TOKEN = 'pk_55375489_89HPXA0TOGBQGBYARQ0ZGK3XG7T3SHTH';
const TEAM_ID = '37458550';

const headers = {
    'Authorization': API_TOKEN
};

// Helper to format time
const formatDuration = (ms) => {
    const seconds = ms / 1000;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
};

// Enable CORS for the frontend origin
app.use(cors({
    origin: 'http://127.0.0.1', // Your frontend origin
}));

app.get('/tasks', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const lastChangeTracker = new Map(); // Tracks task changes locally

app.get('/team-tasks', async (req, res) => {
    console.log('Fetching data...');
    try {
        const teamResponse = await axios.get(
            `https://api.clickup.com/api/v2/team/${TEAM_ID}`,
            { headers }
        );
        const members = teamResponse.data.team.members;

        const now = Date.now();
        const results = [];

        for (const member of members) {
            const memberId = member.user.id;
            const username = member.user.username;

            // Fetch current task for the member
            const taskResponse = await axios.get(
                `https://api.clickup.com/api/v2/team/${TEAM_ID}/time_entries/current`,
                { headers, params: { assignee: memberId } }
            );

            const task = taskResponse.data.data?.task || null;
            const taskName = task ? task.name : 'No Task';

            // Retrieve and update last change details
            const trackedTask = lastChangeTracker.get(memberId) || { taskId: null, timestamp: now };

            if (trackedTask.taskId !== (task?.id || 'No Task')) {
                // Task has changed (including to "No Task")
                lastChangeTracker.set(memberId, { taskId: task?.id || 'No Task', timestamp: now });
            }

            const updatedTask = lastChangeTracker.get(memberId);
            const timeSinceLastChange = now - updatedTask.timestamp;

            results.push({
                username,
                taskName,
                timeSinceLastChange: formatDuration(timeSinceLastChange),
            });
        }

        res.json(results);
    } catch (error) {
        console.error('Error fetching data:', error.response?.data || error.message);
        res.status(500).send('Server error');
    }
});


//Test the server
app.get('/', (req, res) => {
    res.send('Server is running');
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
