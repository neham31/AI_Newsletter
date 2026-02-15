# PRD: explAI.in Rebrand and Digest TL;DR Feature

## Introduction

This PRD covers three related updates to transform "AI Digest" into "explAI.in":

1. **TL;DR Section**: Add an AI-generated "Key Takeaways" section at the top of digest emails with 3-5 bullet points summarizing the most important insights from the included articles.

2. **Full Rebrand**: Update all branding from "AI Digest" to "explAI.in" across the website, emails, and metadata using the new logo and favicon assets.

3. **UX Improvement**: Increase the size and readability of the source selection cards on the landing page.

## Goals

- Provide subscribers with a quick, scannable summary at the top of each digest email
- Establish consistent "explAI.in" branding across all touchpoints
- Improve source card readability with larger fonts and better visual hierarchy
- Maintain the existing warm, accessible design language while updating the brand identity

## User Stories

### US-001: Move logo and favicon to public directory
**Description:** As a developer, I need the logo and favicon in the correct location so they can be served by Next.js.

**Acceptance Criteria:**
- [ ] Move `ExplAIin_Logo.png` to `public/logo.png`
- [ ] Move `ExplAIin_Favicon.png` to `public/favicon.png`
- [ ] Generate `favicon.ico` from the PNG for broader browser support
- [ ] Typecheck passes

### US-002: Update site metadata and favicon
**Description:** As a visitor, I want to see the explAI.in branding in the browser tab and when sharing the site.

**Acceptance Criteria:**
- [ ] Update `app/layout.tsx` metadata: title to "explAI.in", description updated
- [ ] Add favicon link in layout using the new favicon
- [ ] Update Open Graph metadata (og:title, og:description, og:image)
- [ ] Browser tab shows "explAI.in" and new favicon
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Update Header component with new logo
**Description:** As a visitor, I want to see the explAI.in logo in the site header.

**Acceptance Criteria:**
- [ ] Replace text "AI Digest" with the explAI.in logo image
- [ ] Logo is responsive (appropriate size on mobile and desktop)
- [ ] Logo links to homepage
- [ ] Alt text is "explAI.in"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Update Footer component branding
**Description:** As a visitor, I want to see consistent explAI.in branding in the footer.

**Acceptance Criteria:**
- [ ] Update any "AI Digest" text references to "explAI.in"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Increase source card size and fonts
**Description:** As a visitor, I want to easily read and select sources without straining.

**Acceptance Criteria:**
- [ ] Increase source card padding from `p-4` to `p-5` or `p-6`
- [ ] Increase source name font size from default to `text-lg`
- [ ] Increase description font size from `text-sm` to `text-base`
- [ ] Increase metadata (audience/reach) font size from `text-xs` to `text-sm`
- [ ] Checkbox size increased proportionally
- [ ] Cards remain responsive on mobile
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Update landing page section headers
**Description:** As a visitor, I want clear, readable section headers on the landing page.

**Acceptance Criteria:**
- [ ] Increase section header font size from `text-lg` to `text-xl`
- [ ] Consistent spacing between sections
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Update VerificationEmail branding
**Description:** As a new subscriber, I want the verification email to reflect explAI.in branding.

**Acceptance Criteria:**
- [ ] Replace "AI Digest" text with "explAI.in" in heading
- [ ] Add explAI.in logo image at top of email (hosted URL or inline)
- [ ] Update preview text to mention "explAI.in"
- [ ] Update footer text to mention "explAI.in"
- [ ] Typecheck passes

### US-008: Update DigestEmail header with logo
**Description:** As a subscriber, I want the digest email to show the explAI.in logo and branding.

**Acceptance Criteria:**
- [ ] Replace text "AI Digest" with explAI.in logo image in header
- [ ] Update preview text from "Your AI Digest" to "Your explAI.in Digest"
- [ ] Update footer text from "AI Digest" to "explAI.in"
- [ ] Logo displays correctly in major email clients
- [ ] Typecheck passes

### US-009: Create TL;DR generation function
**Description:** As a developer, I need a function to generate key takeaways from articles using Claude AI.

**Acceptance Criteria:**
- [ ] Create `src/lib/digest/generateTLDR.ts`
- [ ] Function accepts array of articles (headline, summary)
- [ ] Uses Claude API to generate 3-5 concise bullet points
- [ ] Bullet points highlight the most important/actionable insights
- [ ] Returns array of strings (bullet points)
- [ ] Handles API errors gracefully (returns empty array on failure)
- [ ] Typecheck passes

### US-010: Add TL;DR section to DigestEmail
**Description:** As a subscriber, I want a quick summary at the top of my digest so I can scan key insights.

**Acceptance Criteria:**
- [ ] Add `keyTakeaways` prop to DigestEmail component (string array)
- [ ] Display "Key Takeaways" or "TL;DR" section after header, before articles
- [ ] Show 3-5 bullet points with distinct styling (larger font, subtle background)
- [ ] Section only renders if keyTakeaways has items
- [ ] Visually separated from article list with divider
- [ ] Typecheck passes

### US-011: Integrate TL;DR generation into digest sending
**Description:** As a developer, I need the digest job to generate TL;DR before sending emails.

**Acceptance Criteria:**
- [ ] Update `sendDigest` function to call `generateTLDR` with articles
- [ ] Pass generated takeaways to DigestEmail component
- [ ] TL;DR generation failure does not block email sending (graceful degradation)
- [ ] Typecheck passes

### US-012: Update success/confirmation pages branding
**Description:** As a user completing an action, I want consistent branding on success pages.

**Acceptance Criteria:**
- [ ] Update `/verify-success` page to mention "explAI.in"
- [ ] Update `/unsubscribed` page to mention "explAI.in"
- [ ] Update any "AI Digest" text in the preferences page
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Logo image must be served from `/logo.png` at appropriate resolution for web display
- FR-2: Favicon must be present as both `.ico` and `.png` formats
- FR-3: All instances of "AI Digest" text must be replaced with "explAI.in"
- FR-4: Source cards must have minimum 16px font for primary text (name)
- FR-5: Source card descriptions must have minimum 14px font
- FR-6: TL;DR generation must use Claude API with a focused prompt for concise insights
- FR-7: TL;DR must be limited to 3-5 bullet points, each under 100 characters
- FR-8: Email logo must be hosted at a public URL (NEXT_PUBLIC_APP_URL/logo.png) for email client compatibility
- FR-9: TL;DR generation should timeout after 30 seconds to prevent blocking digest sends

## Non-Goals

- No changes to the color scheme or design system
- No redesign of the source card layout structure (just sizing)
- No changes to the subscription flow logic
- No A/B testing of TL;DR formats
- No user preference for TL;DR on/off (always included when available)

## Design Considerations

- Logo should maintain aspect ratio and not exceed header height
- For emails, logo should be max 200px wide for mobile compatibility
- TL;DR section should use a subtle background color (e.g., cream/lavender tint) to stand out
- Bullet points in TL;DR should use a custom bullet style (e.g., lavender bullet or icon)
- Source cards should have subtle hover elevation increase for better affordance

## Technical Considerations

- Email images must use absolute URLs (not relative paths)
- Logo in emails should have fallback alt text for email clients that block images
- TL;DR generation adds ~2-5 seconds to digest send time per user
- Consider caching TL;DR for same article set if sending to multiple users in batch
- Claude API call should use `claude-3-haiku` for cost efficiency on simple summarization

## Success Metrics

- All "AI Digest" references replaced with "explAI.in"
- Source card text is easily readable without zooming on mobile (16px+ font)
- TL;DR appears in 95%+ of digest emails (graceful degradation on API failures)
- Email renders correctly in Gmail, Apple Mail, and Outlook (test via email preview tools)

## Open Questions

- Should the TL;DR bullet points link to the specific articles they reference?
- Should we add the logo to transactional emails (verification, etc.) as an inline base64 image for better deliverability?
- What is the exact hex color for the TL;DR section background?
