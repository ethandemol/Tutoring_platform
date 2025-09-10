import puppeteer from 'puppeteer';

class WebsiteScreenshotService {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
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

  async generateScreenshot(url, options = {}) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();
    
    try {
      // Set viewport for consistent screenshots
      await page.setViewport({
        width: 1200,
        height: 800,
        deviceScaleFactor: 1
      });

      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Navigate to the URL with timeout
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 20000 
      });

      // Wait a bit for any dynamic content to load (using setTimeout instead of waitForTimeout)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: 1200,
          height: 800
        }
      });

      return screenshot;
    } catch (error) {
      console.error('Error generating website screenshot:', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default new WebsiteScreenshotService(); 