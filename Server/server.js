const express = require('express');
const axios = require('axios');
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
    origin: 'http://127.0.0.1:5500', // Your frontend origin
}));

// Endpoint to fetch team members and their tasks
app.get('/team-tasks', async (req, res) => {

    console.log('Fetching data...');
    try {
        // Fetch team members
        const teamResponse = await axios.get(
            `https://api.clickup.com/api/v2/team/${TEAM_ID}`,
            { headers }
        );
        const members = teamResponse.data.team.members;

        const results = [];
        const now = Date.now();

        // Fetch tasks for each member
        for (const member of members) {
            const memberId = member.user.id;
            const username = member.user.username;

            const taskResponse = await axios.get(
                `https://api.clickup.com/api/v2/team/${TEAM_ID}/time_entries/current`,
                { headers, params: { assignee: memberId } }
            );

            const task = taskResponse.data.data?.task || null;
            const taskName = task ? task.name : 'No task';
            const lastChangeTime = task ? now : now - 3600000; // Default to 1 hour ago
            const timeSinceLastChange = now - lastChangeTime;

            results.push({
                username,
                taskName,
                timeSinceLastChange: formatDuration(timeSinceLastChange)
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
