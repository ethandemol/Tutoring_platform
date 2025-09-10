import puppeteer from 'puppeteer';
import { OpenAI } from 'openai';
import youtubeTranscriptService from './youtubeTranscriptService.js';
import youtubeTranscriptCacheService from './youtubeTranscriptCacheService.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class UrlProcessingService {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  isYouTubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url);
  }

  extractYouTubeVideoId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  async extractYouTubeInfo(url) {
    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();
      
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
      
      // Extract video information
      const videoInfo = await page.evaluate(() => {
        const title = document.querySelector('meta[property="og:title"]')?.content ||
                     document.querySelector('title')?.textContent ||
                     'Unknown Title';
        
        const description = document.querySelector('meta[property="og:description"]')?.content ||
                           document.querySelector('meta[name="description"]')?.content ||
                           '';
        
        const thumbnail = document.querySelector('meta[property="og:image"]')?.content ||
                         document.querySelector('meta[name="twitter:image"]')?.content ||
                         '';
        
        const channel = document.querySelector('meta[property="og:site_name"]')?.content ||
                       document.querySelector('link[rel="canonical"]')?.href?.split('/')[2] ||
                       'Unknown Channel';
        
        return {
          title,
          description,
          thumbnail,
          channel,
          type: 'youtube'
        };
      });
      
      await page.close();
      
      // Extract video ID and fetch transcript
      const videoId = this.extractYouTubeVideoId(url);
      if (videoId) {
        try {
          console.log(`🎬 [URL-PROCESS] Fetching transcript for video: ${videoId}`);
          
          // Configure proxy if available (you can set this in environment variables)
          const proxyConfig = process.env.YOUTUBE_PROXY_USERNAME && process.env.YOUTUBE_PROXY_PASSWORD ? {
            proxy_username: process.env.YOUTUBE_PROXY_USERNAME,
            proxy_password: process.env.YOUTUBE_PROXY_PASSWORD
          } : null;
          
          const processedData = await youtubeTranscriptCacheService.getProcessedTranscript(
            videoId, 
            proxyConfig, 
            null, // userId - can be passed from the request context
            {
              title: videoInfo.title,
              description: videoInfo.description,
              channelName: videoInfo.channel
            }
          );
          
          if (processedData.hasTranscript) {
            return {
              ...videoInfo,
              videoId,
              transcript: processedData.transcript,
              processedTranscript: processedData.processedTranscript,
              transcriptContent: processedData.transcriptContent,
              transcriptSummary: processedData.transcriptSummary,
              hasTranscript: true
            };
          } else {
            console.warn(`⚠️ [URL-PROCESS] Failed to fetch transcript for video ${videoId}`);
            return {
              ...videoInfo,
              videoId,
              hasTranscript: false,
              transcriptError: 'Failed to process transcript'
            };
          }
        } catch (transcriptError) {
          console.warn(`⚠️ [URL-PROCESS] Error fetching transcript for video ${videoId}:`, transcriptError.message);
          return {
            ...videoInfo,
            videoId,
            hasTranscript: false,
            transcriptError: transcriptError.message
          };
        }
      }
      
      return videoInfo;
    } catch (error) {
      console.error('Error extracting YouTube info:', error);
      throw new Error('Failed to extract YouTube video information');
    }
  }

  async extractWebsiteContent(url) {
    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();
      
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
      
      // Extract website content
      const content = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, nav, footer, header, aside');
        scripts.forEach(el => el.remove());
        
        // Get main content
        const title = document.querySelector('meta[property="og:title"]')?.content ||
                     document.querySelector('title')?.textContent ||
                     document.querySelector('h1')?.textContent ||
                     'Unknown Title';
        
        const description = document.querySelector('meta[property="og:description"]')?.content ||
                           document.querySelector('meta[name="description"]')?.content ||
                           '';
        
        // Get main content text
        const mainContent = document.querySelector('main') || 
                           document.querySelector('article') || 
                           document.querySelector('.content') ||
                           document.querySelector('.main') ||
                           document.body;
        
        const textContent = mainContent.textContent || '';
        
        // Clean up the text
        const cleanedText = textContent
          .replace(/\s+/g, ' ')
          .replace(/\n+/g, '\n')
          .trim()
          .substring(0, 10000); // Increased limit for better content
        
        return {
          title,
          description,
          content: cleanedText,
          type: 'website'
        };
      });
      
      await page.close();
      return content;
    } catch (error) {
      console.error('Error extracting website content:', error);
      throw new Error('Failed to extract website content');
    }
  }

  async processUrl(url) {
    try {
      if (this.isYouTubeUrl(url)) {
        const videoInfo = await this.extractYouTubeInfo(url);
        const videoId = this.extractYouTubeVideoId(url);
        return {
          ...videoInfo,
          videoId,
          originalUrl: url
        };
      } else {
        const websiteInfo = await this.extractWebsiteContent(url);
        return {
          ...websiteInfo,
          originalUrl: url
        };
      }
    } catch (error) {
      console.error('Error processing URL:', error);
      throw error;
    }
  }

  async generateSummary(content, type) {
    try {
      let prompt = '';
      
      if (type === 'youtube') {
        prompt = `Please provide a comprehensive summary of this YouTube video content. Include key points, main topics discussed, and any important insights. Format the response in a clear, structured manner. Do NOT add any 'Summary of' titles or similar prefixes.

Title: ${content.title}
Description: ${content.description}
Channel: ${content.channel}

Please provide a detailed summary:`;
      } else {
        prompt = `Please provide a comprehensive summary of this website content. Include key points, main topics, and important information. Format the response in a clear, structured manner. Do NOT add any 'Summary of' titles or similar prefixes.

Title: ${content.title}
Description: ${content.description}
Content: ${content.content.substring(0, 2000)}...

Please provide a detailed summary:`;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that provides clear, concise summaries of web content and YouTube videos. Focus on extracting the most important information and presenting it in an organized way. Do NOT add any 'Summary of' titles or similar prefixes."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        stream: false,
      });

      let summary = response.choices[0].message.content;
      
      // Post-process to remove any "Summary of" titles that GPT might add
      summary = summary
        .replace(/^Summary of\s+["""].*?["""]\s*:?\s*/gi, '') // Remove "Summary of "title":"
        .replace(/^Summary of\s+.*?\s*:?\s*/gi, '') // Remove "Summary of title:"
        .replace(/^Summary\s*:?\s*/gi, '') // Remove "Summary:"
        .replace(/^Overview\s*:?\s*/gi, '') // Remove "Overview:"
        .trim();
      
      return summary;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error('Failed to generate content summary');
    }
  }
}

export default new UrlProcessingService(); 