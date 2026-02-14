/**
 * PDF Renderer Module
 * Handles PDF rendering using PDF.js
 */

class PDFRenderer {
  constructor() {
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.0;
    this.pageRotations = {}; // Store page-specific rotations
    this.canvas = null;
    this.ctx = null;
    this.rendering = false;
    this.pendingRender = null;
  }

  setCanvas(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  async loadPDF(arrayBuffer) {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      throw new Error('PDF.js not loaded');
    }

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: './lib/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: './lib/pdfjs/standard_fonts/',
    });
    this.pdfDoc = await loadingTask.promise;
    this.totalPages = this.pdfDoc.numPages;
    this.currentPage = 1;
    this.pageRotations = {};

    return {
      totalPages: this.totalPages
    };
  }

  async renderPage(pageNum = this.currentPage) {
    if (!this.pdfDoc || !this.canvas) return null;

    // Handle concurrent render requests
    if (this.rendering) {
      this.pendingRender = pageNum;
      return null;
    }

    this.rendering = true;

    try {
      const page = await this.pdfDoc.getPage(pageNum);

      // Get page rotation (original + user rotation)
      const originalRotation = page.rotate;
      const userRotation = this.pageRotations[pageNum] || 0;
      const totalRotation = (originalRotation + userRotation) % 360;

      // Calculate viewport with rotation
      const viewport = page.getViewport({
        scale: this.scale,
        rotation: totalRotation
      });

      // Set canvas dimensions
      this.canvas.width = viewport.width;
      this.canvas.height = viewport.height;

      // Render page
      const renderContext = {
        canvasContext: this.ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      this.currentPage = pageNum;

      // Dispatch event with page info
      window.dispatchEvent(new CustomEvent('pageRendered', {
        detail: {
          pageNum,
          width: viewport.width,
          height: viewport.height,
          scale: this.scale,
          rotation: totalRotation
        }
      }));

      // Handle pending render
      if (this.pendingRender !== null && this.pendingRender !== pageNum) {
        const nextPage = this.pendingRender;
        this.pendingRender = null;
        this.rendering = false;
        return this.renderPage(nextPage);
      }

      return {
        width: viewport.width,
        height: viewport.height,
        rotation: totalRotation
      };

    } catch (error) {
      console.error('Error rendering page:', error);
      throw error;
    } finally {
      this.rendering = false;
    }
  }

  async renderThumbnail(pageNum, thumbnailCanvas, maxWidth = 120) {
    if (!this.pdfDoc) return;

    const page = await this.pdfDoc.getPage(pageNum);

    const originalRotation = page.rotate;
    const userRotation = this.pageRotations[pageNum] || 0;
    const totalRotation = (originalRotation + userRotation) % 360;

    // Calculate scale to fit thumbnail
    const originalViewport = page.getViewport({ scale: 1, rotation: totalRotation });
    const scale = maxWidth / originalViewport.width;
    const viewport = page.getViewport({ scale, rotation: totalRotation });

    thumbnailCanvas.width = viewport.width;
    thumbnailCanvas.height = viewport.height;

    const ctx = thumbnailCanvas.getContext('2d');

    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;
  }

  setScale(scale) {
    this.scale = Math.max(0.25, Math.min(4, scale));
    return this.renderPage();
  }

  zoomIn() {
    return this.setScale(this.scale + 0.25);
  }

  zoomOut() {
    return this.setScale(this.scale - 0.25);
  }

  async fitWidth(containerWidth) {
    if (!this.pdfDoc) return;

    const page = await this.pdfDoc.getPage(this.currentPage);
    const viewport = page.getViewport({ scale: 1 });

    // Account for padding/margins
    const padding = 40;
    const scale = (containerWidth - padding) / viewport.width;

    return this.setScale(scale);
  }

  goToPage(pageNum) {
    if (pageNum < 1 || pageNum > this.totalPages) return null;
    return this.renderPage(pageNum);
  }

  nextPage() {
    if (this.currentPage >= this.totalPages) return null;
    return this.renderPage(this.currentPage + 1);
  }

  prevPage() {
    if (this.currentPage <= 1) return null;
    return this.renderPage(this.currentPage - 1);
  }

  rotatePage(pageNum, degrees) {
    const currentRotation = this.pageRotations[pageNum] || 0;
    this.pageRotations[pageNum] = (currentRotation + degrees + 360) % 360;

    if (pageNum === this.currentPage) {
      return this.renderPage();
    }
    return null;
  }

  getPageRotation(pageNum) {
    return this.pageRotations[pageNum] || 0;
  }

  getCurrentPage() {
    return this.currentPage;
  }

  getTotalPages() {
    return this.totalPages;
  }

  getScale() {
    return this.scale;
  }

  isLoaded() {
    return this.pdfDoc !== null;
  }

  async getPageData(pageNum) {
    if (!this.pdfDoc) return null;

    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });

    return {
      width: viewport.width,
      height: viewport.height,
      rotation: page.rotate + (this.pageRotations[pageNum] || 0)
    };
  }

  destroy() {
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }
    this.currentPage = 1;
    this.totalPages = 0;
    this.pageRotations = {};
  }
}

// Create global instance
window.pdfRenderer = new PDFRenderer();
