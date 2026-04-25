import { toast } from 'sonner';
export {
  buildCollectionUrl,
  buildOrderUrl,
  buildProductUrl,
  buildProfileUrl,
  buildStorefrontUrl,
  getAppBaseUrl,
} from './publicUrlBuilder';

type ShareOrCopyOptions = {
  url: string;
  title: string;
  text?: string;
  successMessage: string;
  errorMessage: string;
};

export const shareOrCopyLink = async ({
  url,
  title,
  text,
  successMessage,
  errorMessage,
}: ShareOrCopyOptions): Promise<'shared' | 'copied' | 'failed'> => {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch {
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    toast.success(successMessage);
    return 'copied';
  } catch {
    toast.error(errorMessage);
    return 'failed';
  }
};
