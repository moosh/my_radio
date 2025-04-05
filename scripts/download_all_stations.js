const fs = require('fs');
const path = require('path');
const https = require('https');
const { app } = require('electron');

// Function to get a random server from the Radio Browser API
async function getRandomServer() {
    return new Promise((resolve, reject) => {
        https.get('https://all.api.radio-browser.info/json/servers', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const servers = JSON.parse(data);
                    const randomServer = servers[Math.floor(Math.random() * servers.length)];
                    resolve(randomServer.name);
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

// Function to download all stations
async function downloadAllStations(server) {
    return new Promise((resolve, reject) => {
        // Using stations/list endpoint which returns all stations
        const url = `https://${server}/json/stations`;
        console.log('Fetching stations from:', url);
        
        const options = {
            headers: {
                'User-Agent': 'MyRadio/1.0'  // Adding user agent to avoid potential rate limiting
            }
        };
        
        https.get(url, options, (res) => {
            let data = '';
            
            res.on('data', chunk => {
                data += chunk;
                process.stdout.write(`Downloading... ${data.length} bytes\r`);
            });
            
            res.on('end', () => {
                try {
                    console.log('\nDownload complete. Parsing JSON...');
                    const stations = JSON.parse(data);
                    console.log(`Successfully downloaded ${stations.length} stations`);
                    resolve(stations);
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

// Main function
async function main() {
    try {
        // Get a random server
        const server = await getRandomServer();
        console.log('Using server:', server);

        // Download all stations
        const stations = await downloadAllStations(server);

        // Create the app data directory if it doesn't exist
        const appDataPath = path.join(process.env.HOME, 'Library', 'Application Support', 'my_radio');
        if (!fs.existsSync(appDataPath)) {
            fs.mkdirSync(appDataPath, { recursive: true });
        }

        // Save to file
        const filePath = path.join(appDataPath, 'stations_all.json');
        fs.writeFileSync(filePath, JSON.stringify(stations, null, 2), 'utf8');
        console.log(`Saved ${stations.length} stations to:`, filePath);
        
        // Print some statistics
        const withCoords = stations.filter(s => s.geo_lat && s.geo_long).length;
        console.log('\nStatistics:');
        console.log(`Total stations: ${stations.length}`);
        console.log(`Stations with coordinates: ${withCoords}`);
        console.log(`File size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`);
        
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

// Run the script
main(); 