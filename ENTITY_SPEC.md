# L Cafe Entity Specification

Status: **Canonical identity locked; coordinate-dependent fields pending verification.**
Last verified: 2026-08-29

## Canonical entity

- Type: `CafeOrCoffeeShop`
- Persistent ID: `https://l-cafe.ir/#business`
- Name: `ال کافه`
- Alternate name: `L Cafe`
- Canonical URL: `https://l-cafe.ir/`
- Telephone: `+989130005767`
- Canonical visible phone form: `09130005767`
- Address: `خیابان چهارباغ بالا، نبش کوچه یحیی خان، مجتمع متروپل، اصفهان`
- Country: `IR`
- Hours: daily `07:00–23:00`
- Menu: `https://l-cafe.ir/menu`
- Maps identity: Google place ID `ChIJHwiIQwA3vD8RouGWwXbq5GI`, public name `LCafe - ال کافه`
- Instagram: `https://www.instagram.com/lcafe.esf/`

The owner confirmed this Metropol / Chahar Bagh-e Bala listing as the canonical business and explicitly rejected the similarly named Esfahanak listing.

## Schema contract

Use the stable business ID on the homepage and reference/reuse the same entity from future relevant pages.

Candidate properties allowed **only when verified and visible where appropriate**:

```text
@context
@type = CafeOrCoffeeShop
@id = https://l-cafe.ir/#business
name
alternateName
url
telephone
address
openingHoursSpecification
image
hasMenu / menu
hasMap
sameAs
geo              # only after coordinates are verified
```

### Opening hours model

Preferred truthful structure:

```text
openingHoursSpecification:
  dayOfWeek: Monday ... Sunday
  opens: 07:00
  closes: 23:00
```

Do not publish holiday/special hours unless an authoritative operating source supplies them.

## NAP normalization

Canonical first-party representation:

- Name: `ال کافه` (`L Cafe` as alternate English name)
- Address: `اصفهان، خیابان چهارباغ بالا، نبش کوچه یحیی خان، مجتمع متروپل`
- Phone: `09130005767` (`+989130005767` machine-readable)

Platform-specific formatting differences are acceptable when they resolve to the same verified place; contradictory street/building/phone facts are not.

## Public observation baseline

Fresh Maps capture on 2026-08-29:

- rating: `5.0`
- review count: `3`

These are mutable observations, not permanent entity properties. Recapture before Day 30/60/90 reports and do not embed rating/review schema unless policy, source authority and visible-content requirements are independently satisfied.

## Current schema delta

Current homepage already includes a truthful `CafeOrCoffeeShop` object with name, alternateName, URL, image, telephone, hours, address, map, menu and Instagram.

Required next changes after roadmap/release gate:

1. add the stable `@id`;
2. replace/augment compact opening-hours string with explicit `openingHoursSpecification`;
3. reuse the same entity ID from `/location` and other relevant pages;
4. add `geo` only after authoritative coordinates are captured;
5. never add unverified facilities, price ranges, cuisine, service modes, awards, aggregate ratings or other attributes.
