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
if (javaEnabled) {
    console.log('Java Client - Attempting to connect with the following configuration:');
    console.log(JSON.stringify(javaConfig, null, 2));
    javaBot = mineflayer.createBot(javaConfig);
    setupJavaEventHandlers(javaBot);
} else {
    console.log('Java Client - Disabled in configuration');
    // If Java is disabled, connect to Bedrock immediately
    connectBedrock();
}

// Initialize Bedrock client if enabled
let bedrockClient = null;

// Function to connect to Bedrock
function connectBedrock() {
    if (!bedrockEnabled) return;
    
    console.log('Bedrock Client - Attempting to connect with the following configuration:');
    console.log(JSON.stringify(bedrockConfig, null, 2));
    
    try {
        bedrockClient = bedrock.createClient({
            host: bedrockConfig.host,
            port: bedrockConfig.port,
            username: bedrockConfig.username,
            version: bedrockConfig.version
        });
        
        setupBedrockEventHandlers(bedrockClient);
    } catch (error) {
        console.error('Failed to create Bedrock client:', error);
    }
}
setupConsoleInput();

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
}

function setupBedrockEventHandlers(client) {
    client.on('connect', () => {
        console.log(`[BEDROCK] Successfully connected to ${bedrockConfig.host}:${bedrockConfig.port}`);
        console.log(`[BEDROCK] Logged in as ${bedrockConfig.username}`);
        console.log('[BEDROCK] AFK mode active - The client will stay connected without moving');
    });
    
    client.on('disconnect', (packet) => {
        console.log('[BEDROCK] === DISCONNECTED FROM SERVER ===');
        console.log('[BEDROCK] Reason:', packet?.reason || 'Unknown');
        console.log('[BEDROCK] === END DISCONNECT DETAILS ===');
        
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
    console.log('[JAVA] Attempting to connect with the following configuration:');
    console.log(JSON.stringify(javaConfig, null, 2));
    
    // Create a new bot instance
    javaBot = mineflayer.createBot(javaConfig);
    
    // Reattach all event handlers
    if(javaBot) {
        setupJavaEventHandlers(javaBot);
    }
}

function reconnectBedrock() {
    if (!bedrockEnabled) return;
    
    console.log('[BEDROCK] Reconnecting...');
    console.log('[BEDROCK] Attempting to connect with the following configuration:');
    console.log(JSON.stringify(bedrockConfig, null, 2));
    
    try {
        // Create a new client instance
        bedrockClient = bedrock.createClient({
            host: bedrockConfig.host,
            port: bedrockConfig.port,
            username: bedrockConfig.username,
            version: bedrockConfig.version
        });
        
        // Reattach all event handlers
        setupBedrockEventHandlers(bedrockClient);
    } catch (error) {
        console.error('[BEDROCK] Failed to reconnect:', error);
        
        // Check if the error is related to version compatibility
        if (error.message && error.message.includes('version')) {
            console.error('[BEDROCK] Version compatibility issue detected. Please update the BEDROCK_VERSION in your .env file.');
            console.error('[BEDROCK] Server supports: 1.21.50-1.21.51, 1.21.60-1.21.62, 1.21.70');
        }
        
        console.log('[BEDROCK] Attempting to reconnect in 10 seconds...');
        setTimeout(reconnectBedrock, 10000);
    }
}
// Keep the process running
process.on('SIGINT', () => {
    console.log('Disconnecting bots...');
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
    console.log('Use "/quit" to disconnect and exit');
    
    rl.prompt();
    
    rl.on('line', (line) => {
        const trimmedLine = line.trim();
        
        if (trimmedLine === '/quit') {
            console.log('Disconnecting bots...');
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
                    xuid: '',
                    platform_chat_id: '',
                    message: message
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
                    message: message,
                    parameters: [], // Add missing parameters array
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
        if (javaBot) javaBot.quit();
        if (bedrockClient) bedrockClient.disconnect();
        process.exit();
    });
}
