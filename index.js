const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Server is running successfully');
});

app.get('/ping', (req, res) => {
    res.send('pong 🏓');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
