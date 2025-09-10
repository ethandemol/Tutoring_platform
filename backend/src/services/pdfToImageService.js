import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

class PdfToImageService {
  /**
   * Convert PDF buffer to array of image buffers (PNG) using pdftoppm
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @returns {Promise<Array<{ pageNumber: number, buffer: Buffer }>>}
   */
  async convertPdfToImages(pdfBuffer) {
    // Create temporary directory for this conversion
    const tempDir = path.join(process.cwd(), 'tmp', uuidv4());
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Write PDF buffer to temporary file
    const pdfPath = path.join(tempDir, 'input.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);
    
    try {
      // Use pdftoppm to convert PDF to PNG images
      // -png: output PNG format
      // -r 300: 300 DPI for high quality
      // -aa yes: enable anti-aliasing
      const outputPrefix = path.join(tempDir, 'page');
      const command = `pdftoppm -png -r 300 -aa yes "${pdfPath}" "${outputPrefix}"`;
      
      console.log(`🔄 [PDF2G] Running pdftoppm command: ${command}`);
      console.log(`📄 [PDF2 PDF file size: ${pdfBuffer.length} bytes`);
      console.log(`📄 [PDF2G] PDF file exists: ${fs.existsSync(pdfPath)}`);
      
      try {
        await execAsync(command);
      } catch (error) {
        console.error(`❌ [PDF2G] pdftoppm error: ${error.message}`);
        console.error(`❌ [PDF2G] pdftoppm stderr: ${error.stderr}`);
        throw new Error(`pdftoppm failed: ${error.message}`);
      }
      
      // Debug: List all files in temp directory
      console.log(`🔍 [PDF2G] Files in temp directory:`);
      const files = fs.readdirSync(tempDir);
      files.forEach(file => {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        console.log(`  - ${file} (${stats.size} bytes)`);
      });
      
      // Read generated PNG files
      const images = [];
      let pageNumber = 1;
      
      while (true) {
        // Try both naming patterns that pdftoppm might use
        const pngPath1 = `${outputPrefix}-${pageNumber.toString().padStart(6, '0')}.png`;
        const pngPath2 = `${outputPrefix}-${pageNumber}.png`;
        
        console.log(`🔍 [PDF2G] Checking for PNG: ${pngPath1} or ${pngPath2}`);
        
        let pngPath = null;
        if (fs.existsSync(pngPath1)) {
          pngPath = pngPath1;
        } else if (fs.existsSync(pngPath2)) {
          pngPath = pngPath2;
        }
        
        if (!pngPath) {
          console.log(`❌ [PDF2G] PNG file not found: ${pngPath1} or ${pngPath2}`);
          break;
        }
        
        const buffer = fs.readFileSync(pngPath);
        console.log(`✅ [PDF2G] Found PNG: ${pngPath}, size: ${buffer.length} bytes`);
        images.push({ pageNumber, buffer });
        pageNumber++;
      }
      
      console.log(`✅PDF2Converted ${images.length} pages using pdftoppm`);
      return images;
      
    } finally {
      // Clean up temporary files
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`⚠️ [PDF2IMG] Could not clean up temp directory: ${error.message}`);
      }
    }
  }
}

export default new PdfToImageService(); 