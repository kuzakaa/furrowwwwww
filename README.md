# Furrow

Try it: https://kuzakaa.github.io/furrow/

Made by Valerii and Veta for the 2026 NASA Space Apps Challenge.

## In short

Farmers picking a crop rotation are betting on weather they can't see coming. With Furrow you tap your field on a satellite map, say what you grow and what you care about, and we replay your rotation through 25 years of NASA weather data for that exact spot. You see when your soil sits bare while heavy rain hits it, how often your crops ran short of water, and how a few other rotations would have done in the same years. Every suggestion comes with its evidence, what we can't know, and what to double-check locally. It's there to help a farmer think, not to tell them what to do.

## What it does

1. **Pick a field.** Drag the map and tap a spot, or try one of our examples (Odesa region, Minsk region, central Iowa, South Africa's Free State, Heilongjiang in northeast China).
2. **Answer four quick questions.** What you grow now, what your soil is like, what matters most to you (five sliders), and any crops you can't grow or sell.
3. **Get a result.** Your rotation next to up to three alternatives built from it: cover crops in the gaps, an extra small-grain year, a drought-hardy swap, a legume year, a crop instead of fallow, or a forage phase.
4. **Dig into the evidence.** Weather trends, a calendar of what's on the field against when the rain falls, how each rotation handles hot and dry years, soil moisture history, and the terrain around the point. Every chart is tappable.
5. **Stress-test it.** Two sliders replay the whole record wetter, drier or hotter.
6. **Take it with you.** Print a one-page summary or copy a link that opens the exact same result, so you can show it to an agronomist.

## How it works

- Downloads daily temperature, rain, soil wetness, sunlight, wind and humidity for the point from NASA POWER, 2001 to 2025.
- Works out frost dates, heat days, heavy-rain days, dry spells and evaporative demand (FAO Penman-Monteith), and checks each for a trend (Theil-Sen slope, Mann-Kendall test).
- Builds crop calendars from the site's own temperatures using growing degree days, so sowing and harvest dates move with the climate.
- Lays each rotation out day by day (cash crop, cover crop, residue, bare soil) and replays it through all 25 years with a daily soil-water balance.
- Scores every rotation from 0 to 100 on five things: saving water, soil health, protecting soil from storms, how easy the crops are to sell, and handling bad weather. Your slider weights decide the ranking.
- Groups the 25 seasons into hot-dry, typical and cool-wet years two ways (k-means clustering and a simple thirds rule) and says how far the two agree.
- Reshuffles the 25 years 300 times to see how often each alternative still beats your current rotation.
- Compares its own crop calendar with two years of MODIS satellite greenness for a 250 m square at the point.
- Reads a 90 m elevation model around the point to flag steep ground and frost-prone hollows, and suggests a soil texture from SoilGrids.

## Data we use

| Source | What for |
| --- | --- |
| NASA POWER daily agroclimatology (T2M_MAX, T2M_MIN, PRECTOTCORR, GWETROOT, ALLSKY_SFC_SW_DWN, WS2M, RH2M) | Weather indicators, crop calendars, water balance, soil wetness history. The sunlight values come from NASA's CERES instruments. |
| MODIS MOD13Q1 NDVI, through the ORNL DAAC subset service | Field-scale greenness check against the modelled calendar |
| NASA GIBS: MODIS NDVI, SMAP root-zone soil moisture, GPM IMERG rainfall | Map layers |
| Copernicus 90 m elevation model (ESA), through Open-Meteo | Slope and low spots around the point |
| SoilGrids (ISRIC) | Soil texture suggestion |
| Esri World Imagery | Satellite base map |
| FAO Irrigation and Drainage Paper 56 | Crop coefficients and the evapotranspiration method |

## What it can't do

- NASA POWER describes an area about 50 km wide, so it's your district's weather, not exactly your field's.
- Soil health and easy-to-sell are rough scores, not measurements or price forecasts.
- Storm exposure uses daily rain totals, not real storm intensity.
- Crop numbers are generic textbook values, not local varieties. The app lists every value it uses.
- Pests, diseases, weeds, equipment and labour aren't modelled.
- Crop timing relies on frost dates, so results in the tropics are rough.
- Nobody has checked the model against field trials or with an agronomist yet.

## What we tested

- Extraterrestrial radiation against FAO-56 Example 8, and Penman-Monteith evapotranspiration against FAO-56 Example 18. Both are in `test/test.js`.
- Software checks on made-up climates for five kinds of region, including the southern hemisphere and a frost-free site. Run them with `node test/test.js`.
- Crop dates against USDA's Usual Planting and Harvesting Dates handbook: after tuning three crop settings, Furrow's sowing and harvest dates for Iowa corn, Iowa soybean and Kansas winter wheat all fall inside USDA's "most active" windows. The table is in the app under How it works.
- The live site with real NASA data for the Odesa example.

## Running it

It's one file. Open `index.html` in a browser with an internet connection, or host the folder anywhere static. `src/` holds the parts and `python3 build.py` joins them into `index.html`.

NASA does not endorse this tool.
