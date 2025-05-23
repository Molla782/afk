const mineflayer = require('mineflayer');
const bedrock = require('bedrock-protocol');
require('dotenv').config();

// Java Edition Configuration
const javaEnabled = process.env.JAVA_ENABLED === 'true';
const javaConfig = {
    host: process.env.HOST || 'localhost',
    port: parseInt(process.env.PORT || '25565'),
    username: process.env.USERNAME || 'AFKBot',
    version: process.env.VERSION || '1.21.70',
    auth: process.env.AUTH || 'microsoft'
};

// Bedrock Edition Configuration
const bedrockEnabled = process.env.BEDROCK_ENABLED === 'true';
const bedrockConfig = {
    host: process.env.BEDROCK_HOST || process.env.HOST || 'localhost',
    port: parseInt(process.env.BEDROCK_PORT || '19132'),
    username: process.env.BEDROCK_USERNAME || 'BedrockAFKBot',
    version: process.env.BEDROCK_VERSION || '1.21.70'  // Updated to a supported version
};

// Create the Java bot instance
let javaBot = null;
let bedrockClient = null;
let bedrockPingInterval = null;

// Start the connection process
if (javaEnabled) {
    console.log('Java Client - Attempting to connect with the following configuration:');
    console.log(JSON.stringify(javaConfig, null, 2));
    connectJava();
} else {
    console.log('Java Client - Disabled in configuration');
    // If Java is disabled, connect to Bedrock immediately
    connectBedrock();
}

setupConsoleInput();

// Function to connect to Java
function connectJava() {
    if (!javaEnabled) return;
    
    try {
        javaBot = mineflayer.createBot(javaConfig);
        setupJavaEventHandlers(javaBot);
    } catch (error) {
        console.error('Failed to create Java client:', error);
        console.log('[JAVA] Attempting to reconnect in 10 seconds...');
        setTimeout(connectJava, 10000);
    }
}

// Function to connect to Bedrock
function connectBedrock() {
    if (!bedrockEnabled) return;
    
    console.log('Bedrock Client - Attempting to connect with the following configuration:');
    console.log(JSON.stringify(bedrockConfig, null, 2));
    
    try {
        // Add a timeout to detect connection issues
        const connectionTimeout = setTimeout(() => {
            console.error('[BEDROCK] Connection attempt timed out after 30 seconds');
            console.error('[BEDROCK] This may indicate network issues or server incompatibility');
            console.log('[BEDROCK] Attempting to reconnect in 10 seconds...');
            setTimeout(connectBedrock, 10000);
        }, 30000);
        
        bedrockClient = bedrock.createClient({
            host: bedrockConfig.host,
            port: bedrockConfig.port,
            username: bedrockConfig.username,
            version: bedrockConfig.version,
            connectTimeout: 20000, // 20 second timeout
            skipPing: false // Make sure we ping the server first
        });
        
        // Remove this spawn handler since it's already in setupBedrockEventHandlers
        // bedrockClient.once('spawn', () => {
        //     clearTimeout(connectionTimeout);
        //     console.log('[BEDROCK] Successfully spawned in the world');
        // });
        
        // Just clear the timeout without logging the message
        bedrockClient.once('spawn', () => {
            clearTimeout(connectionTimeout);
        });
        
        setupBedrockEventHandlers(bedrockClient);
        
        // Clear the timeout if we connect successfully
        bedrockClient.once('connect', () => {
            clearTimeout(connectionTimeout);
        });
    } catch (error) {
        console.error('[BEDROCK] Failed to create Bedrock client:', error);
        
        // Check for specific error types to provide better feedback
        if (error.message && error.message.includes('version')) {
            console.error('[BEDROCK] Version compatibility issue detected. Please update the BEDROCK_VERSION in your .env file.');
            console.error('[BEDROCK] Server supports: 1.21.50-1.21.51, 1.21.60-1.21.62, 1.21.70');
            // Try with a different version
            console.log('[BEDROCK] Attempting to connect with version 1.20.60...');
            bedrockConfig.version = '1.20.60';
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.error('[BEDROCK] Connection to server failed. Please check if the server is running and accessible.');
        } else if (error.message && error.message.includes('authentication')) {
            console.error('[BEDROCK] Authentication failed. Please check your username.');
        }
        
        console.log('[BEDROCK] Attempting to reconnect in 10 seconds...');
        setTimeout(connectBedrock, 10000);
    }
}

function setupJavaEventHandlers(botInstance) {
    // Login event
    botInstance.on('login', () => {
        console.log(`[JAVA] Successfully connected to ${javaConfig.host}:${javaConfig.port}`);
        console.log(`[JAVA] Logged in as ${botInstance.username}`);
        console.log('[JAVA] AFK mode active - The bot will stay connected without moving');
        
        // Connect to Bedrock after Java has successfully connected
        if (bedrockEnabled) {
            console.log('[BEDROCK] Waiting 10 seconds before connecting to avoid authentication conflicts...');
            setTimeout(connectBedrock, 10000);
        }
    });
    
    // Error handling
    botInstance.on('error', (err) => {
        console.error('[JAVA] === ERROR DETAILS ===');
        console.error(`[JAVA] Error Type: ${err.name}`);
        console.error(`[JAVA] Error Message: ${err.message}`);
        console.error(`[JAVA] Error Code: ${err.code || 'N/A'}`);
        
        if (err.code === 'ECONNREFUSED') {
            console.error(`\n[JAVA] Connection refused to ${javaConfig.host}:${javaConfig.port}`);
            console.error('[JAVA] Possible causes:');
            console.error('[JAVA] 1. The Minecraft server is not running');
            console.error('[JAVA] 2. The server address or port is incorrect');
            console.error('[JAVA] 3. The server is blocking connections from this IP');
            console.error('[JAVA] 4. Firewall is blocking the connection');
        }
        
        if (err.errors && Array.isArray(err.errors)) {
            console.error('\n[JAVA] Detailed error information:');
            err.errors.forEach((e, i) => {
                console.error(`\n[JAVA] Error ${i+1}:`);
                console.error(`[JAVA]   Message: ${e.message}`);
                console.error(`[JAVA]   Code: ${e.code || 'N/A'}`);
                console.error(`[JAVA]   Address: ${e.address || 'N/A'}`);
                console.error(`[JAVA]   Port: ${e.port || 'N/A'}`);
                if (e.stack) console.error(`[JAVA]   Stack: ${e.stack}`);
            });
        }
        
        console.error('\n[JAVA] Full Error Stack:');
        console.error(err.stack);
        console.error('[JAVA] === END ERROR DETAILS ===');
        
        // For authentication errors, we should retry
        if (err.message && (
            err.message.includes('authentication') || 
            err.message.includes('Failed to obtain profile data')
        )) {
            console.log('[JAVA] Authentication error detected. Attempting to reconnect in 10 seconds...');
            setTimeout(connectJava, 10000);
        }
    });
    
    // Kicked event
    botInstance.on('kicked', (reason) => {
        console.log('[JAVA] === KICKED FROM SERVER ===');
        console.log('[JAVA] Reason:', reason);
        try {
            const jsonReason = JSON.parse(reason);
            if (jsonReason.text) {
                console.log('[JAVA] Message:', jsonReason.text);
            }
            if (jsonReason.extra) {
                console.log('[JAVA] Additional info:', jsonReason.extra.map(e => e.text).join(''));
            }
        } catch (e) {
            // Not JSON format, use as is
        }
        console.log('[JAVA] === END KICKED DETAILS ===');
    });
    
    // End event
    botInstance.on('end', (reason) => {
        console.log('[JAVA] === CONNECTION ENDED ===');
        console.log('[JAVA] Reason for disconnection:', reason || 'Unknown');
        console.log('[JAVA] === END CONNECTION DETAILS ===');
        
        // Add reconnection logic with check
        if (javaEnabled) {
            console.log('[JAVA] Attempting to reconnect in 5 seconds...');
            setTimeout(reconnectJava, 5000);
        } else {
            console.log('[JAVA] Reconnection disabled in configuration');
        }
    });
    
    // Health event
    botInstance.on('health', () => {
        // This event fires when the bot's health changes
        // We don't need to do anything, but listening to this event helps keep the connection alive
    });
    
    // Chat event
    botInstance.on('chat', (username, message) => {
        if (username === botInstance.username) return; // Ignore messages from the bot itself
        
        console.log(`[JAVA] ${username}: ${message}`);
        
        // Optional: Respond to specific commands
        if (message.toLowerCase() === '!ping') {
            botInstance.chat('Pong! I am a Java AFK bot.');
        }
    });
    
    // Add message event to catch all messages including system messages
    botInstance.on('message', (message) => {
        // This will log all messages, including system messages and command responses
        console.log(`[JAVA] Message: ${message.toString()}`);
    });
}

function setupBedrockEventHandlers(client) {
    // Set up a ping interval to keep the connection alive
    if (bedrockPingInterval) {
        clearInterval(bedrockPingInterval);
    }
    
    client.on('connect', () => {
        console.log(`[BEDROCK] Successfully connected to ${bedrockConfig.host}:${bedrockConfig.port}`);
        console.log(`[BEDROCK] Logged in as ${bedrockConfig.username}`);
        console.log('[BEDROCK] AFK mode active - The client will stay connected without moving');
        
        // Set up a ping interval to keep the connection alive
        bedrockPingInterval = setInterval(() => {
            try {
                if (client && client.connected) {
                    // Send a keep-alive packet if the client supports it
                    if (typeof client.write === 'function') {
                        client.write('level_sound_event', {
                            sound_id: 0,
                            position: { x: 0, y: 0, z: 0 },
                            extra_data: 0,
                            entity_type: '',
                            is_baby_mob: false,
                            is_global: false
                        });
                    }
                }
            } catch (e) {
                // Ignore errors in the ping
            }
        }, 30000); // Every 30 seconds
    });
    
    // Add a login packet handler to see if we're getting that far
    client.on('login', (packet) => {
        console.log('[BEDROCK] Received login packet from server');
    });
    
    // Add a spawn handler to confirm we're fully connected
    client.on('spawn', () => {
        console.log('[BEDROCK] Successfully spawned in the world');
    });
    
    // Add a packet handler to see all incoming packets for debugging
    client.on('packet', (packet, meta) => {
        // Fix: Check if meta exists before accessing its properties
        if (meta && meta.name === 'disconnect') {
            console.log(`[BEDROCK] Disconnect packet received: ${JSON.stringify(packet)}`);
        }
    });
    
    client.on('disconnect', (packet) => {
        console.log('[BEDROCK] === DISCONNECTED FROM SERVER ===');
        console.log('[BEDROCK] Reason:', packet?.reason || 'Unknown');
        console.log('[BEDROCK] === END DISCONNECT DETAILS ===');
        
        // Clear the ping interval
        if (bedrockPingInterval) {
            clearInterval(bedrockPingInterval);
            bedrockPingInterval = null;
        }
        
        // Add reconnection logic
        console.log('[BEDROCK] Attempting to reconnect in 5 seconds...');
        setTimeout(reconnectBedrock, 5000);
    });
    
    client.on('error', (err) => {
        console.error('[BEDROCK] === ERROR DETAILS ===');
        console.error(`[BEDROCK] Error: ${err.message}`);
        console.error('[BEDROCK] Full Error Stack:');
        console.error(err.stack);
        console.error('[BEDROCK] === END ERROR DETAILS ===');
        
        // Check for network-related errors
        if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
            console.error('[BEDROCK] Network connection interrupted.');
        } else if (err.message && err.message.includes('timed out')) {
            console.error('[BEDROCK] Connection timed out.');
        } else if (err.message && err.message.includes('sendto failed')) {
            console.error('[BEDROCK] Network error: sendto failed. This may indicate the server does not accept Bedrock connections.');
        }
        
        // Attempt to reconnect after an error
        console.log('[BEDROCK] Error occurred. Attempting to reconnect in 10 seconds...');
        setTimeout(connectBedrock, 10000);
    });
    
    client.on('text', (packet) => {
        // Handle chat messages
        if (packet.source !== bedrockConfig.username) {
            console.log(`[BEDROCK] ${packet.source || 'Server'}: ${packet.message}`);
        }
    });
    
    // Add additional message handlers if needed
    client.on('chat', (packet) => {
        if (packet.sender !== bedrockConfig.username) {
            console.log(`[BEDROCK] ${packet.sender || 'Unknown'}: ${packet.message}`);
        }
    });
}

function reconnectJava() {
    if (!javaEnabled) return; // Don't reconnect if Java is disabled
    
    console.log('[JAVA] Reconnecting...');
    connectJava();
}

function reconnectBedrock() {
    if (!bedrockEnabled) return;
    
    // Clear any existing ping interval
    if (bedrockPingInterval) {
        clearInterval(bedrockPingInterval);
        bedrockPingInterval = null;
    }
    
    console.log('[BEDROCK] Reconnecting...');
    connectBedrock();
}

// Keep the process running
process.on('SIGINT', () => {
    console.log('Disconnecting bots...');
    
    // Clear any existing ping interval
    if (bedrockPingInterval) {
        clearInterval(bedrockPingInterval);
        bedrockPingInterval = null;
    }
    
    if (javaBot) {
        javaBot.quit();
    }
    if (bedrockClient) {
        bedrockClient.disconnect();
    }
    process.exit();
});

function setupConsoleInput() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
    });
    
    console.log('Chat input enabled. Type messages to send to the server.');
    console.log('Use "/java <message>" to send a message from the Java client');
    console.log('Use "/bedrock <message>" to send a message from the Bedrock client');
    console.log('Use "/clear" to clear the console');
    console.log('Use "/quit" to disconnect and exit');
    
    rl.prompt();
    
    rl.on('line', (line) => {
        const trimmedLine = line.trim();
        
        if (trimmedLine === '/quit') {
            console.log('Disconnecting bots...');
            
            // Clear any existing ping interval
            if (bedrockPingInterval) {
                clearInterval(bedrockPingInterval);
                bedrockPingInterval = null;
            }
            
            if (javaBot) javaBot.quit();
            if (bedrockClient) bedrockClient.disconnect();
            process.exit();
        } else if (trimmedLine === '/clear') {
            console.clear();
            console.log('Console cleared. Chat input enabled.');
            console.log('Use "/java <message>" to send a message from the Java client');
            console.log('Use "/bedrock <message>" to send a message from the Bedrock client');
            console.log('Use "/clear" to clear the console');
            console.log('Use "/quit" to disconnect and exit');
        } else if (trimmedLine.startsWith('/java ')) {
            const message = trimmedLine.substring(6);
            if (javaBot) {
                console.log(`[JAVA] Sending: ${message}`);
                javaBot.chat(message);
            } else {
                console.log('[JAVA] Client is not connected or disabled');
            }
        } else if (trimmedLine.startsWith('/bedrock ')) {
            const message = trimmedLine.substring(9);
            if (bedrockClient) {
                console.log(`[BEDROCK] Sending: ${message}`);
                bedrockClient.queue('text', {
                    type: 'chat',
                    needs_translation: false,
                    source_name: bedrockConfig.username,
                    message: message,
                    parameters: [],
                    xuid: '',
                    platform_chat_id: ''
                });
            } else {
                console.log('[BEDROCK] Client is not connected or disabled');
            }
        } else {
            // Default to Java if connected, otherwise try Bedrock
            if (javaBot) {
                console.log(`[JAVA] Sending: ${trimmedLine}`);
                javaBot.chat(trimmedLine);
            } else if (bedrockClient) {
                console.log(`[BEDROCK] Sending: ${trimmedLine}`);
                bedrockClient.queue('text', {
                    type: 'chat', 
                    needs_translation: false,
                    source_name: bedrockConfig.username,
                    message: trimmedLine,
                    parameters: [],
                    xuid: '',
                    platform_chat_id: ''
                });
            } else {
                console.log('No clients are connected');
            }
        }
        
        rl.prompt();
    });
    
    rl.on('close', () => {
        console.log('Disconnecting bots...');
        
        // Clear any existing ping interval
        if (bedrockPingInterval) {
            clearInterval(bedrockPingInterval);
            bedrockPingInterval = null;
        }
        
        if (javaBot) javaBot.quit();
        if (bedrockClient) bedrockClient.disconnect();
        process.exit();
    });
}
