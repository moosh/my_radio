const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const dns = require('dns');
const { promisify } = require('util');

const dnsResolve = promisify(dns.resolve);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to extract base hostname or IP from URL
function getBaseHostname(urlStr) {
    try {
        if (!urlStr) return null;
        
        // Remove protocol and get the host part
        const hostPart = urlStr.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
        
        // Check if it's an IP address (simple check for now)
        const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostPart);
        
        return {
            host: hostPart,
            isIp: isIp
        };
    } catch (err) {
        return null;
    }
}

// Function to get IP from hostname or return the IP if it's already an IP
async function getIpFromHostname(hostname, isIp) {
    try {
        if (isIp) {
            return hostname; // It's already an IP
        }
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
    let ipCount = 0;
    let hostnameCount = 0;
    
    stationsWithoutCoords.forEach(station => {
        const hostInfo = getBaseHostname(station.url_resolved || station.url);
        if (!hostInfo || !hostInfo.host) {
            skippedUrls++;
            return;
        }
        
        if (!stationsByHost.has(hostInfo.host)) {
            stationsByHost.set(hostInfo.host, {
                stations: [],
                isIp: hostInfo.isIp
            });
            if (hostInfo.isIp) ipCount++;
            else hostnameCount++;
        }
        stationsByHost.get(hostInfo.host).stations.push(station);
    });
    
    console.log(`\nURL Analysis:`);
    console.log(`Total unique hosts: ${stationsByHost.size}`);
    console.log(`- IP addresses: ${ipCount}`);
    console.log(`- Hostnames: ${hostnameCount}`);
    console.log(`Skipped invalid URLs: ${skippedUrls}`);
    
    // Convert to array of unique hosts for batch processing
    const uniqueHosts = Array.from(stationsByHost.entries());
    
    let resolved = 0;
    let failed = 0;
    let rateLimited = 0;
    let processed = 0;
    
    // Process unique hosts in batches
    const batchSize = 45;
    for (let i = 0; i < uniqueHosts.length; i += batchSize) {
        const batch = uniqueHosts.slice(i, i + batchSize);
        const batchNum = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(uniqueHosts.length/batchSize);
        console.log(`\nProcessing batch ${batchNum} of ${totalBatches} (${processed}/${uniqueHosts.length} hosts processed)`);
        
        for (const [host, info] of batch) {
            try {
                // Get IP address (or use the IP directly)
                const ip = await getIpFromHostname(host, info.isIp);
                if (!ip) {
                    console.log(`❌ Could not resolve IP for ${info.isIp ? 'IP' : 'hostname'}: ${host}`);
                    failed++;
                    continue;
                }
                
                // Get coordinates from IP
                const coords = await getCoordinatesFromIp(ip);
                if (coords) {
                    // Update all stations with this host
                    info.stations.forEach(station => {
                        station.geo_lat = coords.lat.toString();
                        station.geo_long = coords.lon.toString();
                        if (!station.country) station.country = coords.country;
                        if (!station.state) station.state = coords.city;
                    });
                    
                    console.log(`✅ Found location for ${info.stations.length} stations at ${host} - ${coords.city}, ${coords.country}`);
                    resolved++;
                } else {
                    console.log(`❌ Could not get location for ${info.isIp ? 'IP' : 'hostname'}: ${host} (${ip})`);
                    failed++;
                }
                
            } catch (err) {
                if (err.message && err.message.includes('429')) {
                    console.log('⚠️ Rate limited, waiting...');
                    rateLimited++;
                    await wait(60000); // Wait 1 minute
                    i -= 1; // Retry this host
                } else {
                    console.log(`❌ Error processing ${info.isIp ? 'IP' : 'hostname'}: ${host} - ${err.message || 'Unknown error'}`);
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
    console.log(`Unique hosts processed: ${uniqueHosts.length}`);
    console.log(`- IP addresses: ${ipCount}`);
    console.log(`- Hostnames: ${hostnameCount}`);
    console.log(`Successfully resolved: ${resolved}`);
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