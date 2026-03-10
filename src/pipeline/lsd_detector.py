"""
Line Segment Detector (LSD) for Document Edge Detection.

Superior to Canny+Hough because LSD finds sub-pixel accurate segments
with automatic false-alarm control (NFA). No parameter tuning needed.
Reference: von Gioi et al., 2012
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional


class LSDDocumentDetector:
    """Detect document boundaries using OpenCV's LSD algorithm."""

    def __init__(self, min_line_length_ratio=0.08):
        self.min_line_length_ratio = min_line_length_ratio
        self.lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)

    def detect(self, image, scale=1.0):
        """Detect document quad using LSD.
        Returns list of (corners, area_ratio, 'lsd') tuples.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape[:2]
        diag = np.sqrt(h * h + w * w)
        min_len = diag * self.min_line_length_ratio

        lines_raw, widths, precs, nfas = self.lsd.detect(gray)
        if lines_raw is None or len(lines_raw) == 0:
            return []
        lines = lines_raw.squeeze(axis=1)  # (N, 4): x1,y1,x2,y2
        lengths = _seg_lengths(lines)
        keep = lengths >= min_len
        lines, lengths = lines[keep], lengths[keep]
        if len(lines) < 4:
            return []

        angles = np.degrees(np.arctan2(
            lines[:, 3] - lines[:, 1], lines[:, 2] - lines[:, 0]
        )) % 180

        h_mask = (angles < 45) | (angles > 135)
        v_mask = ~h_mask
        h_lines, v_lines = lines[h_mask], lines[v_mask]

        if len(h_lines) >= 2 and len(v_lines) >= 2:
            result = self._from_hv(h_lines, v_lines, h, w, scale)
            if result:
                return result

        return self._from_clustering(lines, lengths, h, w, scale)

    def _from_hv(self, h_lines, v_lines, h, w, scale):
        h_midy = (h_lines[:, 1] + h_lines[:, 3]) / 2
        top_pool = h_lines[h_midy < h * 0.5]
        bot_pool = h_lines[h_midy >= h * 0.5]
        if len(top_pool) == 0 or len(bot_pool) == 0:
            return []

        v_midx = (v_lines[:, 0] + v_lines[:, 2]) / 2
        left_pool = v_lines[v_midx < w * 0.5]
        right_pool = v_lines[v_midx >= w * 0.5]
        if len(left_pool) == 0 or len(right_pool) == 0:
            return []

        top = top_pool[np.argmax(_seg_lengths(top_pool))]
        bot = bot_pool[np.argmax(_seg_lengths(bot_pool))]
        left = left_pool[np.argmax(_seg_lengths(left_pool))]
        right = right_pool[np.argmax(_seg_lengths(right_pool))]

        tl = _line_ix(top, left)
        tr = _line_ix(top, right)
        br = _line_ix(bot, right)
        bl = _line_ix(bot, left)
        if any(c is None for c in (tl, tr, br, bl)):
            return []
        corners = np.array([tl, tr, br, bl], dtype=np.float32) / scale
        return _validate(corners, h, w, scale)

    def _from_clustering(self, lines, lengths, h, w, scale):
        if len(lines) < 4:
            return []
        angles = np.degrees(np.arctan2(
            lines[:, 3] - lines[:, 1], lines[:, 2] - lines[:, 0]
        )) % 180
        idx = np.argsort(-lengths)[:min(20, len(lines))]
        top_l, top_a = lines[idx], angles[idx]
        hg = top_l[(top_a < 50) | (top_a > 130)]
        vg = top_l[(top_a >= 50) & (top_a <= 130)]
        if len(hg) < 2 or len(vg) < 2:
            return []

        hmy = (hg[:, 1] + hg[:, 3]) / 2
        vmx = (vg[:, 0] + vg[:, 2]) / 2
        top = hg[np.argmin(hmy)]
        bot = hg[np.argmax(hmy)]
        left = vg[np.argmin(vmx)]
        right = vg[np.argmax(vmx)]

        tl = _line_ix(top, left)
        tr = _line_ix(top, right)
        br = _line_ix(bot, right)
        bl = _line_ix(bot, left)
        if any(c is None for c in (tl, tr, br, bl)):
            return []
        corners = np.array([tl, tr, br, bl], dtype=np.float32) / scale
        return _validate(corners, h, w, scale)


# ---- Helpers --------------------------------------------------------

def _seg_lengths(segs):
    return np.sqrt((segs[:, 2] - segs[:, 0]) ** 2 +
                   (segs[:, 3] - segs[:, 1]) ** 2)


def _line_ix(l1, l2):
    """Intersection of two lines given as (x1,y1,x2,y2)."""
    x1, y1, x2, y2 = l1
    x3, y3, x4, y4 = l2
    d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(d) < 1e-8:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d
    return np.array([x1 + t * (x2 - x1), y1 + t * (y2 - y1)], dtype=np.float32)


def _validate(corners, h, w, scale):
    area = cv2.contourArea(corners)
    img_area = (h / scale) * (w / scale)
    ratio = area / img_area
    if 0.05 < ratio < 0.95:
        return [(corners, ratio, 'lsd')]
    return []


def refine_corners_with_lsd(image, corners, search_radius=40):
    """Refine corner positions using nearby LSD segments.

    For each document edge, find the best-aligned LSD segment and
    recompute corners as intersections of adjacent refined edges.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
    raw, _, _, _ = lsd.detect(gray)
    if raw is None or len(raw) == 0:
        return corners
    segs = raw.squeeze(axis=1)
    refined = corners.copy().astype(np.float32)

    edge_segs = []
    for i in range(4):
        p1, p2 = corners[i], corners[(i + 1) % 4]
        edir = p2 - p1
        elen = np.linalg.norm(edir) + 1e-8
        eunit = edir / elen
        best, best_sc = None, -1
        for s in segs:
            smid = np.array([(s[0] + s[2]) / 2, (s[1] + s[3]) / 2])
            sdir = np.array([s[2] - s[0], s[3] - s[1]])
            slen = np.linalg.norm(sdir) + 1e-8
            sunit = sdir / slen
            dist = abs(np.cross(eunit, smid - p1))
            if dist > search_radius:
                continue
            align = abs(np.dot(eunit, sunit))
            if align < 0.7:
                continue
            sc = slen * align
            if sc > best_sc:
                best_sc = sc
                best = s
        if best is not None:
            edge_segs.append(best)
        else:
            edge_segs.append(np.array([p1[0], p1[1], p2[0], p2[1]]))

    for i in range(4):
        ix = _line_ix(edge_segs[(i - 1) % 4], edge_segs[i])
        if ix is not None and np.linalg.norm(ix - corners[i]) < search_radius:
            refined[i] = ix
    return refined
