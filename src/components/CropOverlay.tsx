import React, { useState, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';

interface CropOverlayProps {
  imageUrl: string;
  onCancel: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}

export default function CropOverlay({ imageUrl, onCancel, onCropComplete }: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrag, setCurrentDrag] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  // Handle escape key to cancel cropping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const getMouseCoords = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    const coords = getMouseCoords(e);
    setDragStart(coords);
    setCurrentDrag(coords);
    setIsDragging(true);
    setHasSelection(false);
    setCropBox(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const coords = getMouseCoords(e);
    setCurrentDrag(coords);

    // Live update box
    const x = Math.min(dragStart.x, coords.x);
    const y = Math.min(dragStart.y, coords.y);
    const w = Math.abs(dragStart.x - coords.x);
    const h = Math.abs(dragStart.y - coords.y);
    setCropBox({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDragging || !cropBox) return;
    setIsDragging(false);

    // Only set selection if box has meaningful size (e.g. > 10px)
    if (cropBox.w > 10 && cropBox.h > 10) {
      setHasSelection(true);
    } else {
      setCropBox(null);
      setHasSelection(false);
    }
  };

  const handleConfirm = () => {
    if (!cropBox || !imgRef.current || !containerRef.current) return;

    const img = imgRef.current;
    const container = containerRef.current;

    // Calculate scaling factor between displayed image size and natural image size
    const containerRect = container.getBoundingClientRect();
    const scaleX = img.naturalWidth / containerRect.width;
    const scaleY = img.naturalHeight / containerRect.height;

    // Create dynamic canvas for cropping
    const canvas = document.createElement('canvas');
    canvas.width = cropBox.w * scaleX;
    canvas.height = cropBox.h * scaleY;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the cropped portion to the canvas
    ctx.drawImage(
      img,
      cropBox.x * scaleX,
      cropBox.y * scaleY,
      cropBox.w * scaleX,
      cropBox.h * scaleY,
      0,
      0,
      cropBox.w * scaleX,
      cropBox.h * scaleY
    );

    // Return data URL of the cropped area
    const croppedUrl = canvas.toDataURL('image/png');
    onCropComplete(croppedUrl);
  };

  // Mask dimensions
  const selectX = cropBox ? cropBox.x : 0;
  const selectY = cropBox ? cropBox.y : 0;
  const selectW = cropBox ? cropBox.w : 0;
  const selectH = cropBox ? cropBox.h : 0;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={styles.container}
    >
      {/* Background Screenshot */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Screenshot capture"
        style={styles.bgImage}
        draggable={false}
      />

      {/* Mask Overlays (Dim out rest of screen) */}
      {cropBox && (
        <>
          {/* Top Mask */}
          <div style={{ ...styles.mask, top: 0, left: 0, right: 0, height: selectY }} />
          {/* Bottom Mask */}
          <div style={{ ...styles.mask, top: selectY + selectH, left: 0, right: 0, bottom: 0 }} />
          {/* Left Mask */}
          <div style={{ ...styles.mask, top: selectY, left: 0, width: selectX, height: selectH }} />
          {/* Right Mask */}
          <div style={{ ...styles.mask, top: selectY, left: selectX + selectW, right: 0, height: selectH }} />
        </>
      )}

      {/* Dim overlay when there is no crop box yet */}
      {!cropBox && <div style={styles.fullDim} />}

      {/* Interactive Selection Box */}
      {cropBox && (
        <div
          style={{
            ...styles.selectionBox,
            top: selectY,
            left: selectX,
            width: selectW,
            height: selectH,
          }}
        >
          {/* Action buttons (Only show when mouse drag completes) */}
          {hasSelection && (
            <div
              style={styles.actionRow}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                style={styles.cancelBtn}
                title="Cancel crop"
              >
                <X size={13} style={{ marginRight: '4px' }} />
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirm();
                }}
                style={styles.confirmBtn}
                title="Crop & Paste to AI"
              >
                <Check size={13} style={{ marginRight: '4px' }} />
                Crop & Ask AI
              </button>
            </div>
          )}
        </div>
      )}

      {/* Instructions Overlay */}
      {!isDragging && !hasSelection && (
        <div style={styles.instructions}>
          Drag mouse to crop the region you want to ask about. Press <kbd style={styles.kbd}>Esc</kbd> to exit.
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    overflow: 'hidden',
    cursor: 'crosshair',
    userSelect: 'none' as const,
  },
  bgImage: {
    width: '100%',
    height: '100%',
    objectFit: 'fill' as const,
    pointerEvents: 'none' as const,
  },
  mask: {
    position: 'absolute' as const,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    pointerEvents: 'none' as const,
  },
  fullDim: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    pointerEvents: 'none' as const,
  },
  selectionBox: {
    position: 'absolute' as const,
    border: '2px dashed #8b5cf6',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.4), inset 0 0 8px rgba(139, 92, 246, 0.3)',
    pointerEvents: 'auto' as const,
  },
  actionRow: {
    position: 'absolute' as const,
    bottom: '-38px',
    right: '0px',
    display: 'flex',
    gap: '6px',
    backgroundColor: '#0a0b10',
    padding: '4px 6px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    pointerEvents: 'auto' as const,
    zIndex: 10000,
    whiteSpace: 'nowrap' as const,
  },
  cancelBtn: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#272935',
    color: '#e5e7eb',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  confirmBtn: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  instructions: {
    position: 'absolute' as const,
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(10, 11, 16, 0.85)',
    color: '#e5e7eb',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    pointerEvents: 'none' as const,
    zIndex: 10000,
  },
  kbd: {
    fontFamily: 'monospace',
    padding: '1px 3px',
    backgroundColor: '#1b1d28',
    border: '1px solid #4b5563',
    borderRadius: '3px',
    fontSize: '10px',
    color: '#ffffff',
  }
};
