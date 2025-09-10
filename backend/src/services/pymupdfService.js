import { spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

class PyMuPDFService {
  /**
   * Extract text from PDF using Python PyMuPDF
   * @param {Buffer} fileBuffer - PDF file buffer
   * @returns {Promise<Object>} Extracted text and metadata
   */
  async extractTextFromPDF(fileBuffer) {
    const tempDir = path.join(process.cwd(), 'tmp');
    const pdfPath = path.join(tempDir, `${uuidv4()}.pdf`);
    const outputPath = path.join(tempDir, `${uuidv4()}.json`);
    let scriptPath = null;
    
    try {
      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write PDF buffer to temporary file
      await writeFileAsync(pdfPath, fileBuffer);
      
      // Create Python script for PDF processing
      const pythonScript = `
import fitz
import json
import sys
import os

def extract_pdf_text(pdf_path, output_path):
    try:
        doc = fitz.open(pdf_path)
        page_count = doc.page_count
        
        extracted_text = ""
        page_texts = []
        metadata = {
            "title": doc.metadata.get("title", ""),
            "author": doc.metadata.get("author", ""),
            "subject": doc.metadata.get("subject", ""),
            "creator": doc.metadata.get("creator", ""),
            "producer": doc.metadata.get("producer", ""),
            "creationDate": doc.metadata.get("creationDate", ""),
            "modDate": doc.metadata.get("modDate", "")
        }
        
        for page_num in range(page_count):
            page = doc.load_page(page_num)
            text = page.get_text()
            page_texts.append(text)
            extracted_text += text + "\\n\\n"
            # Note: page.close() is not needed in newer PyMuPDF versions
        
        doc.close()
        
        result = {
            "text": extracted_text,
            "pages": page_count,
            "pageTexts": page_texts,
            "metadata": metadata,
            "success": True
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
            
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e)
        }
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(error_result, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    output_path = sys.argv[2]
    extract_pdf_text(pdf_path, output_path)
`;

      scriptPath = path.join(tempDir, `${uuidv4()}.py`);
      await writeFileAsync(scriptPath, pythonScript);
      
      // Run Python script
      const result = await this.runPythonScript(scriptPath, [pdfPath, outputPath]);
      
      if (result.success === false) {
        throw new Error(`PyMuPDF extraction failed: ${result.error}`);
      }
      
      return {
        text: result.text,
        pages: result.pages,
        pageTexts: result.pageTexts,
        info: result.metadata,
        metadata: {
          ...result.metadata,
          extractionMethod: 'pymupdf-python'
        }
      };
      
    } catch (error) {
      console.error('❌ [PyMuPDF] Python extraction failed:', error);
      throw error;
    } finally {
      // Clean up temporary files
      try {
        if (fs.existsSync(pdfPath)) await unlinkAsync(pdfPath);
        if (fs.existsSync(outputPath)) await unlinkAsync(outputPath);
        if (scriptPath && fs.existsSync(scriptPath)) await unlinkAsync(scriptPath);
      } catch (cleanupError) {
        console.warn('⚠️ [PyMuPDF] Could not clean up temp files:', cleanupError.message);
      }
    }
  }
  
  /**
   * Run Python script with arguments
   * @param {string} scriptPath - Path to Python script
   * @param {Array} args - Arguments to pass to script
   * @returns {Promise<Object>} Script result
   */
  runPythonScript(scriptPath, args) {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [scriptPath, ...args]);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Read the output file
            const outputPath = args[args.length - 1];
            const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse Python output: ${error.message}`));
          }
        } else {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }
}

export default new PyMuPDFService(); 