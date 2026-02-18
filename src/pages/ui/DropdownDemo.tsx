import React from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@/components/ui/Dropdown';
import { FrostedButton, IconButton } from '@/components/ui/FrostedButton';
import Tag from '@/components/ui/Tag';
import { MoreVertical, ChevronDown, Filter, SlidersHorizontal } from 'lucide-react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="glass-panel p-4 elev-2">
    <h3 className="text-sm font-semibold text-gray-700 dark:text-white/80 mb-3">{title}</h3>
    <div className="space-y-3">{children}</div>
  </section>
);

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap items-center gap-3">{children}</div>
);

const DropdownDemo: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold">Dropdown Components</h1>
      <p className="text-gray-500">Frosted-glass dropdown patterns for pages, buttons, inputs, and card menus.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Page toolbar filters">
          <Row>
            <Dropdown>
              <DropdownTrigger className="btn-frost-outline btn-tight-sm">
                <Filter className="w-4 h-4" />
                <span>Category</span>
                <ChevronDown className="w-4 h-4" />
              </DropdownTrigger>
              <DropdownMenu>
                <DropdownItem>Casual</DropdownItem>
                <DropdownItem>Formal</DropdownItem>
                <DropdownItem>Luxury</DropdownItem>
                <DropdownItem>Vintage</DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <Dropdown>
              <DropdownTrigger className="btn-frost-outline btn-tight-sm">
                <SlidersHorizontal className="w-4 h-4" />
                <span>Sort</span>
                <ChevronDown className="w-4 h-4" />
              </DropdownTrigger>
              <DropdownMenu>
                <DropdownItem>Latest</DropdownItem>
                <DropdownItem>Most Threaded</DropdownItem>
                <DropdownItem>Trending</DropdownItem>
                <DropdownItem>Price: Low to High</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </Row>
        </Section>

        <Section title="Button-attached menus">
          <Row>
            <Dropdown>
              <DropdownTrigger className="btn-frost-primary btn-tight-sm">Shop Now</DropdownTrigger>
              <DropdownMenu>
                <DropdownItem>Buy Now</DropdownItem>
                <DropdownItem>Add to Cart</DropdownItem>
                <DropdownItem>Wishlist</DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <Dropdown>
              <DropdownTrigger className="btn-frost-ghost btn-tight-sm">Share Collection</DropdownTrigger>
              <DropdownMenu>
                <DropdownItem>Copy Link</DropdownItem>
                <DropdownItem>Share to Instagram</DropdownItem>
                <DropdownItem>Share to X</DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <Dropdown>
              <DropdownTrigger className="btn-frost-outline btn-tight-sm">Wishlist</DropdownTrigger>
              <DropdownMenu>
                <DropdownItem>View Wishlist</DropdownItem>
                <DropdownItem>Save for Later</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </Row>
        </Section>

        <Section title="Input-adjacent dropdowns">
          <Row>
            <div className="glass-panel p-2 flex items-center gap-2">
              <input className="bg-transparent outline-none text-sm flex-1 px-2" placeholder="Search…" />
              <Dropdown placement="bottom-end">
                <DropdownTrigger className="btn-frost-ghost btn-tight-xs">
                  <ChevronDown className="w-4 h-4" />
                </DropdownTrigger>
                <DropdownMenu>
                  <DropdownItem>Brands</DropdownItem>
                  <DropdownItem>Collections</DropdownItem>
                  <DropdownItem>People</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          </Row>
        </Section>

        <Section title="Card menus (3-dots)">
          <Row>
            <div className="glass-panel p-3 w-64 h-28 relative">
              <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                <Dropdown>
                  <DropdownTrigger className="btn-tight-xs">
                    <MoreVertical className="w-4 h-4" />
                  </DropdownTrigger>
                  <DropdownMenu>
                    <DropdownItem>Edit</DropdownItem>
                    <DropdownItem>Delete</DropdownItem>
                    <DropdownItem>Share</DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
              <div className="text-xs text-gray-500">Card preview …</div>
            </div>
          </Row>
        </Section>
      </div>

      <Section title="Tags/Chips examples">
        <Row>
          <Tag label="#Ankara" />
          <Tag label="#TrendingNow" color="purple" />
          <Tag label="Size: M" color="gray" />
          <Tag label="₦ 5k - 15k" color="blue" />
          <Tag label="IN STOCK" color="green" />
          <Tag label="SALE" color="red" />
          <Tag iconOnly leftIcon={<span>⭐</span>} />
        </Row>
      </Section>

      <Section title="Buttons examples">
        <Row>
          <FrostedButton variant="primary">Shop Now</FrostedButton>
          <FrostedButton variant="ghost">Add to Wishlist</FrostedButton>
          <FrostedButton variant="outline">Share Collection</FrostedButton>
          <IconButton icon={<MoreVertical className="w-4 h-4" />} />
        </Row>
      </Section>
    </div>
  );
};

export default DropdownDemo;
