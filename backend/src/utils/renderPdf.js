import { chromium } from 'playwright';
import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Singleton browser instance for performance
let browser = null;
let page = null;

// Template cache
const templateCache = new Map();

// Initialize browser singleton
async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

// Get or create page instance
async function getPage() {
  if (!page) {
    const browserInstance = await getBrowser();
    page = await browserInstance.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewportSize({ width: 1200, height: 1600 });
  }
  return page;
}

// Load and compile template
async function loadTemplate(templateName) {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName);
  }

  const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.hbs`);
  const templateContent = await fs.readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);
  
  templateCache.set(templateName, template);
  return template;
}

// Register KaTeX helper for math rendering
Handlebars.registerHelper('katex', function(expression) {
  const isDisplay = expression.startsWith('$$') && expression.endsWith('$$');
  const math = expression.replace(/^\$\$|\$\$$/g, '');
  
  if (isDisplay) {
    return `<div class="katex-display">\\(${math}\\)</div>`;
  } else {
    return `<span class="katex">\\(${math}\\)</span>`;
  }
});

// Register helper for question numbering
Handlebars.registerHelper('inc', function(value) {
  return value + 1;
});

// Register helper for conditional classes
Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
});



// Main PDF generation function
export async function generatePdf(docJson) {
  try {
    const { type, title, ...data } = docJson;
    
    // Load appropriate template
    const template = await loadTemplate(type);
    
    // Prepare template data
    const templateData = {
      title,
      ...data,
      generatedAt: new Date().toLocaleDateString(),
      generatedTime: new Date().toLocaleTimeString()
    };
    
    // Render HTML
    const html = template(templateData);
    
    // Get page instance
    const pageInstance = await getPage();
    
    // Set content and wait for rendering
    await pageInstance.setContent(html, {
      waitUntil: 'networkidle'
    });
    
    // Generate PDF
    const pdfBuffer = await pageInstance.pdf({
      format: 'A4',
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      },
      printBackground: true,
      preferCSSPageSize: true
    });
    
    // Return PDF
    return pdfBuffer;
    
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

// Cleanup function for graceful shutdown
export async function cleanup() {
  if (page) {
    await page.close();
    page = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// Warm up browser for better performance
export async function warmup() {
  try {
    console.log('🔥 Warming up PDF renderer...');
    const testData = {
      type: 'exam',
      title: 'Test',
      questions: [{ q: 'Test question', a: 'Test answer' }]
    };
    await generatePdf(testData);
    console.log('✅ PDF renderer warmed up successfully');
  } catch (error) {
    console.error('❌ PDF renderer warmup failed:', error);
    
    // Check if it's a Playwright installation error
    if (error.message.includes('Executable doesn\'t exist') || error.message.includes('npx playwright install')) {
      console.log('⚠️ Playwright browsers not installed. PDF generation will be disabled.');
      console.log('💡 To enable PDF generation, run: npx playwright install chromium');
    }
  }
} 