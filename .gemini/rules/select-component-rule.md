# Select / Dropdown Component Rule

## Single Source of Truth

All dropdown and select elements **MUST** use the `<Select>` component from `@/components/ui/Select`.

```tsx
import { Select } from '@/components/ui/Select';
```

## Prohibited Patterns

- ❌ Native `<select>` elements (no inline HTML selects)
- ❌ `SelectField` from `@/components/forms/SelectField` (deprecated)
- ❌ Custom one-off dropdown implementations for form fields

## Variants

| Variant   | Use Case                                  |
|-----------|-------------------------------------------|
| `default` | Standard form fields (largest)            |
| `filter`  | Toolbar filters, inline controls          |
| `compact` | Pagination controls, small inline selects |

## Accessibility

- Always provide a `label` prop OR an `aria-label` for screen readers.
- The component includes a hidden native `<select>` for form submission and assistive tech automatically.

## Exceptions

- **`UniversalSelect`** (`@/components/forms/UniversalSelect`) — allowed ONLY for cascading location selects (Country → State → City) in `EditProfileModal.tsx`.
- **Profile dropdowns** (`EditProfileModal.tsx`) are exempt from this rule.

## Theme Support

The `<Select>` component handles dark/light themes automatically. Do not add manual theme classes when using it.
