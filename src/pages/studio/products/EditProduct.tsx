import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Pencil, 
  ChevronDown, 
  Copy, 
  Archive, 
  Trash2, 
  Crop, 
  ArrowLeftRight, 
  GripVertical, 
  Plus, 
  CheckCircle, 
  Video, 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Link as LinkIcon, 
  X,
  MoreHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EditProduct: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [productTitle, setProductTitle] = useState('Premium Cotton Oversized Tee');
  const [price, setPrice] = useState(45.00);
  const [comparePrice, setComparePrice] = useState(65.00);
  const [costPerItem, setCostPerItem] = useState(12.50);
  const [description, setDescription] = useState('Crafted from 100% organic cotton, this oversized tee features a relaxed fit and dropped shoulders for ultimate comfort. Perfect for everyday wear.');

  return (
    <div className="flex flex-col min-h-full bg-[#0f0f0f] text-[#e5e5e5] font-sans">
        
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-[#0f0f0f]/85 backdrop-blur-xl border-b border-white/10 w-full px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            
          {/* Left: Breadcrumbs & Title */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center text-xs text-gray-400 gap-2">
              <button onClick={() => navigate(-1)} className="hover:text-white transition-colors flex items-center">
                <ArrowLeft className="w-3 h-3 mr-1" /> Products
              </button>
              <span>/</span>
              <span>Edit Product</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-white flex items-center gap-2 group cursor-pointer">
                {productTitle}
                <Pencil className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
              <div className="relative group">
                <button className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  Active
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="hidden md:flex items-center gap-2 mr-2">
              <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Duplicate">
                <Copy className="w-4 h-4" />
              </button>
              <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Archive">
                <Archive className="w-4 h-4" />
              </button>
              <button className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="h-8 w-px bg-white/10 hidden md:block"></div>
            <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all">
              Save Changes
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
          {/* LEFT COLUMN: Media (30% approx -> 4 cols) */}
          <div className="lg:col-span-4 space-y-6">
              
            {/* Media Gallery */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white">Media</h3>
                <span className="text-xs text-gray-400">4 of 8 used</span>
              </div>

              {/* Main Image */}
              <div className="relative aspect-[4/5] w-full rounded-lg overflow-hidden mb-3 group border border-white/5">
                <img src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Main Product" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"><Crop className="w-4 h-4" /></button>
                  <button className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"><ArrowLeftRight className="w-4 h-4" /></button>
                </div>
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-[10px] font-medium text-white">Primary</div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
                  "https://images.unsplash.com/photo-1576566588028-4147f3842f27?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
                  "https://images.unsplash.com/photo-1503341455253-b2e72333dbdb?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
                ].map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/5 group cursor-move">
                    <img src={src} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={`Gallery ${i}`} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <GripVertical className="w-4 h-4 text-white/70" />
                    </div>
                  </div>
                ))}
                <button className="aspect-square rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all">
                  <Plus className="w-4 h-4 mb-1" />
                  <span className="text-[10px]">Add</span>
                </button>
              </div>

              <div className="pt-4 border-t border-white/10">
                <h4 className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">Required Shots</h4>
                <ul className="space-y-2">
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Front View</span>
                  </li>
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Back View</span>
                  </li>
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Detail Shot</span>
                  </li>
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-2"><div className="w-3 h-3 border border-gray-500 rounded-full" /> Lifestyle</span>
                    <span className="text-indigo-400 cursor-pointer hover:underline">Upload</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Video Section */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white">Product Video</h3>
              </div>
              <div className="rounded-lg border border-dashed border-white/20 p-6 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-3 text-indigo-400">
                  <Video className="w-4 h-4" />
                </div>
                <p className="text-sm text-gray-300 font-medium">Add Video</p>
                <p className="text-xs text-gray-500 mt-1">MP4, WebM up to 50MB</p>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Details (70% approx -> 8 cols) */}
          <div className="lg:col-span-8 space-y-6">
              
            {/* Basic Info */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-medium text-white mb-6">Basic Information</h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Product Title</label>
                  <input 
                    type="text" 
                    value={productTitle} 
                    onChange={(e) => setProductTitle(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all" 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Category</label>
                    <div className="relative">
                      <select className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white appearance-none cursor-pointer focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all">
                        <option>T-Shirts</option>
                        <option>Hoodies</option>
                        <option>Accessories</option>
                      </select>
                      <div className="absolute right-4 top-3 pointer-events-none text-gray-400">
                        <ChevronDown className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Tags</label>
                    <div className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 min-h-[42px] flex flex-wrap gap-2 items-center">
                      <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                        Summer <X className="w-3 h-3 cursor-pointer hover:text-white" />
                      </span>
                      <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                        Cotton <X className="w-3 h-3 cursor-pointer hover:text-white" />
                      </span>
                      <input type="text" placeholder="Add tag..." className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 w-20 flex-1 p-0 focus:ring-0" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                  <div className="bg-black/20 border border-white/10 rounded-lg overflow-hidden">
                    <div className="bg-white/5 border-b border-white/10 px-3 py-2 flex items-center gap-3">
                      <button className="text-gray-400 hover:text-white"><Bold className="w-3 h-3" /></button>
                      <button className="text-gray-400 hover:text-white"><Italic className="w-3 h-3" /></button>
                      <button className="text-gray-400 hover:text-white"><Underline className="w-3 h-3" /></button>
                      <div className="w-px h-4 bg-white/10"></div>
                      <button className="text-gray-400 hover:text-white"><List className="w-3 h-3" /></button>
                      <button className="text-gray-400 hover:text-white"><ListOrdered className="w-3 h-3" /></button>
                      <div className="w-px h-4 bg-white/10"></div>
                      <button className="text-gray-400 hover:text-white"><LinkIcon className="w-3 h-3" /></button>
                    </div>
                    <textarea 
                      className="w-full bg-transparent border-none p-4 text-sm text-gray-300 focus:ring-0 h-32 resize-none focus:outline-none" 
                      placeholder="Describe your product..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-white">Pricing</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">On Sale</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-gray-500 text-sm">$</span>
                    <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-lg pl-8 pr-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Compare at Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-gray-500 text-sm">$</span>
                    <input type="number" value={comparePrice} onChange={(e) => setComparePrice(Number(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-lg pl-8 pr-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Cost per Item</label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-gray-500 text-sm">$</span>
                    <input type="number" value={costPerItem} onChange={(e) => setCostPerItem(Number(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-lg pl-8 pr-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all" />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Margin: 72% • Profit: $32.50</p>
                </div>
              </div>
            </div>

            {/* Variants */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-lg font-medium text-white">Variants</h2>
                <button className="text-indigo-400 text-sm hover:text-indigo-300 font-medium">+ Add Variant</button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-3 font-medium">Variant</th>
                      <th className="px-6 py-3 font-medium">Price</th>
                      <th className="px-6 py-3 font-medium">SKU</th>
                      <th className="px-6 py-3 font-medium">Inventory</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                        { size: 'S', sku: 'TEE-BLK-S', stock: 124 },
                        { size: 'M', sku: 'TEE-BLK-M', stock: 85 },
                        { size: 'L', sku: 'TEE-BLK-L', stock: 12, low: true }
                    ].map((variant) => (
                      <tr key={variant.size} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-gray-800 border border-white/10 overflow-hidden">
                              <img src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80" className="w-full h-full object-cover" alt="" />
                            </div>
                            <span className="text-white">Black / {variant.size}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-300">$45.00</td>
                        <td className="px-6 py-4 text-gray-400">{variant.sku}</td>
                        <td className="px-6 py-4">
                          <input type="number" defaultValue={variant.stock} className={`bg-black/20 border w-20 rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-indigo-500 text-white ${variant.low ? 'border-red-500/50 text-red-400' : 'border-white/10'}`} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-gray-500 hover:text-white transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory & Shipping Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Inventory */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-medium text-white">Inventory</h2>
                  <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300">View History</a>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">SKU (Stock Keeping Unit)</label>
                    <input type="text" value="TEE-BLK-GEN" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Barcode (ISBN, UPC, GTIN)</label>
                    <input type="text" placeholder="Enter barcode" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all" />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <input type="checkbox" id="track-qty" defaultChecked className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor="track-qty" className="text-sm text-gray-300">Track quantity</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="continue-selling" className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor="continue-selling" className="text-sm text-gray-300">Continue selling when out of stock</label>
                  </div>
                </div>
              </div>

              {/* Shipping */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-medium text-white mb-5">Shipping</h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <input type="checkbox" id="physical-product" defaultChecked className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor="physical-product" className="text-sm text-gray-300">This is a physical product</label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Weight</label>
                      <div className="relative">
                        <input type="number" defaultValue={0.2} className="w-full bg-black/20 border border-white/10 rounded-lg pl-4 pr-10 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all" />
                        <span className="absolute right-3 top-2.5 text-gray-500 text-xs">kg</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Customs Region</label>
                      <select className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all">
                        <option>US</option>
                        <option>EU</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-medium text-white mb-5">Additional Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Materials</label>
                  <input type="text" defaultValue="100% Organic Cotton" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Care Instructions</label>
                  <input type="text" defaultValue="Machine wash cold, tumble dry low" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all" />
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">Returns Eligible</p>
                    <p className="text-xs text-gray-500">Allow customers to return this item within 30 days</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">Sustainability Claim</p>
                    <p className="text-xs text-gray-500">Display eco-friendly badge on product page</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/10 bg-[#0f0f0f] py-6 px-6 mt-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span>Last saved 2 minutes ago</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-sm text-gray-400 hover:text-white transition-colors">Discard Changes</button>
            <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all">
              Save Changes
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default EditProduct;
