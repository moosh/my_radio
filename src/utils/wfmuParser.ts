import axios from 'axios';
import * as cheerio from 'cheerio';

export interface WfmuPlaylistEntry {
  date: string;
  title: string;
  show_id: string;
  archive_id: string;
  playlist_link: string;
  popup_listen_url: string;
  direct_media_url: string;
  mp4_listen_url: string | null;
  cue_start: string | null;
  raw_text: string;
}

export interface WfmuPlaylistResult {
  last_updated: string;
  source_url: string;
  playlists: WfmuPlaylistEntry[];
}

function logProgress(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[WFMU Parser] ${msg}`);
}

function getS3UrlFromRtmp(rtmpUrl: string | null): string | null {
  if (!rtmpUrl) return null;
  const match = rtmpUrl.match(/mp4:LM\/([^"']+)/);
  if (match) {
    const filename = match[1];
    return `https://s3.amazonaws.com/arch.wfmu.org/LM/${filename}`;
  }
  return null;
}

async function getMediaUrlAndCue(popupUrl: string): Promise<{ url: string; cue_start: string | null }> {
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
    let data: any;
    try {
      data = JSON.parse(playlistData);
    } catch (err) {
      logProgress('Failed to parse JSON in playlist-data.');
      return { url: '', cue_start: null };
    }
    let cue_start: string | null = null;
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

export async function scrapeWfmuPlaylists(playlistUrl: string, maxEntries = 4): Promise<WfmuPlaylistResult> {
  logProgress(`Starting scrape for: ${playlistUrl}`);
  try {
    const response = await axios.get(playlistUrl);
    logProgress('Fetched playlist page HTML.');
    const $ = cheerio.load(response.data);
    const playlistItems: WfmuPlaylistEntry[] = [];
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
      if (entryCount >= maxEntries) return false;
      return undefined;
    });
    logProgress(`Found ${playlistItems.length} playlist entries. Fetching media URLs...`);
    for (let i = 0; i < playlistItems.length; i++) {
      const entry = playlistItems[i];
      logProgress(`Processing entry ${i + 1}/${playlistItems.length}: ${entry.title}`);
      const { url, cue_start } = await getMediaUrlAndCue(entry.popup_listen_url);
      entry.direct_media_url = url;
      entry.mp4_listen_url = getS3UrlFromRtmp(url);
      entry.cue_start = cue_start;
      logProgress(`  direct_media_url: ${url}`);
      logProgress(`  mp4_listen_url: ${entry.mp4_listen_url}`);
      logProgress(`  cue_start: ${cue_start}`);
    }
    logProgress('Scraping complete.');
    return {
      last_updated: new Date().toISOString(),
      source_url: playlistUrl,
      playlists: playlistItems,
    };
  } catch (err) {
    logProgress(`Error scraping WFMU playlists: ${err}`);
    throw err;
  }
} 