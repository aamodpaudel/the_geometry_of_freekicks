# The Geometry of Soccer Free Kicks

By **Aamod Paudel**. Live site: https://aamodpaudel.github.io/the_geometry_of_freekicks/

Geometry in the World midterm project. Two versions of the same story, switchable from the top-right tabs:

- `index.html`: **Simple version** (default), plain language for high school and first-year readers, with a glossary.
- `advanced.html`: **Advanced version** with the full equations, model statistics and physics.

The story:

1. **Notice + Name**: three famous free kicks (Messi 2019, Ronaldo 2018, Roberto Carlos 1997) and a ball path tracked out of real footage.
2. **Explain**: the inscribed angle theorem (goal angle), similar triangles (the wall's shadow), the parabola and its feasible window, the Magnus force (circles and the sagitta), drag and the spiral, plus a logistic-regression model fitted to every Messi La Liga free kick (StatsBomb open data).
3. **Create**: a 3D free-kick lab (Three.js) and a generative poster, *The Shape of Possible*.

## Run locally

Any static server works, for example:

```
python -m http.server 8000
```

then open http://localhost:8000.

## Deploy on GitHub Pages

1. Push this folder to a GitHub repository (the full source clips in `clips/` are ignored).
2. Repository **Settings → Pages → Build and deployment → Deploy from a branch**, pick `main` and `/ (root)`.
3. The site appears at `https://<username>.github.io/<repo>/` after a minute.

## Rebuild the data

```
python data_prep/fetch_statsbomb.py   # downloads ~870 match files, keeps direct free kicks
python data_prep/build_model.py       # geometric features + logistic regression -> data/freekicks.json
```

## Structure

- `index.html`, `css/style.css`: page and styles
- `js/physics.js`: flight model (gravity, drag, Magnus, knuckle wobble), wall and keeper
- `js/geometry.js`: interactive figures for 2.1 to 2.4
- `js/spiral.js`: the Carlos spiral and the knuckleball fan
- `js/data.js`: Messi charts and the model heat map
- `js/lab.js`: the 3D lab
- `js/art.js`: the generative poster
- `media/`: short clip excerpts, stills and the tracked Ronaldo points
- `data_prep/`: Python scripts for the data, the model and the video tracking

Credits: StatsBomb Open Data; Dupeux, Le Goff, Quéré and Clanet (2010), *The spinning ball spiral*; broadcast footage excerpts used for non-commercial educational commentary.
