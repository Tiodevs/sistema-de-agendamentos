'use client';

import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { Check, Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cropImageToAvatar } from '@/lib/crop-image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function AvatarCropDialog({
  imageSrc,
  open,
  confirming,
  onCancel,
  onConfirm,
}: {
  imageSrc: string | null;
  open: boolean;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropping(false);
  }, [open, imageSrc]);

  const handleCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels || confirming || cropping) return;

    setCropping(true);
    try {
      const blob = await cropImageToAvatar(imageSrc, croppedAreaPixels);
      onConfirm(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível recortar a imagem';
      toast.error(message);
    } finally {
      setCropping(false);
    }
  }

  const busy = confirming || cropping;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="rounded-3xl sm:max-w-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Recortar foto</DialogTitle>
          <DialogDescription>
            Arraste e use o zoom para encaixar o rosto no círculo do perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[min(22rem,55vh)] overflow-hidden rounded-[1.35rem] bg-black">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              roundCropAreaPixels
            />
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-card-muted)] text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Number((value - 0.1).toFixed(2))))}
            disabled={busy || zoom <= MIN_ZOOM}
            aria-label="Diminuir zoom"
          >
            <Minus className="size-4" />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            disabled={busy}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--admin-card-muted)] accent-[var(--admin-accent)]"
            aria-label="Zoom da foto"
          />
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-card-muted)] text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Number((value + 0.1).toFixed(2))))}
            disabled={busy || zoom >= MAX_ZOOM}
            aria-label="Aumentar zoom"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-full"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={busy || !croppedAreaPixels}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            Usar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
