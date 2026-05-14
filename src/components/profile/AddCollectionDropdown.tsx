import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@/components/ui/Dropdown';
import { buildDesignRoute } from '@/utils/catalogRoutes';

interface AddCollectionDropdownProps {
  openModal: (type: 'BASIC' | 'INSTORE') => void;
  // Variants available:
  // - Button variants: 'primary' | 'ghost' | 'outline'
  // - Sizes: 'xs' | 'sm' | 'md' | 'lg'
  // You can switch by changing the className on DropdownTrigger (btn-frost-*, btn-tight-*)
  variant?: 'primary' | 'ghost' | 'outline';
  asLink?: boolean;
}

const AddCollectionDropdown: React.FC<AddCollectionDropdownProps> = ({ openModal: _openModal, variant = 'primary', asLink = false }) => {
  const navigate = useNavigate();
  return (
    <Dropdown>
      {/* Variants you can use here:
          - className="btn-frost-primary btn-tight-sm"
          - className="btn-frost-ghost btn-tight-sm"
          - className="btn-frost-outline btn-tight-sm"
          Sizes: swap btn-tight-sm for btn-tight-xs|md|lg */}
      <DropdownTrigger className={
        variant === 'ghost' ? 'btn-frost-ghost btn-tight-sm' :
        variant === 'outline' ? 'btn-frost-outline btn-tight-sm' :
        'btn-frost-primary btn-tight-sm'
      }>
        {asLink ? 'Create design' : '+ Add Design'}
      </DropdownTrigger>
      <DropdownMenu>
        <DropdownItem onClick={() => navigate(buildDesignRoute({ mode: 'create' }))}>Design (Lookbook)</DropdownItem>
        <DropdownItem onClick={() => navigate('/studio/store/collections/new')}>
          Store Collection (Products)
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

export default AddCollectionDropdown;
