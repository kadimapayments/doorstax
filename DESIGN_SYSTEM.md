# DoorStax Design System — Marketing Website

## 1. Visual Theme & Atmosphere

Built on Stripe-grade design principles adapted for the DoorStax brand. The page opens on a clean white canvas (`#ffffff`) with deep navy headings (`#23297D`) and the DoorStax vivid purple (`#5B00FF`) that functions as both brand anchor and interactive accent. The lavender accent (`#BDA2FF`) provides a softer companion for gradients and secondary elements. The overall impression is of a financial institution redesigned by a world-class type foundry.

The custom `sohne-var` variable font is the defining element of Stripe's visual identity. Every text element enables the OpenType `"ss01"` stylistic set, which modifies character shapes for a distinctly geometric, modern feel. At display sizes (48px-56px), sohne-var runs at weight 300 -- an extraordinarily light weight for headlines that creates an ethereal, almost whispered authority. This is the opposite of the "bold hero headline" convention; Stripe's headlines feel like they don't need to shout. The negative letter-spacing (-1.4px at 56px, -0.96px at 48px) tightens the text into dense, engineered blocks. At smaller sizes, the system also uses weight 300 with proportionally reduced tracking, and tabular numerals via `"tnum"` for financial data display.

What truly distinguishes Stripe is its shadow system. Rather than the flat or single-layer approach of most sites, Stripe uses multi-layer, blue-tinted shadows: the signature `rgba(50,50,93,0.25)` combined with `rgba(0,0,0,0.1)` creates shadows with a cool, almost atmospheric depth -- like elements are floating in a twilight sky. The blue-gray undertone of the primary shadow color (50,50,93) ties directly to the navy-purple brand palette, making even elevation feel on-brand.

**Key Characteristics:**
- sohne-var with OpenType `"ss01"` on all text -- a custom stylistic set that defines the brand's letterforms
- Weight 300 as the signature headline weight -- light, confident, anti-convention
- Negative letter-spacing at display sizes (-1.4px at 56px, progressive relaxation downward)
- Blue-tinted multi-layer shadows using `rgba(50,50,93,0.25)` -- elevation that feels brand-colored
- Deep navy (`#23297D`) headings instead of black -- warm, premium, financial-grade
- Conservative border-radius (4px-8px) -- nothing pill-shaped, nothing harsh
- Lavender (`#BDA2FF`) and vivid purple (`#5B00FF`) gradient accents for hero and decorative elements
- `SourceCodePro` as the monospace companion for code and technical labels

## 2. Color Palette & Roles

### Primary (DoorStax Brand)
- **DoorStax Purple** (`#5B00FF`): Primary brand color, CTA backgrounds, link text, interactive highlights. The vivid purple that anchors the entire system.
- **DoorStax Lavender** (`#BDA2FF`): Secondary brand color, gradient starts, soft accents, hover backgrounds.
- **DoorStax Mid-Purple** (`#7C3AFF`): Interactive mid-tone, dark-mode primary, button hovers.
- **Deep Navy** (`#23297D`): Primary heading color. Not black, not gray -- the DoorStax deep navy that adds warmth and depth.
- **Pure White** (`#ffffff`): Page background, card surfaces, button text on dark backgrounds.

### Brand & Dark
- **Brand Dark** (`#0C0D1F`): Deep indigo-black for dark sections, footer backgrounds, and immersive brand moments.
- **Card Dark** (`#131528`): Dark card surfaces in dark-mode sections.
- **Muted Dark** (`#1E2040`): Muted backgrounds in dark sections.

### Accent Colors
- **Ruby** (`#ea2261`): Warm red-pink for icons, alerts, and accent elements.
- **Magenta** (`#f96bee`): Vivid pink-purple for gradients and decorative highlights.

### Interactive
- **Primary Purple** (`#5B00FF`): Primary link color, active states, selected elements.
- **Purple Hover** (`#7C3AFF`): Lighter purple for hover states on primary elements.
- **Purple Deep** (`#23297D`): Deep navy for icon hover states and dark text.
- **Purple Light** (`#BDA2FF`): Soft lavender for subdued hover backgrounds, gradient starts.
- **Purple Border** (`rgba(189,162,255,0.25)`): DoorStax border color (from brand tokens).

### Neutral Scale (DoorStax Grayscale)
- **Heading** (`#23297D`): Primary headings, nav text, strong labels.
- **Phantom** (`#1E1E24`): Darkest text in light mode.
- **Arsenic** (`#40424D`): Secondary headings, form labels.
- **Graphite** (`#6E7180`): Body text, descriptions, captions.
- **Space** (`#9DA2B3`): Muted text, placeholders.
- **Steel** (`#BCBFCC`): Disabled text, subtle labels.
- **Smoke** (`#D3D6E0`): Borders, dividers.
- **Cloud** (`#EDEFF7`): Light backgrounds, surface tints.
- **Success Green** (`#15be53`): Status badges, success indicators.
- **Success Text** (`#108c3d`): Success badge text color.

### Surface & Borders
- **Border Default** (`#D3D6E0`): Standard border color for cards and dividers (Smoke).
- **Border Purple** (`rgba(189,162,255,0.25)`): Active/selected state borders (DoorStax token).
- **Border Light** (`#EDEFF7`): Subtle borders and surface separators (Cloud).

### Shadow Colors
- **Shadow Blue** (`rgba(50,50,93,0.25)`): Blue-tinted primary shadow.
- **Shadow Dark Blue** (`rgba(3,3,39,0.25)`): Deeper blue shadow for elevated elements.
- **Shadow Black** (`rgba(0,0,0,0.1)`): Secondary shadow layer.
- **Shadow Ambient** (`rgba(23,23,23,0.08)`): Soft ambient shadow.

## 3. Typography Rules

### Font Family
- **Primary**: `sohne-var`, fallback: `SF Pro Display`
- **Monospace**: `SourceCodePro`, fallback: `SFMono-Regular`
- **OpenType Features**: `"ss01"` globally; `"tnum"` for tabular numbers.

### Hierarchy
- Display Hero: 56px, weight 300, line-height 1.03, letter-spacing -1.4px
- Display Large: 48px, weight 300, line-height 1.15, letter-spacing -0.96px
- Section Heading: 32px, weight 300, line-height 1.10, letter-spacing -0.64px
- Sub-heading Large: 26px, weight 300, line-height 1.12, letter-spacing -0.26px
- Body Large: 18px, weight 300, line-height 1.40
- Body: 16px, weight 300-400, line-height 1.40
- Button: 16px, weight 400
- Caption: 13px, weight 400
- Code: SourceCodePro 12px, weight 500, line-height 2.00

## 4. Component Stylings

### Buttons
- Primary: `#5B00FF` bg, white text, 4px radius, 8px 16px padding
- Primary Hover: `#7C3AFF` bg
- Ghost: transparent, `#5B00FF` text, 1px solid `rgba(189,162,255,0.25)`, 4px radius
- Ghost Hover: `rgba(91,0,255,0.05)` bg
- Gradient CTA: `linear-gradient(to right, #BDA2FF, #5B00FF)` bg, white text, 8px radius, shadow `rgba(91,0,255,0.25)`

### Cards
- White bg, 1px solid `#D3D6E0`, 5-6px radius
- Shadow: `rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px`

### Badges
- Success: `rgba(21,190,83,0.2)` bg, `#108c3d` text, 4px radius

### Inputs
- 1px solid `#D3D6E0`, 4px radius, focus: `#5B00FF` border
- Label: `#40424D` 14px, placeholder: `#9DA2B3`

## 5. Layout Principles
- Base unit: 8px
- Max content: ~1080px
- Border-radius: 4px-8px (never pill-shaped, except gradient CTAs which use 8-12px)
- Dark sections: `#0C0D1F` background with `#BDA2FF` accents

## 6. Depth & Elevation
- Flat: No shadow
- Ambient: `rgba(23,23,23,0.06) 0px 3px 6px`
- Standard: `rgba(23,23,23,0.08) 0px 15px 35px`
- Elevated: `rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px`
- Deep: `rgba(3,3,39,0.25) 0px 14px 21px -14px, rgba(0,0,0,0.1) 0px 8px 17px -8px`

## 7. DoorStax Brand Gradient
- Primary gradient: `linear-gradient(135deg, #BDA2FF 0%, #5B00FF 100%)`
- Used for: hero decorations, CTA buttons, accent bars, emblem background
- The DoorStax emblem SVG itself uses this gradient (from `#BDA2FF` to `#5B00FF`)
- Shadow on gradient elements: `rgba(91,0,255,0.25)`

## 8. Do's and Don'ts
### Do
- Use weight 300 for headlines (lightness = luxury)
- Apply blue-tinted shadows (`rgba(50,50,93,0.25)`)
- Use `#23297D` deep navy for headings (not black)
- Use the `#BDA2FF -> #5B00FF` gradient for CTAs and decorative elements
- Keep radius 4px-8px
- Use `"tnum"` for financial numbers
- Use DoorStax grayscale (Cloud -> Phantom) for text hierarchy

### Don't
- Don't use weight 600-700 for headlines
- Don't use large border-radius (16px+, pills) on cards or content
- Don't use neutral gray shadows
- Don't use pure black (`#000000`) for headings -- always `#23297D` deep navy
- Don't skip `"ss01"` on any text
- Don't use Stripe purple (`#533afd`) -- always DoorStax purple (`#5B00FF`)
- Don't use warm accent colors for interactive elements -- purple is primary
