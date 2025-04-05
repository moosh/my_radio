const fs = require('fs');
const path = require('path');
const https = require('https');

// Base URL for Radio Garden API
const API_BASE = 'https://radio.garden/api/ara/content';

// Function to format numbers with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Function to estimate remaining time
function estimateTimeRemaining(startTime, processed, total) {
    if (processed === 0) return 'Calculating...';
    
    const elapsed = Date.now() - startTime;
    const timePerItem = elapsed / processed;
    const remaining = (total - processed) * timePerItem;
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
}

// Function to make HTTP requests
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'MyRadio/1.0'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (err) {
                    console.error('Failed to parse response:', err);
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

// Function to get all places
async function getAllPlaces() {
    console.log('Fetching places...');
    const response = await makeRequest(`${API_BASE}/places`);
    if (!response.data?.list) {
        throw new Error('Unexpected places response structure');
    }
    const places = response.data.list;
    console.log(`Found ${formatNumber(places.length)} places`);
    return places;
}

// Function to get station details
async function getStationDetails(stationId) {
    const response = await makeRequest(`${API_BASE}/listen/${stationId}/channel.mp3`);
    return response;
}

// Function to get stations for a place
async function getStationsForPlace(placeId) {
    const placeData = await makeRequest(`${API_BASE}/page/${placeId}`);
    
    // The stations are in the first content item's items array
    const stations = placeData.data?.content?.[0]?.items || [];
    const validStations = stations.filter(item => item.page?.type === 'channel');
    
    return validStations;
}

// Extract tags from station data
function extractTags(station, place) {
    const tags = new Set();
    
    // Add place subtitle as tag
    if (place.subtitle) {
        tags.add(place.subtitle);
    }
    
    // Add country as tag
    if (station.page.country?.title) {
        tags.add(station.page.country.title);
    }
    
    // Add icon type as tag (if it exists and isn't generic)
    if (station.page.icon && station.page.icon !== 'generic') {
        tags.add(station.page.icon);
    }
    
    // Add stream type as tag
    if (station.page.stream) {
        tags.add(`stream:${station.page.stream}`);
    }
    
    return Array.from(tags);
}

// Function to format elapsed time
function formatElapsedTime(startTime) {
    const elapsed = Date.now() - startTime;
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
}

// Function to save progress
function saveProgress(stations, processedPlaces, startTime) {
    const appDataPath = path.join(process.env.HOME, 'Library', 'Application Support', 'my_radio');
    if (!fs.existsSync(appDataPath)) {
        fs.mkdirSync(appDataPath, { recursive: true });
    }
    
    const filePath = path.join(appDataPath, 'stations_radio_garden.json');
    fs.writeFileSync(filePath, JSON.stringify(stations, null, 2));
    
    const remaining = processedPlaces.total - processedPlaces.processed;
    const timeRemaining = estimateTimeRemaining(startTime, processedPlaces.processed, processedPlaces.total);
    console.log(`Saved ${formatNumber(stations.length)} stations, ${formatNumber(remaining)} places remaining (ETA: ${timeRemaining})`);
}

// Function to update progress display
function updateProgress(processedPlaces, stations, place, newStations, startTime) {
    // Clear the current line
    process.stdout.write('\r\x1b[K');
    
    const remaining = processedPlaces.total - processedPlaces.processed;
    const timeRemaining = estimateTimeRemaining(startTime, processedPlaces.processed, processedPlaces.total);
    const stationInfo = newStations.map(station => {
        const tags = station.tags.filter(t => !t.startsWith('stream:')).join(', ');
        return `${station.name} | ${station.country} | ${tags} | ${station.website}`;
    }).join(' || ');
    
    // Write the progress
    console.log(
        `[${formatNumber(remaining)} remaining | ETA: ${timeRemaining}] ` +
        `${place.title} (${place.country?.title || 'Unknown'}): ` +
        (stationInfo || 'No stations')
    );
}

// Main function
async function main() {
    try {
        const startTime = Date.now();
        
        // Get all places
        const places = await getAllPlaces();
        
        // Store all stations
        const allStations = [];
        const processedPlaces = {
            processed: 0,
            total: places.length,
            failed: 0
        };
        
        console.log('\nStarting station collection...\n');
        
        // Process each place
        for (const place of places) {
            try {
                processedPlaces.processed++;
                
                const stations = await getStationsForPlace(place.id);
                
                // Transform stations to our format
                const transformedStations = stations.map(station => ({
                    name: station.page.title || station.page.id,
                    url: station.page.stream || `https://radio.garden/api/ara/content/listen/${station.page.id}/channel.mp3`,
                    favicon: station.page.favicon || '',
                    tags: extractTags(station, place),
                    country: station.page.country?.title || place.country?.title || '',
                    language: station.page.language || '',
                    codec: 'MP3',
                    bitrate: station.page.bitrate || 128,
                    geo_lat: place.geo[1],
                    geo_long: place.geo[0],
                    website: station.page.website || '',
                    secure: station.page.secure || false,
                    description: [
                        place.subtitle,
                        `Stream via ${station.page.stream || 'unknown'}`,
                        station.page.description
                    ].filter(Boolean).join(' - ')
                }));
                
                allStations.push(...transformedStations);
                updateProgress(processedPlaces, allStations, place, transformedStations, startTime);
                
                // Save progress every 100 places
                if (processedPlaces.processed % 100 === 0) {
                    saveProgress(allStations, processedPlaces, startTime);
                }
                
                // Add a delay to avoid rate limiting
                const COURTESY_DELAY = 100;
                await new Promise(resolve => setTimeout(resolve, COURTESY_DELAY));
                
            } catch (err) {
                console.error(`Error: ${place.title} - ${err.message}`);
                processedPlaces.failed++;
            }
        }
        
        // Final save
        saveProgress(allStations, processedPlaces, startTime);
        
        console.log('\nFinal Statistics:');
        console.log('----------------');
        console.log(`Total runtime: ${formatElapsedTime(startTime)}`);
        console.log(`Total places processed: ${formatNumber(processedPlaces.processed)}`);
        console.log(`Failed places: ${formatNumber(processedPlaces.failed)}`);
        console.log(`Total stations found: ${formatNumber(allStations.length)}`);
        console.log(`Average stations per place: ${(allStations.length / processedPlaces.processed).toFixed(2)}`);
        console.log(`Success rate: ${((processedPlaces.processed - processedPlaces.failed) / processedPlaces.processed * 100).toFixed(1)}%`);
        
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

// Run the script
main(); 