import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import TextField from '../forms/TextField';
import FrostedButton, { IconButton } from '@/components/ui/FrostedButton';
import { BRAND_TAG_OPTIONS } from '../../data/brandTags';

const schema = z.object({
  brandFullName: z.string().trim().min(2, { message: 'Brand name must be at least 2 characters' }).max(120),
  brandCountry: z.string().trim().max(120).optional(),
  brandState: z.string().trim().max(120).optional(),
  brandCity: z.string().trim().max(120).optional(),
});

type FormValues = z.infer<typeof schema>;

interface ProfileHeaderQuickEditModalProps {
  open: boolean;
  initialValues: {
    brandFullName: string;
    brandCountry?: string | null;
    brandState?: string | null;
    brandCity?: string | null;
    brandTags: string[];
    username?: string;
  };
  onSubmit: (values: FormValues & { brandTags: string[] }) => Promise<void>;
  onClose: () => void;
  onOpenFullEditor?: () => void;
  saving?: boolean;
}

const MAX_TAGS = 6;

const ProfileHeaderQuickEditModal: React.FC<ProfileHeaderQuickEditModalProps> = ({
  open,
  initialValues,
  onSubmit,
  onClose,
  onOpenFullEditor,
  saving = false,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      brandFullName: initialValues.brandFullName,
      brandCountry: initialValues.brandCountry ?? '',
      brandState: initialValues.brandState ?? '',
      brandCity: initialValues.brandCity ?? '',
    },
  });

  const [selectedTags, setSelectedTags] = useState<string[]>(initialValues.brandTags ?? []);
  const [tagError, setTagError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      reset({
        brandFullName: initialValues.brandFullName,
        brandCountry: initialValues.brandCountry ?? '',
        brandState: initialValues.brandState ?? '',
        brandCity: initialValues.brandCity ?? '',
      });
      setSelectedTags(initialValues.brandTags ?? []);
      setTagError(null);
    }
  }, [open, initialValues, reset]);

  const toggleTag = (value: string) => {
    setSelectedTags((previous) => {
      if (previous.includes(value)) {
        const next = previous.filter((tag) => tag !== value);
        if (tagError && next.length > 0) setTagError(null);
        return next;
      }
      if (previous.length >= MAX_TAGS) {
        setTagError(`Choose up to ${MAX_TAGS} tags.`);
        return previous;
      }
      const next = [...previous, value];
      if (tagError && next.length > 0) setTagError(null);
      return next;
    });
  };

  const handleFormSubmit = handleSubmit(async (values) => {
    if (selectedTags.length === 0) {
      setTagError('Select at least one tag.');
      return;
    }
    await onSubmit({ ...values, brandTags: selectedTags });
  });

  const isOpen = open;
  const brandNameValue = watch('brandFullName');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl glass-panel p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Profile Details</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Update your brand name, location, and tags. Username is fixed.
            </p>
          </div>
          <IconButton
            aria-label="Close"
            icon={<span className="text-sm">✕</span>}
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={saving}
          />
        </div>

        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleFormSubmit(); }}>
          <TextField
            label="Brand name"
            placeholder="Your brand name"
            {...register('brandFullName')}
            error={errors.brandFullName?.message}
            variant="glass"
            inputClassName="border-0 focus:ring-0"
          />

          <TextField
            label="Username"
            value={initialValues.username ?? 'Not set'}
            disabled
            className="opacity-80"
            variant="glass"
            inputClassName="border-0 focus:ring-0"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField
              label="Country"
              placeholder="Country"
              {...register('brandCountry')}
              error={errors.brandCountry?.message ?? null}
              variant="glass"
              inputClassName="border-0 focus:ring-0"
            />
            <TextField
              label="State"
              placeholder="State"
              {...register('brandState')}
              error={errors.brandState?.message ?? null}
              variant="glass"
              inputClassName="border-0 focus:ring-0"
            />
            <TextField
              label="City"
              placeholder="City"
              {...register('brandCity')}
              error={errors.brandCity?.message ?? null}
              variant="glass"
              inputClassName="border-0 focus:ring-0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Tags <span className="text-xs text-gray-400">(up to {MAX_TAGS})</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {BRAND_TAG_OPTIONS.map((tag) => {
                const isActive = selectedTags.includes(tag.value);
                return (
                  <button
                    type="button"
                    key={tag.value}
                    onClick={() => toggleTag(tag.value)}
                    className={`glass-chip chip-sm transition ${
                      isActive
                        ? 'chip-purple ring-1 ring-purple-300/50'
                        : 'chip-gray hover:chip-purple'
                    }`}
                    disabled={saving}
                  >
                    #{tag.label}
                  </button>
                );
              })}
            </div>
            {tagError && <p className="mt-1 text-xs text-red-500">{tagError}</p>}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {brandNameValue?.length ?? 0} characters
            </div>
            <div className="flex items-center gap-2">
              {onOpenFullEditor && (
                <FrostedButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenFullEditor();
                  }}
                >
                  Open full editor
                </FrostedButton>
              )}
              <FrostedButton type="submit" variant="primary" size="sm" loading={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </FrostedButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileHeaderQuickEditModal;
