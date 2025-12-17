import React, { useState } from 'react';
import { 
  Search, 
  List, 
  Grid, 
  Plus, 
  Archive, 
  Edit, 
  Package, 
  Trash2, 
  Copy, 
  ChevronLeft, 
  ChevronRight, 
  Box,
  MoreHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Define types matches the user's mockup data structure
interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  status: 'ACTIVE' | 'DRAFT' | 'COMING_SOON' | 'ARCHIVED';
  image: string;
}

const ProductManagement: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStock, setFilterStock] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);

  // Mock Data
  const [products] = useState<Product[]>([
    {id: 1, name: 'Premium Cotton T-Shirt', sku: 'TCT-001', category: 'T-Shirts', price: 29.99, comparePrice: 39.99, stock: 145, status: 'ACTIVE', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100&h=100&fit=crop'},
    {id: 2, name: 'Vintage Denim Jacket', sku: 'JKT-002', category: 'Jackets', price: 89.99, comparePrice: null, stock: 23, status: 'ACTIVE', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=100&h=100&fit=crop'},
    {id: 3, name: 'Slim Fit Chinos', sku: 'PNT-003', category: 'Pants', price: 49.99, comparePrice: null, stock: 8, status: 'ACTIVE', image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=100&h=100&fit=crop'},
    {id: 4, name: 'Merino Wool Sweater', sku: 'SWT-004', category: 'Sweaters', price: 79.99, comparePrice: 99.99, stock: 67, status: 'DRAFT', image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=100&h=100&fit=crop'},
    {id: 5, name: 'Canvas Sneakers', sku: 'SHO-005', category: 'Shoes', price: 59.99, comparePrice: null, stock: 0, status: 'COMING_SOON', image: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=100&h=100&fit=crop'},
    {id: 6, name: 'Leather Belt', sku: 'ACC-006', category: 'Accessories', price: 34.99, comparePrice: null, stock: 89, status: 'ACTIVE', image: 'https://images.unsplash.com/photo-1624222247344-550fb60583bb?w=100&h=100&fit=crop'},
    {id: 7, name: 'Flannel Shirt', sku: 'SHT-007', category: 'Shirts', price: 44.99, comparePrice: null, stock: 156, status: 'ARCHIVED', image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=100&h=100&fit=crop'},
    {id: 8, name: 'Cargo Shorts', sku: 'SHT-008', category: 'Shorts', price: 39.99, comparePrice: 49.99, stock: 5, status: 'ACTIVE', image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=100&h=100&fit=crop'}
  ]);

  // Helpers
  const toggleSelect = (id: number) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter(p => p !== id));
    } else {
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  const selectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
  };

  const getStatusColor = (status: Product['status']) => {
    const colors = {
      'ACTIVE': 'bg-green-500/20 text-green-400 border-green-500/30',
      'DRAFT': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      'COMING_SOON': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'ARCHIVED': 'bg-gray-600/20 text-gray-500 border-gray-600/30'
    };
    return colors[status] || colors['DRAFT'];
  };

  const showBulkActions = selectedProducts.length > 0;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Product Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your store inventory and product catalog</p>
        </div>

        {/* Action Bar */}
        <div className="mb-6 backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col lg:flex-row gap-4">
            
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products by name or SKU..." 
                  className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              {/* Status Filter */}
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="coming_soon">Coming Soon</option>
                <option value="archived">Archived</option>
              </select>

              {/* Category Filter */}
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="tshirts">T-Shirts</option>
                <option value="jackets">Jackets</option>
                <option value="pants">Pants</option>
                <option value="sweaters">Sweaters</option>
                <option value="shoes">Shoes</option>
                <option value="accessories">Accessories</option>
              </select>

              {/* Stock Filter */}
              <select 
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
                className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
              >
                <option value="all">All Stock</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>

              {/* View Toggle */}
              <div className="flex bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-3 transition-all ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-3 transition-all border-l border-gray-200 dark:border-white/10 ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>

              {/* Add Product Button */}
              <button 
                onClick={() => navigate('/studio/products/create')}
                className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Product</span>
              </button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {showBulkActions && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <span className="text-gray-400">{selectedProducts.length} items selected</span>
              <button className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-sm flex items-center gap-2">
                <Archive className="w-4 h-4" /> Archive Selected
              </button>
              <button className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-sm flex items-center gap-2">
                <Edit className="w-4 h-4" /> Change Status
              </button>
              <button className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-sm flex items-center gap-2">
                <Package className="w-4 h-4" /> Update Stock
              </button>
              <button className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-all text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>

        {/* Product Table */}
        <div className="backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
                  <th className="text-left p-4 w-12">
                    <input 
                      type="checkbox" 
                      onChange={selectAll}
                      checked={products.length > 0 && selectedProducts.length === products.length}
                      className="w-5 h-5 rounded border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-[#1a1a1a] text-purple-600 focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                    />
                  </th>
                  <th className="text-left p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider">Product</th>
                  <th className="text-left p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider hidden md:table-cell">Category</th>
                  <th className="text-left p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider">Price</th>
                  <th className="text-left p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider hidden lg:table-cell">Stock</th>
                  <th className="text-left p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider">Status</th>
                  <th className="text-right p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr 
                    key={product.id}
                    className={`border-b border-gray-200 dark:border-white/5 hover:bg-purple-50 dark:hover:bg-purple-500/5 transition-all cursor-pointer group ${
                      selectedProducts.includes(product.id) ? 'border-l-4 border-l-purple-600 bg-purple-50/50 dark:bg-purple-500/10' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-4">
                      <input 
                        type="checkbox" 
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="w-5 h-5 rounded border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-[#1a1a1a] text-purple-600 focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                      />
                    </td>

                    {/* Product Info */}
                    <td className="p-4">
                      <div className="flex items-center gap-4">
                        <img src={product.image} alt={product.name} className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-white/10" />
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white mb-1">{product.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{product.sku}</div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="p-4 text-gray-600 dark:text-gray-300 hidden md:table-cell">{product.category}</td>

                    {/* Price */}
                    <td className="p-4">
                      <div className="font-semibold text-gray-900 dark:text-white">${product.price.toFixed(2)}</div>
                      {product.comparePrice && (
                        <div className="text-sm text-gray-400 line-through">${product.comparePrice.toFixed(2)}</div>
                      )}
                    </td>

                    {/* Stock */}
                    <td className="p-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 dark:text-white font-medium">{product.stock}</span>
                        {product.stock > 0 && product.stock <= 10 && (
                          <span className="px-2 py-1 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs rounded-full border border-orange-200 dark:border-orange-500/30">Low</span>
                        )}
                        {product.stock === 0 && (
                          <span className="px-2 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-full border border-red-200 dark:border-red-500/30">Out</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span 
                        className={`px-3 py-1 rounded-full text-xs font-semibold border inline-block ${getStatusColor(product.status)}`}
                      >
                        {product.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => navigate(`/studio/products/edit/${product.id}`)}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-500/10 rounded-lg transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-400/10 rounded-lg transition-all">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-400/10 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Items per page */}
              <div className="flex items-center gap-3">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Items per page:</span>
                <select className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 cursor-pointer">
                  <option>10</option>
                  <option>25</option>
                  <option>50</option>
                  <option>100</option>
                </select>
              </div>

              {/* Page info */}
              <div className="text-gray-500 dark:text-gray-400 text-sm">
                Showing <span className="text-gray-900 dark:text-white font-semibold">1-{products.length}</span> of <span className="text-gray-900 dark:text-white font-semibold">{products.length}</span> products
              </div>

              {/* Page numbers */}
              <div className="flex items-center gap-2">
                <button className="p-2 px-3 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="p-2 px-4 bg-purple-600 text-white rounded-lg font-semibold shadow-md shadow-purple-500/20">1</button>
                <button className="p-2 px-4 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all">2</button>
                <button className="p-2 px-4 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all">3</button>
                <button className="p-2 px-3 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State (Conditional) */}
        {products.length === 0 && (
          <div className="backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl p-12 text-center mt-6">
            <div className="max-w-md mx-auto">
              <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-purple-500/20 to-purple-700/20 rounded-full flex items-center justify-center border border-purple-500/30">
                <Box className="w-12 h-12 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No products yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Start building your catalog by adding your first product to the store.</p>
              <button 
                onClick={() => navigate('/studio/products/create')}
                className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Your First Product
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductManagement;
