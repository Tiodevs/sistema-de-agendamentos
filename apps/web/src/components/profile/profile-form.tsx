'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Crop, Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { ApiError, deleteMyAvatar, updateMyProfile, uploadMyAvatar } from '@/lib/api';
import { fileToObjectUrl, remoteImageToObjectUrl } from '@/lib/crop-image';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AvatarCropDialog } from '@/components/profile/avatar-crop-dialog';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StaggerIn } from '@/components/motion/stagger-in';

const PHONE_PATTERN = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;

export function ProfileForm() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [preparingCrop, setPreparingCrop] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone ?? '');
  }, [user]);

  if (!user) return null;

  function validate() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Nome é obrigatório';
    else if (name.trim().length < 2) next.name = 'Nome deve ter no mínimo 2 caracteres';

    if (!email.trim()) next.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'E-mail inválido';

    if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) next.phone = 'Telefone inválido';

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function applyApiErrors(error: unknown) {
    if (error instanceof ApiError && error.errors?.length) {
      const next: Record<string, string> = {};
      error.errors.forEach((fieldError) => {
        next[fieldError.field] = fieldError.message;
      });
      setErrors(next);
    }
    const message = error instanceof Error ? error.message : 'Não foi possível salvar o perfil';
    toast.error(message);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const response = await updateMyProfile({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
      });
      if (response.data?.user) updateUser(response.data.user);
      toast.success('Perfil atualizado');
    } catch (error) {
      applyApiErrors(error);
    } finally {
      setSaving(false);
    }
  }

  function closeCropDialog() {
    if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  function openCropFromFile(file: File) {
    closeCropDialog();
    setCropSrc(fileToObjectUrl(file));
  }

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Use uma imagem JPG, PNG, WEBP ou GIF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A foto deve ter no máximo 5 MB');
      return;
    }

    openCropFromFile(file);
  }

  async function handleRecropCurrent() {
    const avatarUrl = user?.avatarUrl;
    if (!avatarUrl) return;
    setPreparingCrop(true);
    try {
      closeCropDialog();
      setCropSrc(await remoteImageToObjectUrl(avatarUrl));
    } catch (error) {
      applyApiErrors(error);
    } finally {
      setPreparingCrop(false);
    }
  }

  async function handleCroppedUpload(file: File) {
    setUploading(true);
    try {
      const response = await uploadMyAvatar(file);
      if (response.data?.user) updateUser(response.data.user);
      closeCropDialog();
      toast.success('Foto de perfil atualizada');
    } catch (error) {
      applyApiErrors(error);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    setRemoving(true);
    try {
      const response = await deleteMyAvatar();
      if (response.data?.user) updateUser(response.data.user);
      toast.success('Foto de perfil removida');
    } catch (error) {
      applyApiErrors(error);
    } finally {
      setRemoving(false);
    }
  }

  const busy = saving || uploading || removing || preparingCrop;

  return (
    <StaggerIn className="mx-auto max-w-2xl space-y-5">
      <div data-motion="enter">
        <AdminPageHeader
          title="Perfil"
          description="Atualize suas informações e a foto que aparece no sistema."
        />
      </div>

      <section data-motion="enter" className="admin-surface p-5 sm:p-6">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="relative">
            <UserAvatar
              name={name || user.name}
              src={user.avatarUrl}
              className="size-24"
              fallbackClassName="bg-[var(--admin-chip)] text-xl"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
              aria-label="Alterar foto de perfil"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{user.name}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              JPG, PNG, WEBP ou GIF de até 5 MB. A foto é recortada em círculo, no padrão do
              sistema.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {user.avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => void handleRecropCurrent()}
                  disabled={busy}
                >
                  {preparingCrop ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Crop className="size-4" />
                  )}
                  Ajustar recorte
                </Button>
              ) : null}
              {user.avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-destructive hover:text-destructive"
                  onClick={handleRemoveAvatar}
                  disabled={busy}
                >
                  {removing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Remover foto
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <AvatarCropDialog
        imageSrc={cropSrc}
        open={Boolean(cropSrc)}
        confirming={uploading}
        onCancel={closeCropDialog}
        onConfirm={(file) => {
          void handleCroppedUpload(file);
        }}
      />

      <form
        data-motion="enter"
        onSubmit={handleSubmit}
        className="admin-surface space-y-4 p-5 sm:p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="profile-name">Nome completo</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
            autoComplete="name"
          />
          {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-email">E-mail</Label>
          <Input
            id="profile-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            autoComplete="email"
          />
          {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-phone">
            Telefone <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={busy}
            autoComplete="tel"
            placeholder="(11) 99999-9999"
          />
          {errors.phone ? <p className="text-sm text-destructive">{errors.phone}</p> : null}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" className="rounded-full" disabled={busy}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar alterações
          </Button>
        </div>
      </form>
    </StaggerIn>
  );
}
