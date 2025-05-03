const axios = require('axios');
const cheerio = require('cheerio');

function logProgress(msg) {
  console.log(`[WFMU Parser] ${msg}`);
}

function getS3UrlFromRtmp(rtmpUrl) {
  if (!rtmpUrl) return null;
  // Debug: log the RTMP URL received
  logProgress(`[getS3UrlFromRtmp] rtmpUrl: ${rtmpUrl}`);
  const match = rtmpUrl.match(/mp4:([A-Za-z]{2})\/([^"']+)/);
  if (match) {
    const code = match[1]; // Use the code as found, case preserved
    const filename = match[2];
    logProgress(`[getS3UrlFromRtmp] code: ${code}, filename: ${filename}`);
    return `https://s3.amazonaws.com/arch.wfmu.org/${code}/${filename}`;
  }
  return null;
}

async function getMediaUrlAndCue(popupUrl) {
  if (!popupUrl) return { url: '', cue_start: null };
  try {
    logProgress(`Fetching flashplayer page: ${popupUrl}`);
    const response = await axios.get(popupUrl);
    const $ = cheerio.load(response.data);
    const playlistData = $('textarea#playlist-data').text().trim();
    if (!playlistData) {
      logProgress('No playlist-data textarea found.');
      return { url: '', cue_start: null };
    }
    let data;
    try {
      data = JSON.parse(playlistData);
    } catch (err) {
      logProgress('Failed to parse JSON in playlist-data.');
      return { url: '', cue_start: null };
    }
    let cue_start = null;
    if (data['@attributes'] && data['@attributes']['offset']) {
      cue_start = data['@attributes']['offset'];
    }
    if (!cue_start && data.audio && data.audio['@attributes']) {
      cue_start = data.audio['@attributes'].cue || data.audio['@attributes'].start || null;
    }
    if (!cue_start) {
      cue_start = data.cue || data.start || null;
    }
    let url = '';
    if (data.audio && data.audio['@attributes']) {
      url = data.audio['@attributes'].url || '';
    }
    return { url, cue_start };
  } catch (err) {
    logProgress(`Error fetching flashplayer page: ${err}`);
    return { url: '', cue_start: null };
  }
}

async function scrapeWfmuPlaylists(playlistUrl, maxEntries, progressCallback) {
  logProgress(`Starting scrape for: ${playlistUrl}`);
  try {
    const response = await axios.get(playlistUrl);
    logProgress('Fetched playlist page HTML.');
    const $ = cheerio.load(response.data);

    // Extract playlist name from <link rel="alternate" ... title="..."> tag
    let playlistName = '';
    const rssLink = $('link[rel="alternate"][type="application/rss+xml"][title]');
    if (rssLink.length) {
      const titleAttr = rssLink.attr('title') || '';
      // Remove leading 'WFMU Playlists for ' if present
      playlistName = titleAttr.replace(/^WFMU Playlists for /i, '').replace(/ with .+$/, '').trim();
      if (!playlistName) playlistName = titleAttr.trim();
    }

    const playlistItems = [];
    const datePattern = /([A-Za-z]+ \d+,? (\d{4}))/;
    let entryCount = 0;
    $('li').each((_, li) => {
      const text = $(li).text().trim();
      if (!datePattern.test(text)) return;
      const dateMatch = text.match(datePattern);
      if (!dateMatch) return;
      const dateStr = dateMatch[1];
      const year = parseInt(dateMatch[2], 10);
      if (year <= 2024) return false;
      let playlistLink = '';
      let popupListenUrl = '';
      let showId = '';
      let archiveId = '';
      const links = $(li).find('a');
      links.each((_, a) => {
        const href = $(a).attr('href') || '';
        const linkText = $(a).text().trim();
        if (linkText.includes('See the playlist')) {
          playlistLink = 'https://www.wfmu.org' + href;
        } else if (linkText.includes('Pop-up') || (href.includes('flashplayer.php') && href.includes('version=3'))) {
          const parsed = new URL('https://www.wfmu.org' + href);
          showId = parsed.searchParams.get('show') || '';
          archiveId = parsed.searchParams.get('archive') || '';
          if (showId && archiveId) {
            popupListenUrl = `https://www.wfmu.org/flashplayer.php?version=3&show=${showId}&archive=${archiveId}`;
            return false; // break
          }
        }
        return undefined;
      });
      if (!popupListenUrl) return;
      let title = '';
      const bold = $(li).find('b').first();
      if (bold.length) {
        bold.find('a').remove();
        title = bold.text().trim().replace(/[.\s]+$/, '');
      }
      playlistItems.push({
        date: dateStr,
        title,
        show_id: showId,
        archive_id: archiveId,
        playlist_link: playlistLink,
        popup_listen_url: popupListenUrl,
        direct_media_url: '', // will be filled below
        mp4_listen_url: '', // will be filled below
        cue_start: null, // will be filled below
        raw_text: text,
      });
      entryCount++;
      if (maxEntries && entryCount >= maxEntries) return false;
      return undefined;
    });
    logProgress(`Found ${playlistItems.length} playlist entries. Fetching media URLs...`);
    if (progressCallback) progressCallback(0, playlistItems.length);
    for (let i = 0; i < playlistItems.length; i++) {
      const entry = playlistItems[i];
      logProgress(`Processing entry ${i + 1}/${playlistItems.length}: ${entry.title}`);
      const { url, cue_start } = await getMediaUrlAndCue(entry.popup_listen_url);
      entry.direct_media_url = url;
      // Debug: log direct_media_url before passing to getS3UrlFromRtmp
      logProgress(`  direct_media_url: ${url}`);
      entry.mp4_listen_url = getS3UrlFromRtmp(url);
      // Debug: log mp4_listen_url and code
      if (entry.mp4_listen_url) {
        const codeMatch = entry.mp4_listen_url.match(/arch\.wfmu\.org\/(\w{2})\//);
        logProgress(`  mp4_listen_url: ${entry.mp4_listen_url} (code: ${codeMatch ? codeMatch[1] : 'N/A'})`);
      } else {
        logProgress(`  mp4_listen_url: null`);
      }
      entry.cue_start = cue_start;
      logProgress(`  cue_start: ${cue_start}`);
      if (progressCallback) progressCallback(i + 1, playlistItems.length);
    }
    logProgress('Scraping complete.');
    return {
      playlist_name: playlistName,
      last_updated: new Date().toISOString(),
      source_url: playlistUrl,
      playlists: playlistItems,
    };
  } catch (err) {
    logProgress(`Error scraping WFMU playlists: ${err}`);
    throw err;
  }
}

module.exports = { scrapeWfmuPlaylists }; 