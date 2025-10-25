import React, { useMemo, useState } from 'react';
import FileUploader from '../../components/upload/FileUploader';
import MediaPreview from '../../components/upload/MediaPreview';
import { MediaProvider, useMediaStore } from '../../hooks/useMediaStore';
import FrostedButton from '../../components/ui/FrostedButton';
import TextField from '../../components/forms/TextField';
import TextAreaField from '../../components/forms/TextAreaField';
import SelectField from '../../components/forms/SelectField';
import { useBrandProfile } from '../../hooks/UseBrandHook';
import useFilePicker from '../../components/upload/useFilePicker';
import { toast } from 'react-toastify';
import useCollectionUpload from '../../hooks/useCollectionUpload';
import WizardLayout from '../../components/layouts/WizardLayout';
import { useNavigate } from 'react-router-dom';

const CreateCollectionInner: React.FC = () => {
  const mediaStore = useMediaStore();
  const files = mediaStore.items;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [isAvailableInStore, setIsAvailableInStore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tags, setTags] = useState<string>('');

  const { uploadCollection, isUploading, progress, perFileProgress } = useCollectionUpload();
  const { user, fetchCollections } = useBrandProfile();
  const navigate = useNavigate();

  const disabled = isSubmitting || isUploading;
  const picker = useFilePicker({ accept: ['image/*', 'video/*'], maxFiles: 20, onFiles: mediaStore.addFiles, disabled });

  const parsedTags = useMemo(
    () =>
      tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 10),
    [tags],
  );

  const isValid = title.trim().length > 0 && files.length > 0 && parsedTags.length > 0;

  const handleDelete = (id: string) => {
    mediaStore.remove(id);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) {
      toast.error('Provide a title and at least one file.');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedMinPrice = minPrice ? parseFloat(minPrice) : undefined;
      const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : undefined;
      
      if (parsedTags.length === 0) {
        toast.error('Add at least one tag (comma separated).');
        return;
      }

      await uploadCollection(files, title, description, parsedMinPrice, parsedMaxPrice, isAvailableInStore, parsedTags);
      if (user?.id) {
        await fetchCollections(user.id);
      }
      toast.success('Collection created');
      setTitle('');
      setDescription('');
      setMinPrice('');
      setMaxPrice('');
      setIsAvailableInStore(false);
  setTags('');
      mediaStore.clear();
      navigate('/profile');
    } catch (error) {
      console.error(error);
      toast.error('Failed to create collection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const leftContent = (
  <div className="space-y-4 glass-panel p-4">
      {isUploading && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">
          Uploading files... {progress}%
          <div className="mt-2 h-2 w-full rounded-full bg-blue-100 dark:bg-blue-900/40">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all dark:bg-blue-400"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {files.length === 0 ? (
        <FileUploader
          onFilesUpload={mediaStore.addFiles}
          picker={picker}
          variant="large"
          accept={['image/*', 'video/*']}
          disabled={disabled}
        />
      ) : (
        <>
          {/* Hidden file input - must be present when MediaPreview is shown so picker.open() works */}
          <input
            ref={picker.inputRef}
            type="file"
            multiple
            onChange={picker.handlers.onInputChange}
            className="hidden"
            accept={['image/*', 'video/*'].join(',')}
            disabled={disabled}
          />
          <MediaPreview 
            items={files} 
            onDeleteItem={handleDelete} 
            onAddMore={() => picker.open()} 
            disabled={disabled} 
            progressById={perFileProgress} 
          />
        </>
      )}
    </div>
  );

  const rightContent = (
  <div className="space-y-4 glass-panel p-4">
      <TextField 
        label="Collection Title" 
        value={title} 
        onChange={(e) => setTitle(e.target.value)} 
        placeholder="e.g., Summer Breeze '24" 
        disabled={disabled} 
        variant="glass"
        inputClassName="border-0 focus:ring-0"
      />
      <TextAreaField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the inspiration, materials, and feel of your collection."
        rows={4}
        disabled={disabled}
        variant="glass"
      />
      
      {/* Price Range */}
      <div className="grid grid-cols-2 gap-3">
        <TextField 
          label="Min Price (₦)" 
          type="number"
          value={minPrice} 
          onChange={(e) => setMinPrice(e.target.value)} 
          placeholder="15,000" 
          disabled={disabled} 
          variant="glass"
          inputClassName="border-0 focus:ring-0"
        />
        <TextField 
          label="Max Price (₦)" 
          type="number"
          value={maxPrice} 
          onChange={(e) => setMaxPrice(e.target.value)} 
          placeholder="45,000" 
          disabled={disabled} 
          variant="glass"
          inputClassName="border-0 focus:ring-0"
        />
      </div>

      {/* Available in Store Toggle */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <input
          type="checkbox"
          id="availableInStore"
          checked={isAvailableInStore}
          onChange={(e) => setIsAvailableInStore(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700"
        />
        <label htmlFor="availableInStore" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
          Available in physical store
        </label>
      </div>

      {/* Tags */}
      <TextField 
        label="Tags (comma separated)" 
        value={tags} 
        onChange={(e) => setTags(e.target.value)} 
        placeholder="e.g., summer, linen, resort" 
        disabled={disabled} 
        helperText="Add at least one descriptive tag to help shoppers discover this collection."
        variant="glass"
        inputClassName="border-0 focus:ring-0"
      />

      <SelectField label="Visibility" disabled={disabled} variant="glass">
        <option value="public">Public</option>
        <option value="private">Private</option>
      </SelectField>
      <TextField label="Collaborators" placeholder="Search by username or email" disabled={disabled} variant="glass" inputClassName="border-0 focus:ring-0" />
      <FrostedButton 
        type="submit" 
        variant="primary" 
        size="lg" 
        className="w-full" 
        disabled={!isValid || disabled} 
        loading={isSubmitting || isUploading}
      >
        {isUploading ? `Uploading... ${progress}%` : 'Create Collection'}
      </FrostedButton>
    </div>
  );

  return (
    <div className="min-h-screen  p-6 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <form onSubmit={handleSubmit}>
        <WizardLayout
          title="Create a Collection"
          description="Upload imagery, craft your story, and publish the collection in one seamless flow."
          left={leftContent}
          right={rightContent}
        />
      </form>
    </div>
  );
};

const CreateCollectionPage: React.FC = () => (
  <MediaProvider>
    <CreateCollectionInner />
  </MediaProvider>
);

export default CreateCollectionPage;


