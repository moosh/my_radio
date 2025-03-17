import { UrlItem } from '../types/UrlItem';

interface StationData {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: Date;
}

type LogFunction = (message: string, type?: 'info' | 'error' | 'warning') => void;

export function parseStationsFile(content: string, log?: LogFunction): UrlItem[] {
  const defaultLog = (message: string, type?: 'info' | 'error' | 'warning') => console.log(message);
  const logger = log || defaultLog;

  logger('Starting to parse stations file');
  
  // Log raw content length and preview
  logger(`Raw content length: ${content.length} characters`);
  logger(`Raw content preview: "${content.substring(0, 100)}..."`);
  
  // Check for different line endings in raw content
  logger(`Contains \\r\\n: ${content.includes('\r\n')}`);
  logger(`Contains \\n: ${content.includes('\n')}`);
  logger(`Contains \\r: ${content.includes('\r')}`);

  // Handle different line endings and split into lines
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    logger(`Error at line 23: File has insufficient lines: ${lines.length}`, 'error');
    logger(`Error at line 24: Content preview: ${content.substring(0, 200)}...`);
    return [];
  }

  logger(`Line 28: Found ${lines.length} lines in file`);
  
  // Parse headers - log the raw first line for debugging
  const headerLine = lines[0];
  logger(`Line 32: Raw header line (${headerLine.length} chars): "${headerLine}"`);
  
  const headers = headerLine.split('\t');
  logger(`Line 35: Found ${headers.length} columns`);
  logger(`Line 36: Headers (${headers.length} total):`);
  headers.forEach((header, index) => {
    logger(`Line 38:   ${index}: "${header}"`);
  });

  // Find column indices
  const nameIndex = 0; // First column is Name
  const bitRateIndex = 19; // Bit Rate is the 20th column
  const sampleRateIndex = 20; // Sample Rate is the 21st column
  const locationIndex = 30; // Location is the last column

  logger(`Line 46: Using fixed column indices - Name: ${nameIndex}, Bit Rate: ${bitRateIndex}, Sample Rate: ${sampleRateIndex}, Location: ${locationIndex}`);

  return lines
    .slice(1) // Skip header row
    .filter((line, idx) => {
      const shouldKeep = line.trim() && !line.startsWith('Name\t');
      if (!shouldKeep) {
        logger(`Line ${idx + 2}: Skipping line: "${line.substring(0, 50)}..."`, 'warning');
      }
      return shouldKeep;
    })
    .map((line, idx) => {
      const values = line.split('\t');
      const lineNumber = idx + 2; // Add 2 to account for 0-based index and header row
      
      // Log the raw values for debugging
      logger(`Line ${lineNumber}: Processing line with ${values.length} columns:`);
      logger(`Line ${lineNumber}:   Name: "${values[nameIndex]}"`);
      logger(`Line ${lineNumber}:   Bit Rate: "${values[bitRateIndex]}"`);
      logger(`Line ${lineNumber}:   Sample Rate: "${values[sampleRateIndex]}"`);
      logger(`Line ${lineNumber}:   Location: "${values[locationIndex]}"`);
      
      // Get the URL from the Location column
      const url = values[locationIndex]?.trim();
      if (!url || !url.startsWith('http')) {
        logger(`Line ${lineNumber}: Skipping invalid URL: "${url}"`, 'warning');
        return null;
      }

      const station: StationData = {
        id: crypto.randomUUID(),
        url,
        title: values[nameIndex]?.trim() || 'Unnamed Station',
        description: `Bit Rate: ${values[bitRateIndex] || 'unknown'} kbps, Sample Rate: ${values[sampleRateIndex] || 'unknown'} Hz`,
        tags: ['radio', 'stream'],
        createdAt: new Date()
      };

      logger(`Line ${lineNumber}: Created station: ${station.title} (${station.url})`);
      return station;
    })
    .filter((item): item is StationData => item !== null) as UrlItem[];
} 