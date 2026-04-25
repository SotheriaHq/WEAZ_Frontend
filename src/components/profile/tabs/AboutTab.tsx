import React from 'react';
import { Building2, MapPin, Tag, Mail, Phone, Instagram, Facebook, Twitter, Globe } from 'lucide-react';
import Card from '../../ui/Card';
import Badge from '../../ui/Badge';
import MediaRenderer from '@/components/media/MediaRenderer';

interface AboutTabProps {
  brandData: {
    brandName: string;
    description: string;
    businessType?: string;
    country?: string | null;
    state?: string | null;
    city?: string | null;
    tags: string[];
    socialLinks: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
      website?: string;
    };
    contactInfo: {
      email: string;
      phone: string;
    };
    bannerImage?: string | null;
    established?: string;
  };
}

const AboutTab: React.FC<AboutTabProps> = ({ brandData }) => {
  const location = [brandData.city, brandData.state, brandData.country]
    .filter(Boolean)
    .join(', ');

  const hasSocialLinks = Object.values(brandData.socialLinks).some(link => link);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Section */}
      {brandData.bannerImage && (
        <section className="relative rounded-2xl overflow-y-auto shadow-lg">
          <MediaRenderer
            kind="image"
            src={brandData.bannerImage}
            alt={brandData.brandName}
            maxHeightClassName="max-h-80"
            className="rounded-2xl"
            mediaClassName="rounded-2xl"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end p-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                {brandData.brandName}
              </h1>
              <p className="text-xl text-white/90">
                {brandData.businessType || 'Fashion Brand'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Brand Story */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-1 h-8 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></span>
          Our Story
        </h2>
        <div className="prose prose-lg max-w-none dark:prose-invert">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {brandData.description}
          </p>
        </div>
      </section>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Business Type Card */}
        <Card variant="elevated" padding="lg" className="hover:shadow-xl transition-shadow">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2">
              Business Type
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {brandData.businessType || 'Fashion Brand'}
            </p>
            {brandData.established && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Since {brandData.established}
              </p>
            )}
          </div>
        </Card>

        {/* Location Card */}
        <Card variant="elevated" padding="lg" className="hover:shadow-xl transition-shadow">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2">
              Location
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {location || 'Not specified'}
            </p>
          </div>
        </Card>

        {/* Specialties Card */}
        <Card variant="elevated" padding="lg" className="hover:shadow-xl transition-shadow">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-4">
              <Tag className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2">
              Specialties
            </h3>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {brandData.tags.length > 0 ? (
                brandData.tags.map((tag) => (
                  <Badge key={tag} variant="primary" size="sm">
                    {tag}
                  </Badge>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No tags yet</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Social Links Section */}
      {hasSocialLinks && (
        <section className="text-center py-12 bg-gradient-to-r from-purple-50 via-pink-50 to-indigo-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-indigo-900/20 rounded-2xl border border-purple-100 dark:border-purple-800/30">
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Connect With Us
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Follow us on social media for the latest updates
          </p>
          <div className="flex justify-center gap-4">
            {brandData.socialLinks.instagram && (
              <a
                href={brandData.socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-14 h-14 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 border border-gray-200 dark:border-gray-700"
                aria-label="Instagram"
              >
                <Instagram className="w-6 h-6 text-pink-600 dark:text-pink-400 group-hover:text-pink-700 dark:group-hover:text-pink-300" />
              </a>
            )}
            {brandData.socialLinks.facebook && (
              <a
                href={brandData.socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-14 h-14 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 border border-gray-200 dark:border-gray-700"
                aria-label="Facebook"
              >
                <Facebook className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300" />
              </a>
            )}
            {brandData.socialLinks.twitter && (
              <a
                href={brandData.socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-14 h-14 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 border border-gray-200 dark:border-gray-700"
                aria-label="Twitter"
              >
                <Twitter className="w-6 h-6 text-sky-500 dark:text-sky-400 group-hover:text-sky-600 dark:group-hover:text-sky-300" />
              </a>
            )}
            {brandData.socialLinks.website && (
              <a
                href={brandData.socialLinks.website}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-14 h-14 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 border border-gray-200 dark:border-gray-700"
                aria-label="Website"
              >
                <Globe className="w-6 h-6 text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* Contact Information */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Email Card */}
        <Card variant="bordered" padding="lg" className="hover:shadow-lg transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Email Address
              </p>
              <a
                href={`mailto:${brandData.contactInfo.email}`}
                className="text-lg font-medium text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors break-all"
              >
                {brandData.contactInfo.email}
              </a>
            </div>
          </div>
        </Card>

        {/* Phone Card */}
        <Card variant="bordered" padding="lg" className="hover:shadow-lg transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Phone className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Phone Number
              </p>
              <a
                href={`tel:${brandData.contactInfo.phone}`}
                className="text-lg font-medium text-gray-900 dark:text-white hover:text-green-600 dark:hover:text-green-400 transition-colors"
              >
                {brandData.contactInfo.phone}
              </a>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default AboutTab;
