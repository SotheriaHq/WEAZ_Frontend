import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type React from 'react';
import type { AuthUserDto } from '@/types/auth';
import EditProfileModal from './EditProfileModal';
import { GlobalModalRouter } from '@/components/modals/GlobalModalRouter';

const brandApiMock = vi.hoisted(() => ({
  getBrandProfile: vi.fn(),
  updateBrandProfile: vi.fn(),
}));

const dispatchMock = vi.hoisted(() => vi.fn());
const userState = vi.hoisted(() => ({
  profile: null as AuthUserDto | null,
}));

vi.mock('@/api/BrandApi', () => ({
  brandApi: brandApiMock,
}));

vi.mock('../../api/BrandApi', () => ({
  brandApi: brandApiMock,
}));

vi.mock('../../services/LocationService', () => ({
  locationService: {
    getCountries: vi.fn(async () => [
      {
        name: 'Nigeria',
        iso2: 'NG',
        flag: '',
        flagImage: 'https://flagcdn.com/ng.svg',
      },
      {
        name: 'Ghana',
        iso2: 'GH',
        flag: '',
        flagImage: 'https://flagcdn.com/gh.svg',
      },
    ]),
    getStates: vi.fn(async () => []),
    getCities: vi.fn(async () => []),
  },
}));

vi.mock('@/components/media/MediaRenderer', () => ({
  default: ({ alt }: { alt?: string }) => <span aria-hidden="true">{alt}</span>,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('react-redux', () => ({
  useDispatch: () => dispatchMock,
  useSelector: <T,>(selector: (state: { user: { profile: AuthUserDto | null } }) => T) =>
    selector({ user: { profile: userState.profile } }),
}));

const makeBrandUser = (overrides: Partial<AuthUserDto> = {}): AuthUserDto => ({
  id: 'user-1',
  username: 'weazbrand',
  email: 'brand@example.com',
  firstName: 'Ada',
  lastName: 'Okafor',
  role: 'User',
  type: 'BRAND',
  themePreference: 'system',
  phoneNumber: null,
  address: null,
  brandFullName: 'WEAZ Atelier',
  brandDescription: 'A focused fashion brand story for setup testing.',
  brandCountry: null,
  brandState: null,
  brandCity: null,
  brandTags: [],
  brandBusinessType: null,
  socialInstagram: null,
  socialFacebook: null,
  socialTwitter: null,
  socialWebsite: null,
  cacNumber: null,
  tin: null,
  ceoNin: null,
  ceoFirstName: null,
  ceoLastName: null,
  companyLocation: null,
  profileImage: null,
  profileImageId: null,
  profileImageFile: null,
  bannerImage: null,
  bannerImageId: null,
  bannerImageFile: null,
  isEmailVerified: true,
  storeId: 'brand-1',
  brandMemberships: [
    {
      brandId: 'brand-1',
      brandName: 'WEAZ Atelier',
      role: 'OWNER',
      status: 'ACTIVE',
      isOwner: true,
    },
  ],
  activeBrandId: 'brand-1',
  isActive: 'Active',
  status: 'ACTIVE',
  createdAt: '2026-06-09T00:00:00.000Z',
  updatedAt: '2026-06-09T00:00:00.000Z',
  ...overrides,
});

const renderModal = (props: Partial<React.ComponentProps<typeof EditProfileModal>> = {}) => {
  const user = makeBrandUser();
  return render(
    <EditProfileModal
      isOpen
      user={user}
      brandProfile={null}
      showSkip={false}
      onSkip={undefined}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      {...props}
    />,
  );
};

describe('EditProfileModal brand setup blocker flow', () => {
  it('renders from the brand setup route query', async () => {
    userState.profile = makeBrandUser();
    brandApiMock.getBrandProfile.mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/profile?modal=brand-setup&modalOrigin=prompt']}>
        <Routes>
          <Route path="/profile" element={<GlobalModalRouter />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('dialog', { name: 'Brand setup' })).toBeInTheDocument();
  });

  it('allows seven selected tags and blocks the eighth tag', async () => {
    renderModal();

    expect(screen.getByText('(Select up to 7)')).toBeInTheDocument();

    const tagLabels = ['Ankara', 'Atelier', 'Bridal', 'Casual', 'Couture', 'Ethical', 'Eveningwear'];
    for (const label of tagLabels) {
      fireEvent.click(screen.getByRole('button', { name: `#${label}` }));
    }

    for (const label of tagLabels) {
      expect(screen.getByRole('button', { name: `#${label}` })).toHaveAttribute('aria-pressed', 'true');
    }

    fireEvent.click(screen.getByRole('button', { name: '#Handmade' }));

    expect(screen.getByText('Choose up to 7 tags.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '#Handmade' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens the country dropdown, selects a country, clears validation, and saves valid setup data', async () => {
    const onSaved = vi.fn();
    const user = makeBrandUser();
    brandApiMock.updateBrandProfile.mockResolvedValue(user);
    renderModal({ user, onSaved });

    const countryButton = await screen.findByRole('button', { name: 'Country' });
    await waitFor(() => expect(countryButton).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: 'Save and Continue' }));
    expect(await screen.findByText('Add at least country or state to complete setup')).toBeInTheDocument();

    fireEvent.click(countryButton);
    const countryListbox = screen.getByRole('listbox', { name: 'Country' });
    expect(within(countryListbox).getByRole('option', { name: 'Nigeria' })).toBeVisible();

    fireEvent.click(within(countryListbox).getByRole('option', { name: 'Nigeria' }));

    await waitFor(() => {
      expect(screen.queryByText('Add at least country or state to complete setup')).not.toBeInTheDocument();
    });
    expect(countryButton).toHaveTextContent('Nigeria');

    fireEvent.click(screen.getByRole('button', { name: '#Ankara' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and Continue' }));

    await waitFor(() => {
      expect(brandApiMock.updateBrandProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          brandCountry: 'Nigeria',
          brandTags: ['Ankara'],
        }),
      );
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(user));
  });
});
