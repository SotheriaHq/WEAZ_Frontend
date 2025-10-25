import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@/components/ui/Dropdown';

interface AddCollectionDropdownProps {
  openModal: (type: 'BASIC' | 'INSTORE') => void;
  // Variants available:
  // - Button variants: 'primary' | 'ghost' | 'outline'
  // - Sizes: 'xs' | 'sm' | 'md' | 'lg'
  // You can switch by changing the className on DropdownTrigger (btn-frost-*, btn-tight-*)
  variant?: 'primary' | 'ghost' | 'outline';
  asLink?: boolean;
}

const AddCollectionDropdown: React.FC<AddCollectionDropdownProps> = ({ openModal, variant = 'primary', asLink = false }) => {
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
        {asLink ? 'Create collection' : '+ Add Collection'}
      </DropdownTrigger>
      <DropdownMenu>
        <DropdownItem onClick={() => navigate('/profile/collections/create')}>Basic Collection</DropdownItem>
        <DropdownItem onClick={() => openModal('INSTORE')}>Instore Collection</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

export default AddCollectionDropdown;
