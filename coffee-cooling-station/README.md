# Coffee Bean Cooling Station — Fusion 360 Build Guide

A 3-part, 3D-printable cooling/chaff-separation station for home coffee
roasters: a circular plenum base that a standard metal colander drops into,
a directional dome lid, and a graduated-hole diffuser plate. A shop vac
pulls air down through the bean bed, cools the beans fast, and carries chaff
out through the hose to the vac's filter/bag.

Confirmed inputs for this build:
- Shop vac hose: **1.25" (1-1/4") nominal**
- Box shape: **circular**

**Don't want to model this by hand?** [`site/`](./site) has a parametric
generator — enter your colander's diameter and hose size, and it builds all
three parts (with real boolean-cut vac port, seat, slots, and graduated
diffuser holes) and exports printable STL files directly from the browser.
Open [`site/dist/coffee-cooling-station.html`](./site/dist/coffee-cooling-station.html).

Everything else below is parametric — plug in your own colander
measurement and the rest of the model updates.

---

## 0. Airflow concept (read this before modeling)

```
        ambient air in (inlet slot, dome)
              |
              v   swept across bean bed
   ┌─────────────────────────────┐
   │   DOME (Component 2)        │   chaff lofted, entrained in airflow
   │        beans in colander    │
   └──────────┬────────────────┬─┘
              │  colander mesh │
   ┌──────────▼────────────────▼─┐
   │   DIFFUSER (Component 3)     │  graduated holes even out suction
   ├───────────────────────────────┤
   │   BASE BOX plenum (Comp. 1)  │  angled spoke baffles → swirl
   │                          ┌──┐│
   │                          │→ ├┼── vac port (offset, 1.25")
   │                          └──┘│
   └───────────────────────────────┘
                  |
              shop vac hose → shop vac (chaff collects in its filter/bag)
```

Key physics driving the geometry:
- The vac port creates a **local low-pressure zone** on one side of the
  plenum. Left alone, most air (and cooling) would happen right next to the
  port and starve the far side of the colander. The **graduated diffuser**
  (small holes near the port, large holes far from it) equalizes resistance
  so suction is even across the whole colander.
- The **angled spoke baffles** turn straight-line flow toward the port into
  a swirl, so air residence time under the whole bean bed is more even and
  chaff stays entrained instead of dropping out in dead zones.
- The dome's **inlet slot is placed ~180° opposite the vac port**, so
  makeup air sweeps horizontally across the full width of the bean bed
  toward the low-pressure side, lofting chaff into the stream on its way
  down through the beans and mesh into the plenum.
- A pre-filter/cyclone inline before your shop vac is strongly recommended
  — coffee chaff is very light and will clog a shop vac's filter fast. Not
  part of these 3 components, but budget for it.

---

## 1. Fusion 360 setup — User Parameters

Before sketching anything, open **MODIFY → Change Parameters** and add these
(Fusion lets you add new rows at the bottom of that dialog). Driving the
whole model from parameters means that once you measure your colander you
change 2-3 numbers and everything re-solves.

| Parameter | Example value | Notes |
|---|---|---|
| `colander_od` | 254 mm (~10") | Outer diameter of the colander **bowl**, measured with calipers below the rolled rim |
| `colander_lip_od` | 268 mm | Outer diameter across the rolled/beaded rim lip, if your colander has one. If it's a plain flat-rim colander, set equal to `colander_od` |
| `colander_lip_thk` | 6 mm | Thickness of the rolled rim bead — sets how deep the seat needs to be |
| `wall_t` | 3 mm | Minimum per spec |
| `floor_t` | 4 mm | Slightly thicker than wall for rigidity + vac suction load |
| `box_height` | 100 mm | Plenum depth, floor to rim |
| `vac_hose_id` | 31.8 mm (1.25") | Nominal hose ID |
| `vac_port_od` | 31.5 mm | Spigot OD for friction fit — **print a calibration ring first, see §2.3** |
| `vac_port_wall` | 2.5 mm | Port tube wall thickness |
| `vac_port_center_z` | 35 mm | Height of port centerline above floor |
| `vac_port_angle` | 0 deg | Reference angle — the "vac side" of the whole assembly |
| `spoke_count` | 8 | Baffle count in plenum |
| `spoke_sweep_angle` | 20 deg | How far each spoke leans off true-radial, biased toward `vac_port_angle` direction of rotation |
| `diffuser_z` | 55 mm | Height of diffuser plate above floor |
| `dome_rise` | 100 mm | Dome height above the rim |
| `inlet_slot_angle` | 180 deg | = `vac_port_angle + 180` |

Measure your colander first (bowl OD with calipers spanning the widest
straight section below the rim bead, and the rim bead OD separately) and
update `colander_od` / `colander_lip_od` before you sketch.

---

## 2. Component 1 — Base Box (circular plenum)

### 2.1 Body + shell
1. **New Component** → name it `Base_Box`.
2. On the XY plane, sketch a circle of diameter `colander_lip_od + 2*wall_t`
   (this is the box OD). Add a dimension driven by the parameter (type
   `colander_lip_od + 2*wall_t` directly into the dimension field so it
   stays linked).
3. **Extrude** → New Body, distance `box_height`, direction up. This is the
   solid puck you'll hollow out.
4. **Shell**: select the *top face* as the face to remove, set inside
   thickness `wall_t`. This gives you an open-top cylinder with a floor.
   Fusion's Shell command lets you set a different thickness for a
   specific face — select the bottom face in the shell dialog's "by-face
   thickness" table and set it to `floor_t` instead of `wall_t`.

### 2.2 Colander seat (rim step)
1. Sketch on the top face: two concentric circles, ID = `colander_lip_od +
   0.6 mm` (running clearance so the colander drops in without binding) and
   OD = box OD (existing edge).
2. **Extrude Cut**, depth = `colander_lip_thk + 2 mm`, cutting straight
   down from the top face. This creates a stepped counterbore/seat: the
   colander's rolled lip rests on the resulting shoulder and the bowl hangs
   down into the plenum, self-centering.
3. Add a **0.5 mm x 45° chamfer** on the top outer and inner edges of this
   seat for easy hand assembly and to break the sharp printed edge.

### 2.3 Vac port
1. Create a sketch on the outer cylindrical wall using a plane: **Construction → Plane → Tangent to Face at Point**, or simpler — sketch directly on a new **Offset Plane** placed at the box's outer radius, oriented normal to the radius at `vac_port_angle`. (Easiest method in practice: sketch on the XZ or YZ plane, draw the port profile, then use **Circular Pattern**/rotate the sketch plane to `vac_port_angle` around the Z axis, or just build the port pointing along +X and rotate the whole feature/plane afterward.)
2. On that plane, sketch a circle `vac_port_od` centered at height `vac_port_center_z` above the floor, positioned so its centerline is horizontal and radial (pointing straight out from the box axis).
3. **Extrude** that circle *outward* from the wall by ~25 mm, **Join**, to form the external spigot. In the same Extrude operation (or a second one), also extrude the same profile *inward*, **Cut**, through the box wall — this bores the matching hole so the spigot is a through-tube, not a plug.
4. **Shell** the spigot itself if it printed solid: sketch the inner bore circle (`vac_port_od - 2*vac_port_wall`) on the outer end face and **Extrude Cut** back through into the plenum, so air can actually pass through the port.
5. Add 2-3 shallow circumferential **barb ribs** (0.6 mm tall, triangular cross-section, spaced 8 mm apart) around the spigot with a **Rib**/small **Revolve** for extra hose grip if a plain friction fit feels loose.
6. **Print a calibration ring first.** Shop vac hose end IDs/ODs vary
   noticeably by brand (Ridgid vs. generic vs. Craftsman). Print a short
   30 mm test spigot at `vac_port_od`, and two more at ±0.3 mm, before
   committing to the full box. PETG shrinks slightly (~0.2-0.3%) — budget
   for that in your final choice.

### 2.4 Interior spoke baffles (swirl)
1. Sketch on the floor (top face of floor, inside the plenum): draw one
   baffle fin as a thin rectangle running from a small hub circle
   (`~20 mm` diameter, centered on the box axis) out to just inside the
   box wall (leave a ~2 mm air gap at the wall so the fin doesn't need to
   perfectly seal). Fin thickness = `wall_t` (3 mm) for print strength.
2. Rotate this rectangle's sketch line so it's offset `spoke_sweep_angle`
   from a true radial line — i.e., the far end (near the wall) is rotated
   ~20° in the direction that matches the vac port's rotational pull, like
   a fan blade rather than a straight spoke. This is what turns pulled air
   into a swirl instead of a straight shot to the port.
3. **Extrude** that one fin from the floor up to `diffuser_z - 5 mm` (stop
   a few mm below where the diffuser plate will sit, so it doesn't
   interfere with the diffuser's support shoulder).
4. **Circular Pattern** the fin around the box's central axis, count =
   `spoke_count` (8), full 360°.
5. Leave the hub circle open (don't fill it) — center of the swirl should
   stay low-restriction so air still has a path even directly under the
   colander's middle.

### 2.5 Diffuser support shoulder
1. Sketch on the inside wall at height `diffuser_z`: a ring, ID =
   `colander_od - 2 mm`, width 4 mm.
2. **Extrude** as a small internal ledge (**Join**), 3 mm tall, so the
   diffuser plate (Component 3) simply drops in and rests on this shoulder
   — no fasteners needed, just gravity + the colander's weight holding it
   down from above.

### 2.6 Fillets
- Add 2 mm interior fillets at the floor/wall junction and at the base of
  each spoke fin — this is a stress riser in FDM prints and also makes the
  plenum easier to hand-clean of chaff dust.

---

## 3. Component 2 — Dome Cover

### 3.1 Base shell
1. **New Component** → `Dome_Cover`.
2. Sketch on XY plane: circle, diameter = `box OD + 0.4 mm` (skirt ID,
   slip-fits down over the base box's rim OD).
3. **Extrude** a short skirt, 15 mm tall, wall `wall_t`, using **Shell**
   same as before (extrude solid puck first, then shell leaving the bottom
   open).

### 3.2 Dome profile
1. On a vertical sketch plane through the center axis, draw the dome's
   side profile: a shallow-domed arc rising from the top of the 15 mm
   skirt to a height of `dome_rise` at the center — roughly a segment of a
   sphere or a simple 3-point spline, whatever headroom you want for
   stirring/loading beans.
2. **Revolve** that profile 360° around the center axis, **Join** to the
   skirt. **Shell** the resulting dome, thickness `wall_t`, removing the
   bottom face (already open from the skirt).

### 3.3 Directional inlet slot
1. On the dome's outer wall, at `inlet_slot_angle` (180° from the vac
   port), sketch a slot profile roughly 60 mm wide x 15 mm tall, positioned
   low on the skirt (near the base) using the same tangent/offset-plane
   technique as the vac port in §2.3.
2. **Extrude Cut** through the wall.
3. Add an internal **deflector fin**: sketch a small curved fin just
   inside the slot, angled ~30-40° downward and inward (toward the bean
   bed, not straight across the dome interior). **Extrude** it as a thin
   (2 mm) rib, **Join**. This forces incoming ambient air to dive down onto
   the beans instead of skimming over the top of the dome cavity — that's
   what actually stirs/lofts the bean surface and picks up chaff.
4. Round the slot's leading (outer) edge with a small fillet — reduces
   whistling/noise from air being pulled through at speed.

### 3.4 Chaff-lofting vent geometry
1. Near the crown of the dome, sketch a ring of small elongated vent slots
   (e.g., 8 slots, 20 mm x 4 mm, arced tangentially) using **Circular
   Pattern**, biased so they're denser on the vac-port side than the
   inlet-slot side (e.g. only pattern them across a 180° arc centered on
   the vac port angle instead of the full 360°).
2. **Extrude Cut** through the dome wall at the crown.
3. Purpose: as swirling air rises off the bean bed toward the vac-side of
   the dome, these upper vents let a portion of that airflow (and the
   lighter chaff riding in it) escape the direct downward pull briefly and
   recirculate along the dome's inner curvature before ultimately being
   drawn back down through the colander mesh and out the vac port below —
   this extra dwell time in moving air is what separates lofted chaff from
   beans, which are far too heavy to loft at all.
4. These crown vents are optional to tune after your first test run —
   print the dome without them initially, run a batch, and add them if
   chaff isn't clearing well. Because it's a separate component, this is a
   cheap iteration.

### 3.5 Handle
- Add a simple filleted loop or knob at the dome crown (**Sketch → Revolve**
  or a simple extruded loop) sized for a gloved hand — beans coming off a
  roast are still warm and the dome will be too.

---

## 4. Component 3 — Interior Diffuser (graduated perforated plate)

### 4.1 Base plate
1. **New Component** → `Diffuser_Plate`.
2. Sketch a circle, diameter = `colander_od - 2.4 mm` (a hair under the
   support shoulder ID from §2.5 so it drops in with clearance).
3. **Extrude**, thickness 3 mm (meets the 3 mm minimum wall spec — this
   plate also takes the full suction load, don't go thinner).

### 4.2 Graduated hole pattern
The gradient runs by **distance/angle from the vac port**, not from the
plate's own center — that's what actually balances pressure, since the
port (not the plate center) is the low-pressure source.

1. Sketch a single reference line from plate center outward at
   `vac_port_angle` (0°) — this marks "closest to the port."
2. Divide the plate into 6 angular sectors of 60° each, centered on that
   reference line at 0°, 60°, 120°, 180°, 240°, 300°.
3. For each sector, sketch a hex or grid pattern of holes at one fixed
   diameter, using this rough schedule (tune after a test run):

   | Sector center angle (from vac port) | Hole diameter |
   |---|---|
   | 0° (nearest port) | 2.5 mm |
   | 60° / 300° | 3.5 mm |
   | 120° / 240° | 5 mm |
   | 180° (farthest from port) | 7 mm |

4. In each sector's sketch, lay out holes on a triangular/hex grid spaced
   center-to-center at roughly 2.2x hole diameter (keeps open area
   reasonable without weakening the plate too much), then trim the pattern
   to the 60° pie-slice boundary.
5. **Extrude Cut** each sector's sketch through the plate. Use **Circular
   Pattern** within a sector only where the internal hole layout is itself
   repetitive (e.g., pattern one hole around a small arc), otherwise it's
   easiest to just sketch each sector's grid directly since diameters
   differ sector to sector.
6. Keep a solid, unperforated 8 mm rim around the plate's outer edge (no
   holes) — this is what rests on the support shoulder from §2.5 and gives
   it flat bearing surface + rigidity.
7. Add 4-6 small radial ribs (2 mm tall x 2 mm wide) on the underside,
   from the center hub out to the rim, **Extrude Join** — stiffens the
   plate against suction-induced flex/oil-canning without blocking airflow
   (route ribs between hole sectors, not across them).

### 4.3 Center hub
- Leave a small solid disc (~15 mm) at dead center with no holes — it sits
  directly over the open hub of the spoke baffles below and doesn't need
  perforation since that area already has the least restriction.

---

## 5. Recommended print settings (PETG)

| Setting | Base Box | Dome Cover | Diffuser Plate |
|---|---|---|---|
| Nozzle temp | 235-245°C | 235-245°C | 235-245°C |
| Bed temp | 80-85°C | 80-85°C | 80-85°C |
| Layer height | 0.24-0.28 mm | 0.2 mm | 0.2 mm |
| Wall loops | 4 (≈3.2 mm+ at 0.8mm nozzle, or 4x 0.4mm nozzle ≈1.6mm — see note) | 3 | 4 |
| Top/bottom layers | 5 | 4 | 6 (holds vacuum load) |
| Infill | 25% gyroid | 15% gyroid | 30% gyroid (structural plate) |
| Print speed | 40-50 mm/s | 50-60 mm/s | 40 mm/s |
| Cooling fan | 30-50% (PETG likes less cooling than PLA) | 50% | 30% |
| Supports | None if oriented open-top-up | Tree supports under the deflector fin & crown vents | None |
| Build plate adhesion | Brim 5 mm on the vac spigot area (small first-layer contact, prone to lifting) | Brim on skirt edge | none needed |

Notes:
- **Wall thickness spec is 3 mm minimum** — with a 0.4 mm nozzle that's 7-8
  perimeter loops, which is slow. Consider a 0.6-0.8 mm nozzle for the Base
  Box specifically (fewer, thicker loops, faster print, and PETG's layer
  adhesion benefits from a fatter bead here since this part sees the most
  mechanical + thermal stress).
- Orient the Base Box open-side up, printed as-is — no supports needed
  since the vac port spigot, once past the first ~5mm, can print with a
  small internal support fillet or just accept slight sag on the port's
  overhang (it's a 25mm horizontal cylinder — Fusion's **Support Rib**
  under it or slicer tree supports both work fine).
- Print the calibration test ring from §2.3 in the same material/settings
  as the final part — PETG shrinkage varies enough between filament
  brands that a PLA test won't tell you what you need to know.
- PETG stringing is common at these hole densities on the diffuser plate —
  dial in retraction (5-7 mm, 30-45 mm/s) and a small amount of extra
  cooling (30%) just for that part despite the general PETG guidance
  above, or you'll spend a while picking strings out of 100+ small holes.

---

## 6. Assembly

1. **Base Box**: place on a flat, heat-safe surface (this sits directly
   under a batch of beans at 150-200°C+ coming off a roast — see §7).
2. Push the shop vac hose end onto the vac port spigot. If it's loose,
   wrap 1-2 turns of PTFE tape or a strip of gaffer tape around the spigot
   before pushing on; if it's tight, lightly sand the spigot OD.
3. Drop the **Diffuser Plate** in — it should self-center and rest flat on
   the internal shoulder. No fasteners.
4. Set the **colander** into the rim seat — the rolled lip drops into the
   counterbore and self-centers; bowl hangs down just above the diffuser
   plate.
5. Load hot beans into the colander immediately after dropping from the
   roaster.
6. Start the shop vac, **then** set the **Dome Cover** on top, skirt over
   the box rim, inlet slot aligned 180° from the vac hose side. Starting
   the vac before capping the dome avoids a momentary pressure/chaff-puff
   back out the open top.
7. Stir beans by hand periodically (remove dome, stir, replace) until
   cool — the dome isn't required to be airtight or left on continuously,
   it's there to improve chaff capture and cross-flow while it's on.
8. After cooling, lift the dome, lift the colander out (chaff mostly stays
   in the plenum/vac hose side, beans stay in the colander), empty beans,
   and vacuum out the plenum interior with the same vac before the next
   batch — accumulated chaff dust is a fire-fuel concern if left inside a
   part that will later sit near a hot batch again.

---

## 7. Food safety & heat resistance

- **PETG** is food-contact-safe in its raw resin form and has better
  temperature resistance than PLA (glass transition ~80°C vs ~60°C for
  PLA), but **FDM printed parts are never truly food safe** in practice —
  layer lines and infill voids harbor bacteria and can't be sanitized like
  a molded/smooth surface. Treat this as a **chaff/air handling fixture**,
  not a surface beans should sit in for extended contact, and don't run it
  through a dishwasher (both PETG and ASA will warp above their glass
  transition temp in a hot dishwasher cycle, ~65-75°C).
- **ASA over PETG** for this specific application: ASA has notably better
  UV and thermal stability (glass transition ~100°C+) and doesn't get
  tacky under sustained heat the way PETG can. Given beans come off the
  roaster at 200-230°C surface temp and cool over several minutes, ASA is
  the safer choice for the Base Box and Dome specifically, since those are
  the two parts in direct/near proximity to the hottest beans. PETG is
  fine for the Diffuser Plate, which sees cooled/mixed airflow, not direct
  bean contact.
- **Do not** put beans directly against the plastic housing/spoke baffles
  — the colander is the only bean-contact surface, and it's food-safe
  stainless the way it ships. Keep it that way; the printed parts are the
  air-handling housing around it, not a bean-contact surface.
- **Ventilate**: chaff is a fine combustible dust. Don't let it accumulate
  inside the plenum across multiple sessions — vacuum it out each time
  (step 8 above), and never run this setup unattended.
- **ASA fumes** (styrene) during printing are more of a health concern
  than PETG's — print ASA in a ventilated area or enclosure with
  filtration, same as you would ABS.
- If you want a true food-safe bean-contact surface anywhere beyond the
  colander (e.g., you redesign the diffuser to touch beans directly),
  look at PETG/ASA blends specifically certified food-contact, and be
  aware certification applies to the *resin*, not the printed part's
  surface finish/porosity — post-process (light sanding + food-safe
  epoxy or vapor smoothing for ASA) if direct, repeated bean contact on a
  printed surface is unavoidable in your final design.

---

## 8. Suggested iteration order

1. Print the vac port calibration rings (§2.3) first — cheap, fast, and
   the single most likely dimension to need adjusting for your specific
   hose.
2. Print the Base Box, dry-fit your colander in the rim seat before
   printing anything else — colander lip tolerances vary more than you'd
   expect between "identical" store colanders.
3. Print the Diffuser Plate and run one cooling cycle with just Box +
   Diffuser + Colander (no dome) to baseline cooling time and check for
   dead zones (feel for cold spots with your hand under the colander
   while the vac runs).
4. Print the Dome last, once you've confirmed the vac-port-side low
   pressure zone empirically (so you can double check `inlet_slot_angle`
   is really opposite where the draft is strongest before committing the
   print).
