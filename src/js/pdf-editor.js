/**
 * PDF Editor Module
 * Handles PDF editing operations using pdf-lib
 */

class PDFEditor {
  constructor() {
    this.pdfDoc = null;
    this.originalBuffer = null;
    this.currentFilePath = null;
    this.modified = false;
  }

  async loadPDF(arrayBuffer, filePath = null) {
    const { PDFDocument } = PDFLib;
    this.pdfDoc = await PDFDocument.load(arrayBuffer);
    this.originalBuffer = arrayBuffer.slice(0);
    this.currentFilePath = filePath;
    this.modified = false;
  }

  async save() {
    if (!this.pdfDoc) return null;

    // Apply all canvas annotations to PDF
    await this.applyAnnotations();

    const pdfBytes = await this.pdfDoc.save();
    this.modified = false;
    return pdfBytes;
  }

  async applyAnnotations() {
    if (!this.pdfDoc) return;

    const annotations = window.canvasLayer.getAllAnnotations();
    const pages = this.pdfDoc.getPages();

    for (let pageNum = 1; pageNum <= pages.length; pageNum++) {
      const pageAnnotations = annotations[pageNum];
      if (!pageAnnotations || !pageAnnotations.objects || pageAnnotations.objects.length === 0) {
        continue;
      }

      const page = pages[pageNum - 1];
      const { width, height } = page.getSize();

      // Get the fabric canvas data as image
      window.canvasLayer.loadPageAnnotations(pageNum);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for canvas to render

      const canvas = window.canvasLayer.getCanvas();
      if (!canvas) continue;

      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];

      if (base64) {
        try {
          const pngImage = await this.pdfDoc.embedPng(base64);
          const pngDims = pngImage.scale(1);

          // Calculate scaling to match page size
          const scaleX = width / pngDims.width;
          const scaleY = height / pngDims.height;

          page.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: width,
            height: height
          });
        } catch (error) {
          console.error('Failed to embed annotation image:', error);
        }
      }
    }
  }

  async rotatePage(pageNum, degrees) {
    if (!this.pdfDoc) return;

    const pages = this.pdfDoc.getPages();
    if (pageNum < 1 || pageNum > pages.length) return;

    const page = pages[pageNum - 1];
    const currentRotation = page.getRotation().angle;
    page.setRotation(PDFLib.degrees((currentRotation + degrees + 360) % 360));
    this.modified = true;
    window.tabManager?.markModified();
  }

  async deletePage(pageNum) {
    if (!this.pdfDoc) return false;

    const pageCount = this.pdfDoc.getPageCount();
    if (pageCount <= 1) {
      window.app?.showToast(window.i18n.t('errorMinPages'), 'error');
      return false;
    }

    if (pageNum < 1 || pageNum > pageCount) return false;

    this.pdfDoc.removePage(pageNum - 1);
    this.modified = true;
    window.tabManager?.markModified();
    return true;
  }

  async duplicatePage(pageNum) {
    if (!this.pdfDoc) return false;

    const pageCount = this.pdfDoc.getPageCount();
    if (pageNum < 1 || pageNum > pageCount) return false;

    const [copiedPage] = await this.pdfDoc.copyPages(this.pdfDoc, [pageNum - 1]);
    this.pdfDoc.insertPage(pageNum, copiedPage);
    this.modified = true;
    window.tabManager?.markModified();
    return true;
  }

  async movePage(fromPageNum, toPageNum) {
    if (!this.pdfDoc) return false;

    const pageCount = this.pdfDoc.getPageCount();
    if (fromPageNum < 1 || fromPageNum > pageCount) return false;
    if (toPageNum < 1 || toPageNum > pageCount) return false;
    if (fromPageNum === toPageNum) return false;

    const [copiedPage] = await this.pdfDoc.copyPages(this.pdfDoc, [fromPageNum - 1]);

    // Remove original page first
    this.pdfDoc.removePage(fromPageNum - 1);

    // Adjust target index after removal
    const insertIndex = toPageNum - 1;
    this.pdfDoc.insertPage(insertIndex, copiedPage);

    this.modified = true;
    window.tabManager?.markModified();
    return true;
  }

  async insertBlankPage(afterPageNum) {
    if (!this.pdfDoc) return false;

    // Get size of reference page
    const pages = this.pdfDoc.getPages();
    let width = 612; // Default US Letter width
    let height = 792; // Default US Letter height

    if (afterPageNum > 0 && afterPageNum <= pages.length) {
      const refPage = pages[afterPageNum - 1];
      const size = refPage.getSize();
      width = size.width;
      height = size.height;
    }

    const blankPage = this.pdfDoc.insertPage(afterPageNum, [width, height]);
    this.modified = true;
    window.tabManager?.markModified();
    return true;
  }

  async mergePDFs(pdfBuffers) {
    if (!this.pdfDoc) return false;

    const { PDFDocument } = PDFLib;

    for (const buffer of pdfBuffers) {
      const otherPdf = await PDFDocument.load(buffer);
      const pageIndices = Array.from({ length: otherPdf.getPageCount() }, (_, i) => i);
      const copiedPages = await this.pdfDoc.copyPages(otherPdf, pageIndices);

      copiedPages.forEach(page => {
        this.pdfDoc.addPage(page);
      });
    }

    this.modified = true;
    window.tabManager?.markModified();
    return true;
  }

  async splitPDF(pageRanges) {
    if (!this.pdfDoc) return null;

    const { PDFDocument } = PDFLib;

    // Parse page ranges like "1-3, 5, 7-10"
    const pageNumbers = this.parsePageRanges(pageRanges);
    if (pageNumbers.length === 0) return null;

    const newPdf = await PDFDocument.create();
    const pageIndices = pageNumbers.map(n => n - 1);
    const copiedPages = await newPdf.copyPages(this.pdfDoc, pageIndices);

    copiedPages.forEach(page => {
      newPdf.addPage(page);
    });

    return await newPdf.save();
  }

  parsePageRanges(rangeString) {
    const pageCount = this.pdfDoc.getPageCount();
    const pages = new Set();

    const parts = rangeString.split(',').map(s => s.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(pageCount, end); i++) {
            pages.add(i);
          }
        }
      } else {
        const num = parseInt(part);
        if (!isNaN(num) && num >= 1 && num <= pageCount) {
          pages.add(num);
        }
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }

  async addText(pageNum, text, x, y, options = {}) {
    if (!this.pdfDoc) return;

    const pages = this.pdfDoc.getPages();
    if (pageNum < 1 || pageNum > pages.length) return;

    const page = pages[pageNum - 1];
    const { height } = page.getSize();

    // Convert coordinates (PDF uses bottom-left origin)
    const pdfY = height - y;

    page.drawText(text, {
      x: x,
      y: pdfY,
      size: options.fontSize || 16,
      color: options.color || PDFLib.rgb(0, 0, 0),
      font: await this.pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica)
    });

    this.modified = true;
    window.tabManager?.markModified();
  }

  async addImage(pageNum, imageBytes, x, y, width, height) {
    if (!this.pdfDoc) return;

    const pages = this.pdfDoc.getPages();
    if (pageNum < 1 || pageNum > pages.length) return;

    const page = pages[pageNum - 1];
    const pageSize = page.getSize();

    // Embed image
    let image;
    try {
      image = await this.pdfDoc.embedPng(imageBytes);
    } catch {
      image = await this.pdfDoc.embedJpg(imageBytes);
    }

    // Convert coordinates (PDF uses bottom-left origin)
    const pdfY = pageSize.height - y - height;

    page.drawImage(image, {
      x: x,
      y: pdfY,
      width: width,
      height: height
    });

    this.modified = true;
    window.tabManager?.markModified();
  }

  getPageCount() {
    return this.pdfDoc ? this.pdfDoc.getPageCount() : 0;
  }

  isModified() {
    return this.modified;
  }

  getCurrentFilePath() {
    return this.currentFilePath;
  }

  setFilePath(path) {
    this.currentFilePath = path;
  }

  async reloadFromBuffer() {
    if (this.originalBuffer) {
      await this.loadPDF(this.originalBuffer, this.currentFilePath);
    }
  }
}

// Create global instance
window.pdfEditor = new PDFEditor();
