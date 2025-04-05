const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const dns = require('dns');
const { promisify } = require('util');

const dnsResolve = promisify(dns.resolve);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to get IP from hostname
async function getIpFromHostname(hostname) {
    try {
        const addresses = await dnsResolve(hostname);
        return addresses[0];
    } catch (err) {
        return null;
    }
}

// Function to get coordinates from IP
async function getCoordinatesFromIp(ip) {
    return new Promise((resolve, reject) => {
        http.get(`http://ip-api.com/json/${ip}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.status === 'success') {
                        resolve({
                            lat: result.lat,
                            lon: result.lon,
                            country: result.country,
                            city: result.city
                        });
                    } else {
                        resolve(null);
                    }
                } catch (err) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function main() {
    // Load the stations file
    const appDataPath = path.join(process.env.HOME, 'Library', 'Application Support', 'my_radio');
    const filePath = path.join(appDataPath, 'stations_all.json');
    
    console.log('Loading stations from:', filePath);
    const stations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Find stations without coordinates
    const stationsWithoutCoords = stations.filter(s => !s.geo_lat || !s.geo_long);
    console.log(`Found ${stationsWithoutCoords.length} stations without coordinates`);
    
    let resolved = 0;
    let failed = 0;
    let rateLimited = 0;
    let processed = 0;
    
    // Process stations in batches (45 per minute due to API limits)
    const batchSize = 45;
    for (let i = 0; i < stationsWithoutCoords.length; i += batchSize) {
        const batch = stationsWithoutCoords.slice(i, i + batchSize);
        const batchNum = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(stationsWithoutCoords.length/batchSize);
        console.log(`\nProcessing batch ${batchNum} of ${totalBatches} (${processed}/${stationsWithoutCoords.length} stations processed)`);
        
        for (const station of batch) {
            try {
                // Extract hostname from URL
                let hostname;
                try {
                    const urlStr = station.url_resolved || station.url;
                    if (!urlStr) {
                        console.log(`❌ No URL for station: ${station.name}`);
                        failed++;
                        continue;
                    }
                    
                    // Try to extract hostname from URL string
                    hostname = urlStr.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
                    if (!hostname) {
                        console.log(`❌ Could not extract hostname from URL: ${urlStr}`);
                        failed++;
                        continue;
                    }
                } catch (urlErr) {
                    console.log(`❌ Invalid URL for: ${station.name} (${station.url_resolved || station.url})`);
                    failed++;
                    continue;
                }
                
                // Get IP address
                const ip = await getIpFromHostname(hostname);
                if (!ip) {
                    console.log(`❌ Could not resolve IP for: ${station.name} (${hostname})`);
                    failed++;
                    continue;
                }
                
                // Get coordinates from IP
                const coords = await getCoordinatesFromIp(ip);
                if (coords) {
                    station.geo_lat = coords.lat.toString();
                    station.geo_long = coords.lon.toString();
                    if (!station.country) station.country = coords.country;
                    if (!station.state) station.state = coords.city;
                    console.log(`✅ Found location for: ${station.name} - ${coords.city}, ${coords.country}`);
                    resolved++;
                } else {
                    console.log(`❌ Could not get location for: ${station.name} (${ip})`);
                    failed++;
                }
                
            } catch (err) {
                if (err.message && err.message.includes('429')) {
                    console.log('⚠️ Rate limited, waiting...');
                    rateLimited++;
                    await wait(60000); // Wait 1 minute
                    i -= 1; // Retry this station
                } else {
                    console.log(`❌ Error processing: ${station.name} - ${err.message || 'Unknown error'}`);
                    failed++;
                }
            }
            processed++;
        }
        
        // Save progress after each batch
        fs.writeFileSync(filePath, JSON.stringify(stations, null, 2));
        console.log('\nProgress saved to file');
        console.log(`Progress: ${processed}/${stationsWithoutCoords.length} (${Math.round(processed/stationsWithoutCoords.length*100)}%)`);
        console.log(`Success rate: ${Math.round(resolved/processed*100)}%`);
        
        // Wait 60 seconds before next batch (API limit)
        if (i + batchSize < stationsWithoutCoords.length) {
            console.log('Waiting 60 seconds before next batch...');
            await wait(60000);
        }
    }
    
    // Final statistics
    const withCoords = stations.filter(s => s.geo_lat && s.geo_long).length;
    console.log('\nFinal Statistics:');
    console.log(`Total stations: ${stations.length}`);
    console.log(`Stations with coordinates: ${withCoords}`);
    console.log(`Newly resolved: ${resolved}`);
    console.log(`Failed to resolve: ${failed}`);
    console.log(`Rate limit hits: ${rateLimited}`);
    console.log(`Success rate: ${Math.round(resolved/processed*100)}%`);
    
    // Save final results
    fs.writeFileSync(filePath, JSON.stringify(stations, null, 2));
    console.log(`\nSaved updated stations to: ${filePath}`);
}

// Run the script
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
}); 