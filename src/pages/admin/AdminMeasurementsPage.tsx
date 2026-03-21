import React from 'react';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import AdminTaxonomyPage from './AdminTaxonomyPage';

const AdminMeasurementsPage: React.FC = () => {
  return (
    <>
      <AdminBreadcrumb segments={[{ label: 'Measurements' }]} />
      <AdminTaxonomyPage />
    </>
  );
};

export default AdminMeasurementsPage;
