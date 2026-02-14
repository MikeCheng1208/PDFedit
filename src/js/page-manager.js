/**
 * Page Manager Module
 * Handles page thumbnails, navigation, and page operations
 */

class PageManager {
  constructor() {
    this.thumbnailContainer = null;
    this.currentPage = 1;
    this.totalPages = 0;
  }

  init() {
    this.thumbnailContainer = document.getElementById('thumbnail-container');
    this.setupEvents();
  }

  setupEvents() {
    // Listen for page render events
    window.addEventListener('pageRendered', (e) => {
      this.updateCurrentPage(e.detail.pageNum);
    });

    // Drag state
    this._drag = null;
  }

  async renderThumbnails() {
    if (!this.thumbnailContainer || !window.pdfRenderer.isLoaded()) return;

    this.totalPages = window.pdfRenderer.getTotalPages();
    this.thumbnailContainer.innerHTML = '';

    for (let i = 1; i <= this.totalPages; i++) {
      const thumbnailDiv = document.createElement('div');
      thumbnailDiv.className = 'thumbnail';
      thumbnailDiv.dataset.page = i;
      if (i === this.currentPage) {
        thumbnailDiv.classList.add('active');
      }

      const canvas = document.createElement('canvas');
      const pageNum = document.createElement('span');
      pageNum.className = 'thumbnail-number';
      pageNum.textContent = i;

      thumbnailDiv.appendChild(canvas);
      thumbnailDiv.appendChild(pageNum);
      this.thumbnailContainer.appendChild(thumbnailDiv);

      // Render thumbnail
      try {
        await window.pdfRenderer.renderThumbnail(i, canvas, 120);
      } catch (error) {
        console.error(`Failed to render thumbnail for page ${i}:`, error);
      }

      // Click handler (set in setupDragAndDrop via pointerup)
      thumbnailDiv.addEventListener('click', () => {
        this.goToPage(i);
      });
    }

    this.setupDragAndDrop();
  }

  async refreshThumbnail(pageNum) {
    const thumbnail = this.thumbnailContainer.querySelector(`[data-page="${pageNum}"]`);
    if (!thumbnail) return;

    const canvas = thumbnail.querySelector('canvas');
    if (canvas) {
      await window.pdfRenderer.renderThumbnail(pageNum, canvas, 120);
    }
  }

  updateCurrentPage(pageNum) {
    this.currentPage = pageNum;

    // Update thumbnail selection
    this.thumbnailContainer.querySelectorAll('.thumbnail').forEach(thumb => {
      thumb.classList.toggle('active', parseInt(thumb.dataset.page) === pageNum);
    });

    // Update page info
    document.getElementById('current-page').textContent = pageNum;
    document.getElementById('total-pages').textContent = this.totalPages;

    // Update navigation buttons
    document.getElementById('btn-prev-page').disabled = pageNum <= 1;
    document.getElementById('btn-next-page').disabled = pageNum >= this.totalPages;

    // Scroll thumbnail into view
    const activeThumbnail = this.thumbnailContainer.querySelector('.thumbnail.active');
    if (activeThumbnail) {
      activeThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  goToPage(pageNum) {
    if (pageNum < 1 || pageNum > this.totalPages) return;

    // Save current page annotations
    window.canvasLayer.savePageAnnotations(this.currentPage);

    // Go to new page
    window.pdfRenderer.goToPage(pageNum);

    // Load annotations for new page
    window.canvasLayer.loadPageAnnotations(pageNum);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  async rotatePage(degrees) {
    await window.pdfRenderer.rotatePage(this.currentPage, degrees);
    await this.refreshThumbnail(this.currentPage);
    window.app?.showToast(window.i18n.t('pageRotated'), 'success');
  }

  setupDragAndDrop() {
    if (this.totalPages <= 1) return;

    const thumbnails = this.thumbnailContainer.querySelectorAll('.thumbnail');
    const DRAG_THRESHOLD = 5;

    thumbnails.forEach(thumb => {
      thumb.addEventListener('pointerdown', (e) => {
        // Only left button
        if (e.button !== 0) return;
        e.preventDefault();

        const pageNum = parseInt(thumb.dataset.page);
        this._drag = {
          sourceEl: thumb,
          sourcePageNum: pageNum,
          startX: e.clientX,
          startY: e.clientY,
          started: false,
          ghost: null,
          indicator: null,
          targetPageNum: pageNum,
          autoScrollRAF: null
        };

        thumb.setPointerCapture(e.pointerId);

        const onMove = (ev) => {
          if (!this._drag) return;
          const dx = ev.clientX - this._drag.startX;
          const dy = ev.clientY - this._drag.startY;

          if (!this._drag.started) {
            if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
            this._drag.started = true;
            this._startDrag(ev);
          }

          this._onDragMove(ev);
        };

        const onUp = (ev) => {
          thumb.removeEventListener('pointermove', onMove);
          thumb.removeEventListener('pointerup', onUp);
          thumb.removeEventListener('pointercancel', onUp);

          if (this._drag && this._drag.started) {
            this._endDrag();
            // Prevent the click from firing after drag
            const preventClick = (ce) => {
              ce.stopImmediatePropagation();
              ce.preventDefault();
            };
            thumb.addEventListener('click', preventClick, { once: true, capture: true });
          }

          this._drag = null;
        };

        thumb.addEventListener('pointermove', onMove);
        thumb.addEventListener('pointerup', onUp);
        thumb.addEventListener('pointercancel', onUp);
      });
    });
  }

  _startDrag(e) {
    const d = this._drag;

    // Add dragging class to source
    d.sourceEl.classList.add('dragging');

    // Create ghost
    const ghost = d.sourceEl.cloneNode(true);
    ghost.className = 'thumbnail-ghost';
    const rect = d.sourceEl.getBoundingClientRect();
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    document.body.appendChild(ghost);
    d.ghost = ghost;

    // Offset from cursor to element center
    d.offsetX = e.clientX - rect.left - rect.width / 2;
    d.offsetY = e.clientY - rect.top - rect.height / 2;

    // Create drop indicator
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    d.indicator = indicator;
  }

  _onDragMove(e) {
    const d = this._drag;
    if (!d || !d.ghost) return;

    // Move ghost
    const rect = d.sourceEl.getBoundingClientRect();
    d.ghost.style.left = (e.clientX - d.offsetX - rect.width / 2) + 'px';
    d.ghost.style.top = (e.clientY - d.offsetY - rect.height / 2) + 'px';

    // Auto-scroll
    const containerRect = this.thumbnailContainer.getBoundingClientRect();
    const SCROLL_ZONE = 40;
    const SCROLL_SPEED = 8;

    if (e.clientY < containerRect.top + SCROLL_ZONE) {
      this.thumbnailContainer.scrollTop -= SCROLL_SPEED;
    } else if (e.clientY > containerRect.bottom - SCROLL_ZONE) {
      this.thumbnailContainer.scrollTop += SCROLL_SPEED;
    }

    // Find drop target
    const thumbnails = Array.from(this.thumbnailContainer.querySelectorAll('.thumbnail'));
    let targetPageNum = d.sourcePageNum;

    for (let i = 0; i < thumbnails.length; i++) {
      const thumb = thumbnails[i];
      const thumbRect = thumb.getBoundingClientRect();
      const midY = thumbRect.top + thumbRect.height / 2;

      if (e.clientY < midY) {
        targetPageNum = parseInt(thumb.dataset.page);
        // Insert indicator before this thumbnail
        if (d.indicator.parentNode !== this.thumbnailContainer) {
          this.thumbnailContainer.insertBefore(d.indicator, thumb);
        } else if (d.indicator.nextSibling !== thumb) {
          this.thumbnailContainer.insertBefore(d.indicator, thumb);
        }
        d.targetPageNum = targetPageNum;
        d.indicator.style.opacity = '1';
        return;
      }
    }

    // Cursor is below all thumbnails — drop at end
    const lastThumb = thumbnails[thumbnails.length - 1];
    targetPageNum = parseInt(lastThumb.dataset.page) + 1;
    if (d.indicator.parentNode !== this.thumbnailContainer || d.indicator.nextSibling !== null) {
      this.thumbnailContainer.appendChild(d.indicator);
    }
    d.targetPageNum = targetPageNum;
    d.indicator.style.opacity = '1';
  }

  _endDrag() {
    const d = this._drag;
    if (!d) return;

    // Cleanup ghost and indicator
    if (d.ghost) d.ghost.remove();
    if (d.indicator) d.indicator.remove();
    d.sourceEl.classList.remove('dragging');

    // Calculate actual target
    let targetPageNum = d.targetPageNum;
    const fromPageNum = d.sourcePageNum;

    // If dropping after the source position, adjust because removing source shifts things
    if (targetPageNum > fromPageNum) {
      targetPageNum--;
    }

    if (targetPageNum !== fromPageNum && targetPageNum >= 1 && targetPageNum <= this.totalPages) {
      window.app?.movePage(fromPageNum, targetPageNum);
    }
  }

  getCurrentPage() {
    return this.currentPage;
  }

  getTotalPages() {
    return this.totalPages;
  }
}

// Create global instance
window.pageManager = new PageManager();
