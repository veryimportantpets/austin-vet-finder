# Website Launch Review Process

A comprehensive checklist for new site launches. Designed to catch issues early, ensure SEO fundamentals are solid, and set clients up for success.

> **Salesforce Integration**: Each section below maps to a task group. Individual checklist items can be created as subtasks with clear pass/fail status.

---

## How to Use This Checklist

1. **Create tasks in Salesforce** at project kickoff (Onboarding phase items)
2. **Work through Pre-Launch items** before the site goes live
3. **Complete Post-Launch QA** within 7-14 days of launch
4. **Document any issues** in the task notes for future reference

---

## Phase 1: Onboarding (Client Intake)

Complete these items when the client comes onboard—before any build work begins.

### SEO & Location Targeting

| Task | Details | Status |
|------|---------|--------|
| Collect target locations | Which cities/areas does the client want to rank for? Document primary and secondary markets. | ☐ |
| Collect priority keywords | What terms matter most to them? Get 5-10 examples if possible. | ☐ |
| Document in Salesforce | Add to the "SEO Keywords / Target Locations" field in the onboarding project. | ☐ |
| Share keyword examples | Provide client with examples of high-volume keywords we're already tracking (helps them understand what we mean). | ☐ |

### Google Business Profile (GMB)

| Task | Details | Status |
|------|---------|--------|
| Check if GMB exists | Does the client already have a Google Business Profile? | ☐ |
| Discuss GMB setup | If no GMB exists, explain why it's critical for local SEO and Maps visibility. | ☐ |
| Determine ownership | Will the client set it up, or are we handling it? (Note: Setup service is $300-500 if we do it.) | ☐ |
| Offer Reviews service | Since GMB access is required anyway, this is the natural time to pitch our reviews service. Document their decision. | ☐ |
| Set expectations | Even if they decline reviews service, reinforce why reviews matter for ranking (AEO impact). | ☐ |

---

## Phase 2: Pre-Launch QA

Complete these items before the site goes live.

### Content & Metadata

| Task | Details | Status |
|------|---------|--------|
| Verify H1 on every page | Each page should have exactly ONE H1 that clearly states the page purpose. | ☐ |
| H1 includes location | Where applicable, H1 should include location markers (city, region). | ☐ |
| Check header hierarchy | H1 → H2 → H3 → H4 used for structure only, NOT styling. No skipped levels. | ☐ |
| Review meta titles | Every page has a unique, descriptive title (50-60 chars). | ☐ |
| Meta titles include location | Confirm location is correct (AI-generated content often gets this wrong). | ☐ |
| Review meta descriptions | Every page has a unique description (150-160 chars). | ☐ |
| Meta descriptions accuracy | Double-check hospital name, location, and services are correct. | ☐ |
| No duplicate metadata | Run a crawl or manual check to ensure no duplicate titles/descriptions. | ☐ |

### Technical SEO

| Task | Details | Status |
|------|---------|--------|
| Sitemap exists | Confirm sitemap.xml is generated and accessible at `/sitemap.xml`. | ☐ |
| Sitemap is valid | Run through a validator—no errors, all intended URLs included. | ☐ |
| Robots.txt configured | Confirm robots.txt allows indexing of important pages and references sitemap. | ☐ |
| No accidental noindex | Check that production pages don't have leftover `noindex` tags from staging. | ☐ |
| Canonical tags set | Important pages have self-referencing canonical tags. | ☐ |
| Mobile responsive | Test on multiple device sizes. | ☐ |
| Page speed acceptable | Run Lighthouse or PageSpeed Insights. Address critical issues. | ☐ |

### Accessibility & Structure

| Task | Details | Status |
|------|---------|--------|
| Alt text on images | All images have descriptive alt text. | ☐ |
| Links are descriptive | No "click here" links—use meaningful anchor text. | ☐ |
| Forms are labeled | Form fields have proper labels for screen readers. | ☐ |

---

## Phase 3: Launch Day

| Task | Details | Status |
|------|---------|--------|
| DNS propagated | Site resolves correctly on the new domain. | ☐ |
| SSL active | HTTPS working, no mixed content warnings. | ☐ |
| Redirects in place | Old URLs (if applicable) redirect to new equivalents. | ☐ |
| Analytics installed | Google Analytics / tracking pixel firing correctly. | ☐ |

---

## Phase 4: Post-Launch QA (Days 1-14)

These items should be checked after launch to catch indexing issues early.

### Google Search Console Setup

| Task | Details | Timing | Status |
|------|---------|--------|--------|
| GSC property created | Set up Google Search Console for the new domain. | Day 1 | ☐ |
| Ownership verified | Complete verification (DNS, HTML tag, or file method). | Day 1 | ☐ |
| Clear old sitemaps | Remove any outdated or incorrect sitemap references. | Day 1 | ☐ |
| Submit new sitemap | Add sitemap URL: `https://[domain]/sitemap.xml` | Day 1 | ☐ |
| Request indexing | Use "Inspect URL" to request indexing for key pages (homepage, services, contact). | Day 1-2 | ☐ |

### Indexing Verification

| Task | Details | Timing | Status |
|------|---------|--------|--------|
| Check sitemap status | In GSC, confirm sitemap was "Successfully processed" (not "Couldn't fetch" or errors). | Day 3-5 | ☐ |
| Spot-check indexed pages | Search `site:domain.com` in Google. Are key pages appearing? | Day 7 | ☐ |
| Review Coverage report | In GSC, check for excluded pages, errors, or "Discovered - currently not indexed" issues. | Day 7-14 | ☐ |
| Address indexing issues | If pages aren't indexing, investigate and fix (this is the issue we've seen with new domains). | Day 7-14 | ☐ |
| Document any SEOPress issues | If sitemap/indexing problems occur, note details for pattern tracking. | As needed | ☐ |

### GMB Follow-Up (If Applicable)

| Task | Details | Timing | Status |
|------|---------|--------|--------|
| GMB profile live | If we set it up, confirm profile is published and accurate. | Day 1-3 | ☐ |
| GMB linked to website | Website URL in GMB points to the correct page. | Day 1-3 | ☐ |
| Client has access | Client can log in and manage their profile. | Day 3-5 | ☐ |
| Reviews service started | If they opted in, kick off reviews onboarding. | Day 7+ | ☐ |

---

## Common Issues & Fixes

Quick reference for problems we've seen before.

### Sitemap Not Indexing

**Symptoms**: GSC shows sitemap errors, pages not appearing in search, "Discovered - currently not indexed" in Coverage report.

**Possible causes**:
- SEOPress configuration issue (we've seen this with new domains)
- Sitemap URL incorrect or returning 404
- Robots.txt blocking sitemap
- Domain too new (Google is slow to trust)

**Fixes**:
1. Manually verify sitemap URL loads in browser
2. Re-submit in GSC after clearing old entries
3. Request indexing for key pages individually
4. For brand-new domains, be patient but monitor weekly

### Wrong Location in Metadata

**Symptoms**: Meta titles/descriptions show wrong city or hospital name.

**Cause**: AI-generated content pulling incorrect location data.

**Fix**: Always manually review AI-generated metadata before launch. Add this to content writer's checklist.

### Header Structure Issues

**Symptoms**: Multiple H1s on a page, H2 used for styling, skipped heading levels.

**What correct structure looks like**:
```
H1: Main Page Title (one per page)
  H2: First Major Section
    H3: Subsection
    H3: Subsection
  H2: Second Major Section
    H3: Subsection
```

**Fix**: Use CSS classes for visual styling, not heading tags. Every page needs exactly one H1.

---

## Salesforce Task Template

When creating this in Salesforce, suggested structure:

```
Project: [Client Name] - Website Launch

Task Groups:
├── Onboarding Intake
│   ├── Collect target locations
│   ├── Collect priority keywords
│   ├── GMB discussion
│   └── Reviews service pitch
│
├── Pre-Launch QA
│   ├── Content & Metadata Review
│   ├── Technical SEO Check
│   └── Accessibility Review
│
├── Launch Day
│   ├── DNS/SSL verification
│   └── Analytics confirmation
│
└── Post-Launch QA
    ├── GSC Setup (Day 1)
    ├── Indexing Check (Day 7)
    └── Indexing Verification (Day 14)
```

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-01-05 | Initial version created based on Iris Vet Care learnings | Team |

---

## Feedback & Improvements

This is a living document. If you encounter issues not covered here or have suggestions to make this more useful, please update this doc or flag in Slack.

**Questions this doc should answer**:
- What do I need to check before launching a site?
- How do I verify a site is indexing correctly?
- What's the GMB conversation with clients?
- How do I structure headers correctly?

If it doesn't answer your question clearly, that's a gap we should fix.
