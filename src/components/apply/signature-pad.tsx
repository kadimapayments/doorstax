"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface SignaturePadProps {
  onSignatureChange: (data: {
    image: string | null;
    typedName: string;
  }) => void;
  disabled?: boolean;
}

export function SignaturePad({ onSignatureChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    if (disabled || !agreed) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  }

  function stopDrawing() {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (hasDrawn) {
      const image = canvasRef.current?.toDataURL("image/png") || null;
      onSignatureChange({ image, typedName });
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange({ image: null, typedName });
  }

  const emitName = useCallback(
    (name: string) => {
      const image = hasDrawn
        ? canvasRef.current?.toDataURL("image/png") || null
        : null;
      onSignatureChange({ image, typedName: name });
    },
    [hasDrawn, onSignatureChange]
  );

  return (
    <div className="space-y-4">
      {/* Legal attestation */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          I certify that all information provided in this application is true,
          complete, and accurate to the best of my knowledge. I understand that
          providing false information may result in denial of this application or
          termination of any resulting lease agreement. I authorize the
          landlord/property manager to verify the information provided, including
          contacting employers, landlords, and references, and conducting credit,
          criminal background, and eviction history checks.
        </p>
      </div>

      {/* Agreement */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-input accent-primary"
          disabled={disabled}
        />
        <span className="text-sm font-medium">
          I have read and agree to the terms above
        </span>
      </label>

      {/* Typed name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Type your full legal name{" "}
          <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={typedName}
          onChange={(e) => {
            setTypedName(e.target.value);
            emitName(e.target.value);
          }}
          placeholder="e.g. John Michael Smith"
          disabled={disabled || !agreed}
          className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
      </div>

      {/* Signature canvas */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            Draw your signature <span className="text-red-500">*</span>
          </label>
          {hasDrawn && (
            <button
              type="button"
              onClick={clearSignature}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <div
          className={
            "rounded-lg border-2 border-dashed bg-white dark:bg-white " +
            (!agreed
              ? "opacity-50 cursor-not-allowed"
              : "cursor-crosshair")
          }
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full touch-none"
            style={{ height: "150px" }}
          />
        </div>
        {!agreed && (
          <p className="text-xs text-muted-foreground">
            Accept the terms above to enable signature
          </p>
        )}
      </div>
    </div>
  );
}
