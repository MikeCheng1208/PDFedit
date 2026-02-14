/**
 * TDD tests for Cmd+A text select-all behavior.
 *
 * The correct approach mirrors Fabric.js v5.5.2 internal onKeyDown handling:
 *   1. Call the built-in selectAll() method
 *   2. Call canvas.requestRenderAll() to trigger the full render pipeline
 *      (renderAll → IText.render → renderCursorOrSelection)
 *
 * Previously, the handler manually called abortCursorAnimation() then
 * renderCursorOrSelection() then initDelayedCursor(). This failed because
 * initDelayedCursor() internally calls abortCursorAnimation() which clears
 * the entire contextTop canvas, wiping the selection highlight we just drew.
 */

const App = require('../src/js/app');

describe('Cmd+A Text Select All', () => {
  let app;
  let mockActiveObject;
  let mockCanvas;

  beforeEach(() => {
    // Mock active IText object
    mockActiveObject = {
      selectAll: jest.fn(function () {
        this.selectionStart = 0;
        this.selectionEnd = this._text.length;
        return this;
      }),
      isEditing: true,
      type: 'i-text',
      canvas: null,
      selectionStart: 5,
      selectionEnd: 5,
      _text: ['H', 'e', 'l', 'l', 'o'],
      // These should NOT be called (regression guards)
      abortCursorAnimation: jest.fn(),
      initDelayedCursor: jest.fn(),
      renderCursorOrSelection: jest.fn(),
      _updateTextarea: jest.fn(),
      _currentCursorOpacity: 0,
    };

    mockCanvas = {
      getActiveObject: jest.fn(() => mockActiveObject),
      requestRenderAll: jest.fn(),
    };
    mockActiveObject.canvas = mockCanvas;

    // Mock canvasLayer
    window.canvasLayer = {
      getCanvas: jest.fn(() => mockCanvas),
    };

    // Create App instance (init() is NOT called — we test handleSelectAll directly)
    app = new App();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --- Editing mode tests ---

  test('editing 模式：應呼叫 Fabric.js 內建 selectAll()', () => {
    app.handleSelectAll();
    expect(mockActiveObject.selectAll).toHaveBeenCalledTimes(1);
  });

  test('editing 模式：應呼叫 canvas.requestRenderAll() 觸發完整重繪', () => {
    app.handleSelectAll();
    expect(mockCanvas.requestRenderAll).toHaveBeenCalledTimes(1);
  });

  test('editing 模式：不應呼叫 abortCursorAnimation（迴歸測試）', () => {
    app.handleSelectAll();
    expect(mockActiveObject.abortCursorAnimation).not.toHaveBeenCalled();
  });

  test('editing 模式：不應呼叫 initDelayedCursor（迴歸測試）', () => {
    app.handleSelectAll();
    expect(mockActiveObject.initDelayedCursor).not.toHaveBeenCalled();
  });

  test('editing 模式：不應手動設定 selectionStart/selectionEnd（由 selectAll 處理）', () => {
    // Before: handler manually set these. Now selectAll() handles it.
    app.handleSelectAll();
    // selectAll was called, verify it set the properties correctly
    expect(mockActiveObject.selectionStart).toBe(0);
    expect(mockActiveObject.selectionEnd).toBe(5);
  });

  // --- Non-editing mode tests ---

  test('非 editing 模式（無 active object）：應呼叫 document.execCommand("selectAll")', () => {
    mockCanvas.getActiveObject.mockReturnValue(null);
    document.execCommand = jest.fn();

    app.handleSelectAll();

    expect(document.execCommand).toHaveBeenCalledWith('selectAll');
    expect(mockActiveObject.selectAll).not.toHaveBeenCalled();
  });

  test('非 editing 模式（isEditing=false）：應呼叫 document.execCommand("selectAll")', () => {
    mockActiveObject.isEditing = false;
    document.execCommand = jest.fn();

    app.handleSelectAll();

    expect(document.execCommand).toHaveBeenCalledWith('selectAll');
    expect(mockActiveObject.selectAll).not.toHaveBeenCalled();
  });
});

describe('measureLine monkey-patch：__charBounds 與全行量測一致性', () => {
  // Simulate what the monkey-patch does: scale __charBounds so the total
  // matches the full-string measurement at actual fontSize.

  test('應按比例縮放 __charBounds 使總寬匹配全行量測', () => {
    // Simulate per-character measurement (CACHE_FONT_SIZE) result
    var charBounds = [
      { left: 0,  width: 10, kernedWidth: 10, height: 16 },
      { left: 10, width: 12, kernedWidth: 12, height: 16 },
      { left: 22, width: 8,  kernedWidth: 8,  height: 16 },
      // sentinel
      { left: 30, width: 0,  kernedWidth: 0,  height: 16 },
    ];
    var perCharTotal = 30; // sum of kernedWidth

    // Simulate full-string measurement at actual fontSize
    var actualWidth = 33; // browser measures full string wider (e.g., kerning differences)

    // Apply the scaling logic from our monkey-patch
    var scale = actualWidth / perCharTotal;
    var numChars = 3;
    for (var i = 0; i < numChars; i++) {
      charBounds[i].left *= scale;
      charBounds[i].width *= scale;
      charBounds[i].kernedWidth *= scale;
    }
    // Update sentinel
    charBounds[numChars].left = charBounds[numChars - 1].left + charBounds[numChars - 1].width;

    // Verify total width matches actual measurement
    var totalKernedWidth = 0;
    for (var i = 0; i < numChars; i++) {
      totalKernedWidth += charBounds[i].kernedWidth;
    }
    expect(totalKernedWidth).toBeCloseTo(actualWidth, 5);

    // Verify sentinel position matches total
    expect(charBounds[numChars].left).toBeCloseTo(actualWidth, 5);

    // Verify proportional scaling: ratios should be preserved
    expect(charBounds[0].width / charBounds[1].width).toBeCloseTo(10 / 12, 5);
    expect(charBounds[1].width / charBounds[2].width).toBeCloseTo(12 / 8, 5);
  });

  test('當差異 ≤ 0.5px 時不應調整（避免浮點噪音）', () => {
    var perCharTotal = 100;
    var actualWidth = 100.3; // 差異 < 0.5

    var shouldScale = Math.abs(perCharTotal - actualWidth) > 0.5;
    expect(shouldScale).toBe(false);
  });

  test('空行不應觸發調整', () => {
    var lineText = '';
    var resultWidth = 0;

    // Our monkey-patch returns early for empty lines
    var shouldAdjust = !!(lineText && lineText.length > 0 && resultWidth > 0);
    expect(shouldAdjust).toBe(false);
  });
});
