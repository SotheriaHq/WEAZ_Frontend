const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'store', 'wizard', 'StorePoliciesStep.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Extract the Customer Contact Card
const contactStartIdx = content.indexOf('{/* Customer Contact Card */}');
// find the end of the div for the contact card
// it ends right before standard div ending block:
const contactEndMarker = `                    </p>\n                  </div>\n                </div>`;
const contactEndIdx = content.indexOf(contactEndMarker, contactStartIdx) + contactEndMarker.length;
const contactCardOriginal = content.substring(contactStartIdx, contactEndIdx);

// 2. Extract the Size Chart Card
const sizeChartStartIdx = content.indexOf('{/* Size Chart Card - Collapsible */}');
const sizeChartEndMarker = `                  </div>\n                  )}\n                </div>`;
const sizeChartEndIdx = content.indexOf(sizeChartEndMarker, sizeChartStartIdx) + sizeChartEndMarker.length;
const sizeChartCardOriginal = content.substring(sizeChartStartIdx, sizeChartEndIdx);

// 3. Assemble the big replace block (from the start of Size chart to the end of Contact card)
// Check their original order
const originalBlockStartIdx = Math.min(sizeChartStartIdx, contactStartIdx);
const originalBlockEndIdx = Math.max(sizeChartEndIdx, contactEndIdx);
const originalBlock = content.substring(originalBlockStartIdx, originalBlockEndIdx);

// 4. Create the new Size Chart Card code
const newSizeChartCard = `{/* Size Chart Card - Collapsible - lg:col-span-2 for wide modern layout */}
                <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-gray-50/80 to-white/50 dark:from-white/[0.02] dark:to-white/[0.01] border border-gray-200/80 dark:border-white/10 p-6 space-y-6 shadow-sm overflow-hidden relative">
                  {/* Decorative modern background element */}
                  <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-400/5 dark:bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  
                  <button
                    type="button"
                    onClick={() => toggleSection('sizeChart')}
                    className="w-full flex items-center justify-between group relative z-10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner border border-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
                        <Ruler className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                          Size Chart Configurator
                          {(data.sizeChartPresetKey || data.sizeChartUrl) ? (
                            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <Check className="w-3 h-3" /> Configured
                            </span>
                          ) : null}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {data.sizeChartPresetKey ? \`Active: \${SIZE_CHARTS.find(c => c.id === data.sizeChartPresetKey)?.title || data.sizeChartPresetKey}\` : 'Choose a predefined sizing lane or upload your custom reference.'}
                        </p>
                      </div>
                    </div>
                    <div className={\`p-2 rounded-full transition-all duration-300 \${expandedSections.sizeChart ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rotate-180' : 'bg-gray-100 dark:bg-white/5 text-gray-500 group-hover:bg-gray-200 dark:group-hover:bg-white/10'}\`}>
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </button>

                  {expandedSections.sizeChart && (
                  <div className="flex flex-col gap-8 pt-6 border-t border-gray-100 dark:border-white/5 relative z-10 animate-in fade-in slide-in-from-top-4 duration-500">
                    
                    {/* Top Section: Presets Grid */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          Select Sizing System
                        </h4>
                        <div className="text-xs text-gray-500">
                          {data.sizeChartSystem === 'custom' ? 'Custom Image Active' : \`\${SIZE_CHARTS.length} lanes available\`}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {SIZE_CHARTS.map((chart, index) => {
                          const isActive = data.sizeChartPresetKey === chart.id;
                          const isAfrica = chart.id === 'africa-west-south';
                          return (
                            <button
                              key={chart.id}
                              onClick={() =>
                                onChange({
                                  sizeChartPresetKey: chart.id,
                                  sizeChartSystem: chart.id,
                                  sizeChartFile: null,
                                  sizeChartUrl: null,
                                })
                              }
                              className={\`p-5 rounded-2xl border text-left transition-all duration-300 group relative overflow-hidden flex flex-col h-full \${
                                isActive
                                  ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-500/5 border-emerald-400/50 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/20 md:-translate-y-1'
                                  : 'bg-white dark:bg-black/20 border-gray-200 dark:border-white/10 hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:bg-emerald-50/30 hover:shadow-md'
                              }\`}
                            >
                              {isAfrica && (
                                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-lg shadow-sm">
                                  Recommended
                                </div>
                              )}
                              <div className="flex justify-between items-start mb-3">
                                <div className={\`p-2 rounded-lg \${isActive ? 'bg-emerald-500 text-white shadow-inner' : 'bg-gray-100 dark:bg-white/5 text-gray-500 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-600 transition-colors'}\`}>
                                  {index === 0 ? <Sparkles className="w-4 h-4" /> : <Ruler className="w-4 h-4" />}
                                </div>
                                <div
                                  className={\`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all \${
                                    isActive
                                      ? 'bg-emerald-500 border-emerald-500 text-white scale-110 shadow-md shadow-emerald-500/20'
                                      : 'bg-white dark:bg-black border-gray-200 dark:border-gray-700 text-transparent group-hover:border-emerald-400'
                                  }\`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </div>
                              </div>
                              <div className="mt-auto">
                                <h5 className={\`text-base font-bold mb-1.5 transition-colors \${isActive ? 'text-emerald-900 dark:text-emerald-100' : 'text-gray-900 dark:text-white'}\`}>
                                  {chart.title}
                                </h5>
                                <p className={\`text-xs leading-relaxed \${isActive ? 'text-emerald-700/80 dark:text-emerald-300/80' : 'text-gray-500 dark:text-gray-400'}\`}>
                                  {chart.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-white/[0.01] hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all duration-300 group"
                        >
                          <div className="w-10 h-10 rounded-full bg-white dark:bg-black shadow-sm border border-gray-100 dark:border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="w-4 h-4 text-gray-500 group-hover:text-purple-600" />
                          </div>
                          <div className="text-left">
                            <span className="block text-sm font-semibold text-gray-900 dark:text-white group-hover:text-purple-700 transition-colors">Upload Custom Chart</span>
                            <span className="block text-xs text-gray-500">Supports PNG, JPG (Max 5MB)</span>
                          </div>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleSizeChartUpload}
                        />
                      </div>
                    </div>

                    {/* Bottom Section: Preview Area */}
                    <div className="flex flex-col space-y-3 bg-white dark:bg-[#111] rounded-2xl border border-gray-200/80 dark:border-white/10 overflow-hidden shadow-sm">
                      <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                         <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                           Live Preview
                           {selectedPreset && !data.sizeChartUrl && (
                             <span className="relative flex h-2 w-2 ml-1">
                               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                               <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                             </span>
                           )}
                         </h4>
                         {data.sizeChartUrl && (
                           <span className="text-[10px] uppercase font-bold tracking-wider text-purple-600 bg-purple-100 dark:bg-purple-500/20 px-2.5 py-1 rounded-full">Custom Image</span>
                         )}
                      </div>
                      
                      <div className="p-1">
                        {data.sizeChartUrl ? (
                          <div className="relative group w-full flex items-center justify-center bg-gray-50/80 dark:bg-black/40 rounded-xl p-6 min-h-[300px]">
                            <MediaRenderer
                              kind="image"
                              src={data.sizeChartUrl}
                              alt="Custom Size Chart"
                              className="max-w-full lg:max-w-2xl max-h-[500px] object-contain rounded-lg shadow-md border border-gray-200/50 dark:border-white/10"
                            />
                            <button
                              onClick={() =>
                                onChange({ sizeChartFile: null, sizeChartUrl: null })
                              }
                              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/90 dark:bg-black/60 shadow-lg backdrop-blur border border-gray-200 dark:border-white/10 text-red-500 hover:bg-red-500 hover:text-white transition-all transform opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                              title="Remove custom chart"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ) : selectedPreset ? (
                          <div className="flex flex-col w-full h-full bg-transparent overflow-hidden">
                            <div className="overflow-x-auto p-4">
                              <table className="w-full text-sm text-left">
                                <thead>
                                  <tr className="border-b border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400">
                                    <th className="px-6 py-4 font-semibold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-white/5 rounded-tl-xl w-1/4">Size Standard</th>
                                    <th className="px-6 py-4 font-medium text-xs uppercase tracking-wider">Bust</th>
                                    <th className="px-6 py-4 font-medium text-xs uppercase tracking-wider">Waist</th>
                                    <th className="px-6 py-4 font-medium text-xs uppercase tracking-wider bg-gray-50/50 dark:bg-white/5 rounded-tr-xl">Hip</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                  {selectedPreset.rows.map((row, idx) => (
                                    <tr key={row.size} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                                      <td className="px-6 py-4">
                                        <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white font-bold text-sm border border-gray-200/50 dark:border-white/5 shadow-sm group-hover:border-emerald-500/30 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/10 transition-colors">
                                          {row.size}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">{row.bust}</td>
                                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">{row.waist}</td>
                                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap bg-gray-50/30 dark:bg-white/[0.01]">{row.hip}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center p-12 bg-gray-50/30 dark:bg-black/10 rounded-xl m-2 border border-dashed border-gray-200 dark:border-white/10">
                            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-4 relative">
                              <Sparkles className="w-8 h-8 text-emerald-400 dark:text-emerald-500" />
                              <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 rounded-full animate-pulse" />
                            </div>
                            <h5 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Size Chart Selected</h5>
                            <p className="text-sm text-gray-500 max-w-sm mx-auto">
                              Choose a standardized sizing lane from above or upload your own guide to activate the preview area.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  )}
                </div>`;

// Combine in new order: Contact Card first, then Size Chart Card
const newBlock = contactCardOriginal + '\n\n' + newSizeChartCard;

if (originalBlockStartIdx === -1 || contactStartIdx === -1 || sizeChartStartIdx === -1) {
  console.log("Error: Could not find block markers.");
  process.exit(1);
}

content = content.replace(originalBlock, newBlock);

fs.writeFileSync(filePath, content, 'utf8');
console.log("UI Update complete.");
