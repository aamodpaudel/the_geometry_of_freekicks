"""Turn StatsBomb free kicks into geometric features and fit a logistic regression.

Features are pure geometry:
  d      distance from the ball to the centre of the goal (m)
  theta  angle the goal mouth subtends at the ball (degrees)
Output: data/freekicks.json (used by the website)
"""
import json, math, os
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_predict, StratifiedKFold
from sklearn.metrics import roc_auc_score, brier_score_loss

HERE = os.path.dirname(__file__)
YD = 0.9144
raw = json.load(open(os.path.join(HERE, "freekicks_raw.json")))

def geom(x_lat, z):
    a = (-3.66 - x_lat, -z); b = (3.66 - x_lat, -z)
    ang = math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])
    return math.hypot(x_lat, z), abs(math.degrees(ang))

rows = []
for s in raw:
    x, y = s["loc"][:2]
    z = (120 - x) * YD
    xl = (y - 40) * YD
    d, th = geom(xl, z)
    end = s.get("end") or []
    ey = (end[1] - 40) * YD if len(end) > 1 else None
    ez = end[2] * YD if len(end) > 2 else None
    rows.append(dict(x=round(xl, 2), z=round(z, 2), d=round(d, 2), th=round(th, 2),
                     goal=int(s["outcome"] == "Goal"), messi=int("Messi" in s["player"]),
                     out=s["outcome"], ey=None if ey is None else round(ey, 2),
                     ez=None if ez is None else round(ez, 2), season=s["season"],
                     date=s["date"], opp=s["away"] if s["team"] == s["home"] else s["home"],
                     player=s["player"], xg=s["xg"], freeze=[[round((f["loc"][1]-40)*YD,2), round((120-f["loc"][0])*YD,2), int(f["teammate"]), int(f["pos"]=="Goalkeeper")] for f in s["freeze"]]))

X = np.array([[r["th"], r["d"]] for r in rows]); y = np.array([r["goal"] for r in rows])
cv = StratifiedKFold(5, shuffle=True, random_state=0)
res = {}
for name, cols in {"distance only": [1], "angle only": [0], "angle + distance": [0, 1]}.items():
    m = LogisticRegression()
    p = cross_val_predict(m, X[:, cols], y, cv=cv, method="predict_proba")[:, 1]
    res[name] = dict(auc=round(roc_auc_score(y, p), 3), brier=round(brier_score_loss(y, p), 4))
m = LogisticRegression().fit(X, y)
coef = dict(b0=float(m.intercept_[0]), b_theta=float(m.coef_[0][0]), b_d=float(m.coef_[0][1]))
messi = [r for r in rows if r["messi"]]
summary = dict(n=len(rows), goals=int(y.sum()), messi_n=len(messi), messi_goals=sum(r["goal"] for r in messi),
               messi_expected=round(float(sum(1 / (1 + math.exp(-(coef["b0"] + coef["b_theta"] * r["th"] + coef["b_d"] * r["d"]))) for r in messi)), 1),
               others_rate=round(float(y[[not r["messi"] for r in rows]].mean()), 4),
               cv=res, coef=coef,
               seasons=sorted({r["season"] for r in rows}))
os.makedirs(os.path.join(HERE, "..", "data"), exist_ok=True)
json.dump(dict(summary=summary, shots=rows), open(os.path.join(HERE, "..", "data", "freekicks.json"), "w"), separators=(",", ":"))
print(json.dumps(summary, indent=1))
