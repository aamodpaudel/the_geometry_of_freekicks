"""Recover the ball path from the Ronaldo clip (static high camera behind the kicker).

1. Extract 60 frames (1/30 s apart) starting just before the kick.
2. Median of the frames = empty background. Max of (frame - background) = every moving bright thing.
3. The ball is the small white blob. Players also move, so I read rough positions off the stacked
   image inside a narrow corridor and then refine each one to the centroid of nearby white pixels.
Output: media/ronaldo_points.json, media/ronaldo_trail.jpg, media/ronaldo_still.jpg

Run: ffmpeg -ss 1.2 -to 3.2 -i media/ronaldo_back.mp4 frames/f%03d.png  then  python track_ronaldo.py frames
"""
import glob, json, sys
import cv2
import numpy as np

frames = sorted(glob.glob(f"{sys.argv[1]}/*.png"))
ims = [cv2.imread(f) for f in frames]
med = np.median(np.stack(ims[::3]), axis=0)
acc = np.zeros_like(ims[0], dtype=np.float32)
for im in ims:
    acc = np.maximum(acc, np.clip(im.astype(np.float32) - med, 0, 255))
stack = np.clip(med + acc * 1.5, 0, 255)

# rough positions read off the stacked image (full-frame pixels), kick to top corner
rough = [(812, 447), (816, 426), (818, 396), (821, 374), (827, 252), (825, 234), (822, 218), (820, 202),
         (818, 188), (815, 175), (811, 163), (807, 153), (802, 142), (797, 132), (790, 123), (782, 114),
         (770, 106), (758, 102), (744, 100)]
white = stack.min(axis=2)
pts = []
for x, y in rough:
    r = 6
    win = np.clip(white[y - r:y + r + 1, x - r:x + r + 1] - 150, 0, None)
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    pts.append((x + (win * xx).sum() / win.sum(), y + (win * yy).sum() / win.sum()) if win.sum() else (x, y))

X0, Y0, X1, Y1 = 560, 40, 1100, 500
out = ims[0].copy()
mask = np.zeros(out.shape[:2], np.uint8)
for x, y in pts:
    cv2.circle(mask, (int(round(x)), int(round(y))), 6, 255, -1)
out[mask > 0] = stack.astype(np.uint8)[mask > 0]
cv2.imwrite("media/ronaldo_trail.jpg", out[Y0:Y1, X0:X1], [cv2.IMWRITE_JPEG_QUALITY, 90])
cv2.imwrite("media/ronaldo_still.jpg", ims[0][Y0:Y1, X0:X1], [cv2.IMWRITE_JPEG_QUALITY, 90])
json.dump({"crop": [X0, Y0, X1, Y1], "w": X1 - X0, "h": Y1 - Y0,
           "points": [[round(x - X0, 1), round(y - Y0, 1)] for x, y in pts]},
          open("media/ronaldo_points.json", "w"))
print(len(pts), "points")
