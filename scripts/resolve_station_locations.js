const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const dns = require('dns');
const { promisify } = require('util');

const dnsResolve = promisify(dns.resolve);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to extract base hostname from URL
function getBaseHostname(urlStr) {
    try {
        if (!urlStr) return null;
        return urlStr.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
    } catch (err) {
        return null;
    }
}

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
    
    // Group stations by base hostname
    const stationsByHost = new Map();
    let skippedUrls = 0;
    
    stationsWithoutCoords.forEach(station => {
        const hostname = getBaseHostname(station.url_resolved || station.url);
        if (!hostname) {
            skippedUrls++;
            return;
        }
        
        if (!stationsByHost.has(hostname)) {
            stationsByHost.set(hostname, []);
        }
        stationsByHost.get(hostname).push(station);
    });
    
    console.log(`\nURL Analysis:`);
    console.log(`Total unique hostnames: ${stationsByHost.size}`);
    console.log(`Skipped invalid URLs: ${skippedUrls}`);
    
    // Convert to array of unique hostnames for batch processing
    const uniqueHosts = Array.from(stationsByHost.keys());
    
    let resolved = 0;
    let failed = 0;
    let rateLimited = 0;
    let processed = 0;
    
    // Process unique hostnames in batches
    const batchSize = 45;
    for (let i = 0; i < uniqueHosts.length; i += batchSize) {
        const batch = uniqueHosts.slice(i, i + batchSize);
        const batchNum = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(uniqueHosts.length/batchSize);
        console.log(`\nProcessing batch ${batchNum} of ${totalBatches} (${processed}/${uniqueHosts.length} hosts processed)`);
        
        for (const hostname of batch) {
            try {
                // Get IP address
                const ip = await getIpFromHostname(hostname);
                if (!ip) {
                    console.log(`❌ Could not resolve IP for hostname: ${hostname}`);
                    failed++;
                    continue;
                }
                
                // Get coordinates from IP
                const coords = await getCoordinatesFromIp(ip);
                if (coords) {
                    // Update all stations with this hostname
                    const stationsToUpdate = stationsByHost.get(hostname);
                    stationsToUpdate.forEach(station => {
                        station.geo_lat = coords.lat.toString();
                        station.geo_long = coords.lon.toString();
                        if (!station.country) station.country = coords.country;
                        if (!station.state) station.state = coords.city;
                    });
                    
                    console.log(`✅ Found location for ${stationsToUpdate.length} stations at ${hostname} - ${coords.city}, ${coords.country}`);
                    resolved++;
                } else {
                    console.log(`❌ Could not get location for hostname: ${hostname} (${ip})`);
                    failed++;
                }
                
            } catch (err) {
                if (err.message && err.message.includes('429')) {
                    console.log('⚠️ Rate limited, waiting...');
                    rateLimited++;
                    await wait(60000); // Wait 1 minute
                    i -= 1; // Retry this hostname
                } else {
                    console.log(`❌ Error processing hostname: ${hostname} - ${err.message || 'Unknown error'}`);
                    failed++;
                }
            }
            processed++;
        }
        
        // Save progress after each batch
        fs.writeFileSync(filePath, JSON.stringify(stations, null, 2));
        console.log('\nProgress saved to file');
        console.log(`Progress: ${processed}/${uniqueHosts.length} hosts (${Math.round(processed/uniqueHosts.length*100)}%)`);
        console.log(`Success rate: ${Math.round(resolved/processed*100)}%`);
        
        // Wait 60 seconds before next batch (API limit)
        if (i + batchSize < uniqueHosts.length) {
            console.log('Waiting 60 seconds before next batch...');
            await wait(60000);
        }
    }
    
    // Final statistics
    const withCoords = stations.filter(s => s.geo_lat && s.geo_long).length;
    console.log('\nFinal Statistics:');
    console.log(`Total stations: ${stations.length}`);
    console.log(`Stations with coordinates: ${withCoords}`);
    console.log(`Unique hostnames processed: ${uniqueHosts.length}`);
    console.log(`Successfully resolved hostnames: ${resolved}`);
    console.log(`Failed hostnames: ${failed}`);
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