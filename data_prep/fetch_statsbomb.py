"""Download StatsBomb open data for La Liga (Messi era) and keep only direct free-kick shots.

Output: data_prep/freekicks_raw.json
Data: StatsBomb Open Data, https://github.com/statsbomb/open-data
"""
import json, os, sys, concurrent.futures as cf
import requests

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
OUT = os.path.join(os.path.dirname(__file__), "freekicks_raw.json")
s = requests.Session()

def get(path):
    for _ in range(4):
        try:
            r = s.get(f"{BASE}/{path}", timeout=60)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            err = e
    raise err

comps = [c for c in get("competitions.json") if c["competition_name"] == "La Liga"]
matches = []
for c in comps:
    for m in get(f"matches/{c['competition_id']}/{c['season_id']}.json"):
        m["_season"] = c["season_name"]
        matches.append(m)
print("matches", len(matches), flush=True)

def shots(m):
    ev = get(f"events/{m['match_id']}.json")
    out = []
    for e in ev:
        if e["type"]["name"] != "Shot" or e["shot"]["type"]["name"] != "Free Kick":
            continue
        sh = e["shot"]
        out.append({
            "match_id": m["match_id"], "season": m["_season"], "date": m["match_date"],
            "home": m["home_team"]["home_team_name"], "away": m["away_team"]["away_team_name"],
            "team": e["team"]["name"], "player": e["player"]["name"],
            "minute": e["minute"], "loc": e["location"], "end": sh.get("end_location"),
            "outcome": sh["outcome"]["name"], "technique": sh.get("technique", {}).get("name"),
            "body": sh.get("body_part", {}).get("name"), "xg": sh.get("statsbomb_xg"),
            "freeze": [{"loc": f["location"], "teammate": f["teammate"], "pos": f["position"]["name"]}
                       for f in sh.get("freeze_frame", [])],
        })
    return out

allshots, done = [], 0
with cf.ThreadPoolExecutor(16) as ex:
    for res in ex.map(shots, matches):
        allshots += res
        done += 1
        if done % 50 == 0:
            print(done, len(allshots), flush=True)
json.dump(allshots, open(OUT, "w"))
print("saved", len(allshots), "free kicks", flush=True)
