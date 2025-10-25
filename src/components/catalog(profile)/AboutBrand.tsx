import {
  Building2,
  Facebook,
  Globe,
  Instagram,
  Mail,
  Phone,
  Twitter,
  Package,
  Ruler,
  Undo,
} from 'lucide-react';

interface AboutBrandProps {
  brandData: {
    brandName: string;
    title: string;
    description: string;
    socialLinks: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
      website?: string;
    };
    contactInfo: {
      email: string;
      phone: string;
      businessType: string;
    };
  };
}

const InfoCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className = '',
}) => (
  <div
    className={`w-full rounded-2xl border border-gray-200/70 bg-white/95 p-5 shadow-sm backdrop-blur-sm transition dark:border-gray-700/60 dark:bg-gray-900/60 ${className}`}
  >
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">
      {title}
    </h3>
    {children}
  </div>
);

const ContactItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div>
    <div className="mb-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      {icon}
      <span>{label}</span>
    </div>
    <p className="break-words text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
  </div>
);

export const AboutBrand: React.FC<AboutBrandProps> = ({ brandData }) => (
  <div className="flex flex-col gap-4">
    <InfoCard
      title={brandData.title}
      className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-purple-600/20 dark:via-gray-900/60 dark:to-indigo-500/20"
    >
      <div className="mb-4">
        {/* <h2 className="text-2xl font-black italic tracking-[0.3em] text-transparent drop-shadow-xl sm:text-2xl"> */}
          {/* <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 bg-clip-text text-transparent">
            {brandData.brandName}
          </span>
        </h2> */}
      </div>
      <p className="mb-4 text-justify text-sm font-serif leading-relaxed text-gray-700 dark:text-gray-200">
        {brandData.description}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {brandData.socialLinks.instagram && (
          <a
            href={brandData.socialLinks.instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <Instagram className="h-4 w-4" />
          </a>
        )}
        {brandData.socialLinks.facebook && (
          <a
            href={brandData.socialLinks.facebook}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <Facebook className="h-4 w-4" />
          </a>
        )}
        {brandData.socialLinks.twitter && (
          <a
            href={brandData.socialLinks.twitter}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter"
            className="rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <Twitter className="h-4 w-4" />
          </a>
        )}
        {brandData.socialLinks.website && (
          <a
            href={brandData.socialLinks.website}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Website"
            className="rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <Globe className="h-4 w-4" />
          </a>
        )}
      </div>
    </InfoCard>

    <InfoCard title="Contact Information" className="bg-gray-50 dark:bg-gray-900/50">
      <div className="space-y-4">
        <ContactItem icon={<Mail className="h-3.5 w-3.5" />} label="Email Address" value={brandData.contactInfo.email} />
        <ContactItem icon={<Phone className="h-3.5 w-3.5" />} label="Phone Number" value={brandData.contactInfo.phone} />
        <ContactItem
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Business Type"
          value={brandData.contactInfo.businessType}
        />
      </div>
    </InfoCard>

    <InfoCard
      title="Brand Policies"
      className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-600/20 dark:via-gray-900/60 dark:to-purple-500/20"
    >
      <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-200">
        <li className="flex items-center gap-3">
          <Undo className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-300" />
          <span>Return Policy: 30-day free returns</span>
        </li>
        <li className="flex items-center gap-3">
          <Package className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-300" />
          <span>Shipping: Standard &amp; Express available</span>
        </li>
        <li className="flex items-center gap-3">
          <Ruler className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-300" />
          <span>View our official Size Guide</span>
        </li>
      </ul>
    </InfoCard>
  </div>
);

