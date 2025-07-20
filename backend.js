// server.js
// This is the backend for the Web SSH Client.
// It uses Express to serve the frontend and `express-ws` to handle WebSocket connections.
// The `ssh2` library is used to establish the actual SSH connection.

const express = require('express');
const http = require('http');
const expressWs = require('express-ws');
const { Client } = require('ssh2');

const app = express();
const server = http.createServer(app);
const wss = expressWs(server);

const PORT = 3000;

// Serve the frontend files from a 'public' directory
// IMPORTANT: Save the HTML file above as 'index.html' inside a folder named 'public'.
app.use(express.static('public'));

app.ws('/', (ws, req) => {
    console.log('WebSocket client connected');
    const ssh = new Client();

    // Handle incoming messages from the frontend
    ws.on('message', (msg) => {
        try {
            const parsedMsg = JSON.parse(msg);

            // --- Connection Handling ---
            if (parsedMsg.type === 'connect') {
                const { host, port, username, password } = parsedMsg;

                // Send a status update to the frontend
                const sendStatus = (data) => ws.send(JSON.stringify({ type: 'status', data }));
                const sendError = (data) => ws.send(JSON.stringify({ type: 'error', data }));

                ssh.on('ready', () => {
                    console.log(`SSH connection established to ${username}@${host}`);
                    sendStatus(`SSH connection successful. Opening shell...`);

                    ssh.shell({ term: 'xterm-color' }, (err, stream) => {
                        if (err) {
                            console.error('SSH shell error:', err);
                            sendError(`SSH shell error: ${err.message}`);
                            return ssh.end();
                        }

                        // --- Data Flow: SSH -> WebSocket -> Frontend ---
                        stream.on('data', (data) => {
                            ws.send(JSON.stringify({ type: 'data', data: data.toString('utf-8') }));
                        });

                        stream.on('close', () => {
                            console.log('SSH stream closed');
                            ssh.end();
                        });

                        // --- Data Flow: Frontend -> WebSocket -> SSH ---
                        // Re-register the message handler for this specific stream
                        ws.on('message', (streamMsg) => {
                            try {
                                const parsedStreamMsg = JSON.parse(streamMsg);
                                if (parsedStreamMsg.type === 'data') {
                                    stream.write(parsedStreamMsg.data);
                                } else if (parsedStreamMsg.type === 'resize') {
                                    stream.setWindow(parsedStreamMsg.rows, parsedStreamMsg.cols);
                                }
                            } catch (e) {
                                // Ignore non-JSON messages after connection is established
                            }
                        });
                    });
                });

                ssh.on('error', (err) => {
                    console.error(`SSH connection error: ${err.message}`);
                    sendError(`Connection error: ${err.message}`);
                });

                ssh.on('close', () => {
                    console.log('SSH connection closed');
                    if (ws.readyState === ws.OPEN) {
                        ws.close();
                    }
                });

                // Start the connection
                console.log(`Attempting to connect to ${username}@${host}:${port}`);
                ssh.connect({
                    host,
                    port,
                    username,
                    password,
                    // Increase timeout to handle slower connections
                    readyTimeout: 20000 
                });
            }
        } catch (e) {
            console.error('Failed to parse incoming message:', msg, e);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        // Ensure the SSH connection is terminated when the websocket closes
        if (ssh && ssh.writable) {
            ssh.end();
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Web SSH client backend is ready.');
    console.log("Make sure you've saved the frontend HTML in a 'public' directory.");
});
