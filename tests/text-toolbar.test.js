/**
 * TDD tests for floating text toolbar (font size, bold, font family).
 *
 * Root cause: setupTextToolbar() has a blanket e.preventDefault() on the
 * entire toolbar's mousedown, which prevents <input> from focusing and
 * <select> from opening its dropdown.
 *
 * Fix strategy:
 *   - Bold button: use mousedown + preventDefault (keeps IText focus) + direct logic
 *   - Font size input / Font family select: allow native focus, use
 *     _toolbarInteracting flag to prevent text:editing:exited cleanup
 *   - After toolbar value change: _refocusTextEditing() re-enters IText editing
 */

const CanvasLayer = require('../src/js/canvas-layer');

describe('Text Toolbar', () => {
  let canvasLayer;
  let mockActiveObject;
  let mockFabricCanvas;

  // DOM elements
  let toolbar;
  let sizeInput;
  let fontSelect;
  let boldBtn;
  let colorInput;
  let colorPreview;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
      <div id="fabric-container"></div>
      <div class="text-toolbar" id="text-toolbar" style="display: none;">
        <div class="text-toolbar-inner">
          <div class="text-toolbar-fontsize">
            <input type="number" id="text-toolbar-size" class="text-toolbar-input" value="16" min="8" max="200">
          </div>
          <div class="text-toolbar-separator"></div>
          <select id="text-toolbar-font" class="text-toolbar-select">
            <option value="Arial, sans-serif">Arial</option>
            <option value="DM Sans, sans-serif">DM Sans</option>
          </select>
          <div class="text-toolbar-separator"></div>
          <button class="text-toolbar-btn" id="text-toolbar-bold" title="Bold">B</button>
          <div class="text-toolbar-separator"></div>
          <div class="text-toolbar-color-wrapper">
            <input type="color" id="text-toolbar-color" value="#E07A2F" title="文字顏色">
            <span class="text-toolbar-color-preview" id="text-toolbar-color-preview" style="background-color: #E07A2F"></span>
          </div>
        </div>
      </div>
    `;

    toolbar = document.getElementById('text-toolbar');
    sizeInput = document.getElementById('text-toolbar-size');
    fontSelect = document.getElementById('text-toolbar-font');
    boldBtn = document.getElementById('text-toolbar-bold');
    colorInput = document.getElementById('text-toolbar-color');
    colorPreview = document.getElementById('text-toolbar-color-preview');

    // Mock active IText object
    mockActiveObject = {
      type: 'i-text',
      isEditing: true,
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      fill: '#E07A2F',
      text: 'Hello',
      set: jest.fn(function (key, value) {
        if (typeof key === 'string') this[key] = value;
      }),
      initDimensions: jest.fn(),
      setCoords: jest.fn(),
      enterEditing: jest.fn(),
      getBoundingRect: jest.fn(() => ({ left: 100, top: 100, width: 80, height: 20 })),
    };

    // Mock Fabric canvas
    mockFabricCanvas = {
      on: jest.fn(),
      getActiveObject: jest.fn(() => mockActiveObject),
      setActiveObject: jest.fn(),
      getObjects: jest.fn(() => [mockActiveObject]),
      renderAll: jest.fn(),
      width: 800,
      offsetWidth: 0,
    };

    // Create CanvasLayer instance (without full init)
    canvasLayer = new CanvasLayer();
    canvasLayer.fabricCanvas = mockFabricCanvas;
    canvasLayer.setupTextToolbar();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  // --- Bold button tests ---

  describe('Bold 按鈕', () => {
    test('mousedown 應切換 fontBold 並更新 activeObj', () => {
      expect(canvasLayer.fontBold).toBe(false);

      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      boldBtn.dispatchEvent(mousedownEvent);

      expect(canvasLayer.fontBold).toBe(true);
      expect(mockActiveObject.set).toHaveBeenCalledWith('fontWeight', 'bold');
      expect(mockActiveObject.initDimensions).toHaveBeenCalled();
      expect(mockFabricCanvas.renderAll).toHaveBeenCalled();
    });

    test('mousedown 應呼叫 preventDefault（防止搶走 IText focus）', () => {
      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      boldBtn.dispatchEvent(mousedownEvent);

      expect(mousedownEvent.defaultPrevented).toBe(true);
    });

    test('再次點擊應切回 normal', () => {
      // First click → bold
      boldBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(canvasLayer.fontBold).toBe(true);
      expect(mockActiveObject.set).toHaveBeenCalledWith('fontWeight', 'bold');

      // Second click → normal
      boldBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(canvasLayer.fontBold).toBe(false);
      expect(mockActiveObject.set).toHaveBeenCalledWith('fontWeight', 'normal');
    });

    test('應加上 active class 表示粗體狀態', () => {
      boldBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(boldBtn.classList.contains('active')).toBe(true);

      boldBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(boldBtn.classList.contains('active')).toBe(false);
    });
  });

  // --- Font size input tests ---

  describe('Font size input', () => {
    test('mousedown 應設定 _toolbarInteracting = true', () => {
      expect(canvasLayer._toolbarInteracting).toBe(false);

      sizeInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(canvasLayer._toolbarInteracting).toBe(true);
    });

    test('mousedown 不應呼叫 preventDefault（允許原生 focus）', () => {
      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      sizeInput.dispatchEvent(mousedownEvent);

      expect(mousedownEvent.defaultPrevented).toBe(false);
    });

    test('input 事件應更新 _editingTextObj 的 fontSize', () => {
      canvasLayer._editingTextObj = mockActiveObject;

      sizeInput.value = '24';
      sizeInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(canvasLayer.fontSize).toBe(24);
      expect(mockActiveObject.set).toHaveBeenCalledWith('fontSize', 24);
      expect(mockActiveObject.initDimensions).toHaveBeenCalled();
      expect(mockFabricCanvas.renderAll).toHaveBeenCalled();
    });

    test('change 事件應呼叫 _refocusTextEditing', () => {
      canvasLayer._editingTextObj = mockActiveObject;
      canvasLayer._toolbarInteracting = true;

      sizeInput.dispatchEvent(new Event('change', { bubbles: true }));

      expect(canvasLayer._toolbarInteracting).toBe(false);
      expect(mockActiveObject.enterEditing).toHaveBeenCalled();
    });

    test('Enter 鍵應呼叫 _refocusTextEditing', () => {
      canvasLayer._editingTextObj = mockActiveObject;
      canvasLayer._toolbarInteracting = true;

      const keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      sizeInput.dispatchEvent(keyEvent);

      expect(canvasLayer._toolbarInteracting).toBe(false);
      expect(mockActiveObject.enterEditing).toHaveBeenCalled();
    });
  });

  // --- Font family select tests ---

  describe('Font family select', () => {
    test('mousedown 應設定 _toolbarInteracting = true', () => {
      expect(canvasLayer._toolbarInteracting).toBe(false);

      fontSelect.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(canvasLayer._toolbarInteracting).toBe(true);
    });

    test('change 事件應更新 _editingTextObj 的 fontFamily', () => {
      canvasLayer._editingTextObj = mockActiveObject;

      fontSelect.value = 'Arial, sans-serif';
      fontSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(canvasLayer.fontFamily).toBe('Arial, sans-serif');
      expect(mockActiveObject.set).toHaveBeenCalledWith('fontFamily', 'Arial, sans-serif');
      expect(mockActiveObject.initDimensions).toHaveBeenCalled();
      expect(mockFabricCanvas.renderAll).toHaveBeenCalled();
    });

    test('change 事件後應呼叫 _refocusTextEditing', () => {
      canvasLayer._editingTextObj = mockActiveObject;
      canvasLayer._toolbarInteracting = true;

      fontSelect.value = 'DM Sans, sans-serif';
      fontSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(canvasLayer._toolbarInteracting).toBe(false);
      expect(mockActiveObject.enterEditing).toHaveBeenCalled();
    });
  });

  // --- Color picker tests ---

  describe('Color picker', () => {
    test('mousedown 應設定 _toolbarInteracting = true', () => {
      expect(canvasLayer._toolbarInteracting).toBe(false);

      colorInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(canvasLayer._toolbarInteracting).toBe(true);
    });

    test('input 事件應更新 _editingTextObj 的 fill 顏色', () => {
      canvasLayer._editingTextObj = mockActiveObject;

      colorInput.value = '#ff0000';
      colorInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(canvasLayer.currentColor).toBe('#ff0000');
      expect(mockActiveObject.set).toHaveBeenCalledWith('fill', '#ff0000');
      expect(mockFabricCanvas.renderAll).toHaveBeenCalled();
    });

    test('input 事件應更新預覽色塊的背景色', () => {
      canvasLayer._editingTextObj = mockActiveObject;

      colorInput.value = '#00ff00';
      colorInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(colorPreview.style.backgroundColor).toBe('rgb(0, 255, 0)');
    });

    test('change 事件後應呼叫 _refocusTextEditing', () => {
      canvasLayer._editingTextObj = mockActiveObject;
      canvasLayer._toolbarInteracting = true;

      colorInput.dispatchEvent(new Event('change', { bubbles: true }));

      expect(canvasLayer._toolbarInteracting).toBe(false);
      expect(mockActiveObject.enterEditing).toHaveBeenCalled();
    });
  });

  // --- _toolbarInteracting flag tests ---

  describe('_toolbarInteracting 旗標', () => {
    test('toolbar 非互動區域（分隔線等）mousedown 應呼叫 preventDefault', () => {
      const separator = document.querySelector('.text-toolbar-separator');
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      separator.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    test('toolbar 背景 mousedown 應呼叫 preventDefault', () => {
      const inner = document.querySelector('.text-toolbar-inner');
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      inner.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  // --- _refocusTextEditing tests ---

  describe('_refocusTextEditing', () => {
    test('應清除 _toolbarInteracting 並重新進入 editing', () => {
      canvasLayer._toolbarInteracting = true;
      canvasLayer._editingTextObj = mockActiveObject;

      canvasLayer._refocusTextEditing();

      expect(canvasLayer._toolbarInteracting).toBe(false);
      expect(mockFabricCanvas.setActiveObject).toHaveBeenCalledWith(mockActiveObject);
      expect(mockActiveObject.enterEditing).toHaveBeenCalled();
      expect(mockFabricCanvas.renderAll).toHaveBeenCalled();
    });

    test('若 textObj 已被移除，不應 crash', () => {
      canvasLayer._toolbarInteracting = true;
      canvasLayer._editingTextObj = mockActiveObject;
      mockFabricCanvas.getObjects.mockReturnValue([]); // 物件已不在 canvas 上

      expect(() => canvasLayer._refocusTextEditing()).not.toThrow();
      expect(canvasLayer._toolbarInteracting).toBe(false);
      expect(mockActiveObject.enterEditing).not.toHaveBeenCalled();
    });
  });
});
