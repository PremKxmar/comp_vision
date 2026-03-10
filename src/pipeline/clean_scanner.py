"""
Clean Document Scanner - Adobe Scan Style (v2 with LSD + GrabCut)

Classical OpenCV techniques that produce professional-quality scans.

Detection methods:
1. Canny edge detection (5 threshold pairs)
2. Adaptive threshold (3 block sizes)
3. White paper detection (LAB + HSV)
4. Morphological gradient
5. LSD (Line Segment Detector) - sub-pixel accurate edges
6. Document boundary (heavy blur suppresses internal content)

Refinement pipeline:
- Hough line corner refinement
- LSD segment corner refinement
- GrabCut foreground segmentation
- Weighted ensemble scoring with image-aware dynamic weights
"""

import cv2
import numpy as np
from typing import Dict, Optional, Tuple, List

from src.pipeline.detector import refine_corners_with_hough
from src.pipeline.lsd_detector import LSDDocumentDetector, refine_corners_with_lsd
from src.pipeline.grabcut_refiner import GrabCutRefiner


class CleanDocumentScanner:
    """
    A clean, Adobe Scan-style document scanner.

    Uses classical computer vision (no ML) for reliable results.
    """

    def __init__(self, output_size: Tuple[int, int] = (1080, 1440)):
        self.output_size = output_size
        self.lsd_detector = LSDDocumentDetector()
        self.grabcut = GrabCutRefiner(iterations=3)

    def scan(
        self,
        image: np.ndarray,
        mode: str = 'color',
        enhance: bool = True
    ) -> Dict:
        original_h, original_w = image.shape[:2]

        corners, confidence = self._detect_document(image)

        if corners is None:
            scan = self._enhance_image(image, mode) if enhance else image.copy()
            return {
                'scan': scan,
                'corners': None,
                'confidence': 0.0,
                'message': 'No document detected'
            }

        scan = self._perspective_transform(image, corners)

        if enhance:
            scan = self._enhance_image(scan, mode)

        return {
            'scan': scan,
            'corners': corners.tolist(),
            'confidence': confidence
        }

    def _detect_document(self, image: np.ndarray) -> Tuple[Optional[np.ndarray], float]:
        """
        Detect document corners using multiple robust methods.

        Improvements over v1:
        - LSD detection for sub-pixel accurate line segments
        - GrabCut refinement for complex backgrounds
        - LSD corner refinement after Hough refinement
        """
        max_dim = 800
        h, w = image.shape[:2]
        scale = max_dim / max(h, w)
        if scale < 1:
            small = cv2.resize(image, None, fx=scale, fy=scale)
        else:
            small = image.copy()
            scale = 1.0

        # --- Compute image statistics for weighted scoring ---
        gray_stats = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        edges_stats = cv2.Canny(gray_stats, 50, 150)
        edge_density = np.sum(edges_stats > 0) / edges_stats.size
        mean_brightness = np.mean(gray_stats) / 255.0

        image_stats = {
            'edge_density': edge_density,
            'mean_brightness': mean_brightness,
        }

        # Collect all candidate quadrilaterals: (corners, area_ratio, method_tag)
        candidates = []

        # Method 1: Canny edge detection (multiple thresholds)
        for low, high in [(20, 80), (30, 100), (50, 150), (75, 200), (100, 250)]:
            result = self._detect_canny(small, scale, low, high)
            if result:
                candidates.extend(result)

        # Method 2: Adaptive threshold
        result = self._detect_adaptive_threshold(small, scale)
        if result:
            candidates.extend(result)

        # Method 3: Color-based (white paper detection)
        result = self._detect_white_paper(small, scale)
        if result:
            candidates.extend(result)

        # Method 4: Morphological gradient
        result = self._detect_morphological(small, scale)
        if result:
            candidates.extend(result)

        # Method 5: Document boundary (heavy blur suppresses internal content)
        result = self._detect_document_boundary(small, scale)
        if result:
            candidates.extend(result)
            print(f"[DEBUG] Boundary detection found {len(result)} candidate(s)")

        # Method 6: LSD (Line Segment Detector) - sub-pixel accurate edges
        try:
            result = self.lsd_detector.detect(small, scale)
            if result:
                candidates.extend(result)
                print(f"[DEBUG] LSD found {len(result)} candidate(s)")
        except Exception as e:
            print(f"[DEBUG] LSD detection failed: {e}")

        if not candidates:
            print("[DEBUG] No candidates found by any method")
            return None, 0.0

        # Score and rank candidates (with image-aware weighting)
        best = self._select_best_candidate(candidates, small.shape, image_stats)

        if best is not None:
            corners, score = best
            print(f"[DEBUG] Best candidate score: {score:.2f}")
            print(f"[DEBUG] Initial corners: {corners.astype(int).tolist()}")

            # --- Hough corner refinement (small adjustments only) ---
            try:
                refined = refine_corners_with_hough(
                    image, corners.astype(np.float32), search_radius=20
                )
                if refined is not None and self._is_valid_quadrilateral(refined):
                    shifts = [np.linalg.norm(refined[i] - corners[i]) for i in range(4)]
                    max_shift = max(shifts)
                    if max_shift < 25:
                        corners = refined
                        print(f"[DEBUG] Corners refined via Hough (max shift={max_shift:.1f}px)")
                    else:
                        print(f"[DEBUG] Hough refinement rejected (shift too large: {max_shift:.1f}px)")
                else:
                    print("[DEBUG] Hough refinement rejected (invalid quad)")
            except Exception as e:
                print(f"[DEBUG] Hough refinement skipped: {e}")

            # --- LSD corner refinement (small adjustments only) ---
            try:
                lsd_refined = refine_corners_with_lsd(
                    image, corners.astype(np.float32), search_radius=20
                )
                if lsd_refined is not None and self._is_valid_quadrilateral(lsd_refined):
                    shifts = [np.linalg.norm(lsd_refined[i] - corners[i]) for i in range(4)]
                    max_shift = max(shifts)
                    if max_shift < 25:
                        corners = lsd_refined
                        print(f"[DEBUG] Corners refined via LSD (max shift={max_shift:.1f}px)")
                    else:
                        print(f"[DEBUG] LSD refinement rejected (shift too large: {max_shift:.1f}px)")
            except Exception as e:
                print(f"[DEBUG] LSD refinement skipped: {e}")

            # Clamp corners to within image bounds
            h_img, w_img = image.shape[:2]
            corners[:, 0] = np.clip(corners[:, 0], 0, w_img - 1)
            corners[:, 1] = np.clip(corners[:, 1], 0, h_img - 1)

            # Shrink quad inward by a small margin to trim boundary artifacts
            centroid = corners.mean(axis=0)
            inset = 0.005  # 0.5% inset
            corners = corners + (centroid - corners) * inset

            print(f"[DEBUG] Final corners: {corners.astype(int).tolist()}")
            return corners, score

        return None, 0.0

    # ==================================================================
    # Detection Methods
    # ==================================================================

    def _detect_canny(self, image: np.ndarray, scale: float, low: int, high: int) -> List:
        """Canny edge detection with specific thresholds."""
        candidates = []
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.bilateralFilter(gray, 11, 17, 17)
        edges = cv2.Canny(blurred, low, high)
        kernel = np.ones((5, 5), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=2)
        edges = cv2.erode(edges, kernel, iterations=1)
        quads = self._find_all_quadrilaterals(edges, image.shape, scale)
        candidates.extend([(c, a, 'canny') for c, a in quads])
        return candidates

    def _detect_adaptive_threshold(self, image: np.ndarray, scale: float) -> List:
        """Adaptive threshold based detection."""
        candidates = []
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        for block_size in [11, 21, 31]:
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                          cv2.THRESH_BINARY, block_size, 2)
            edges = cv2.Canny(thresh, 50, 150)
            kernel = np.ones((3, 3), np.uint8)
            edges = cv2.dilate(edges, kernel, iterations=2)
            quads = self._find_all_quadrilaterals(edges, image.shape, scale)
            candidates.extend([(c, a, 'adaptive') for c, a in quads])
        return candidates

    def _detect_white_paper(self, image: np.ndarray, scale: float) -> List:
        """Color-based detection for white/light paper."""
        candidates = []
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        _, mask = cv2.threshold(l, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        kernel = np.ones((7, 7), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
        quads = self._find_all_quadrilaterals(mask, image.shape, scale)
        candidates.extend([(c, a, 'white_paper') for c, a in quads])

        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        lower = np.array([0, 0, 140])
        upper = np.array([180, 50, 255])
        mask2 = cv2.inRange(hsv, lower, upper)
        mask2 = cv2.morphologyEx(mask2, cv2.MORPH_CLOSE, kernel, iterations=3)
        quads = self._find_all_quadrilaterals(mask2, image.shape, scale)
        candidates.extend([(c, a, 'white_paper') for c, a in quads])
        return candidates

    def _detect_morphological(self, image: np.ndarray, scale: float) -> List:
        """Morphological gradient for edge detection."""
        candidates = []
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        gradient = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)
        _, thresh = cv2.threshold(gradient, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        kernel = np.ones((5, 5), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
        quads = self._find_all_quadrilaterals(thresh, image.shape, scale)
        candidates.extend([(corners, area, 'morphological') for corners, area in quads])
        return candidates

    def _detect_document_boundary(self, image: np.ndarray, scale: float) -> List:
        """Detect document boundary using heavy blurring to suppress internal content."""
        candidates = []
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (31, 31), 10)
        for low, high in [(20, 60), (30, 100), (50, 150)]:
            edges = cv2.Canny(blurred, low, high)
            kernel = np.ones((5, 5), np.uint8)
            edges = cv2.dilate(edges, kernel, iterations=2)
            edges = cv2.erode(edges, kernel, iterations=1)
            quads = self._find_all_quadrilaterals(edges, image.shape, scale)
            candidates.extend([(c, a, 'boundary') for c, a in quads])
        return candidates

    # ==================================================================
    # Geometry Utilities
    # ==================================================================

    def _find_all_quadrilaterals(self, binary: np.ndarray, shape: Tuple, scale: float) -> List:
        """Find all valid quadrilaterals in a binary image."""
        quads = []
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return quads

        contours = sorted(contours, key=cv2.contourArea, reverse=True)

        for contour in contours[:15]:
            area = cv2.contourArea(contour)
            area_ratio = area / (shape[0] * shape[1])
            if area_ratio < 0.05:
                continue

            peri = cv2.arcLength(contour, True)
            for eps in [0.01, 0.02, 0.03, 0.04, 0.05, 0.06]:
                approx = cv2.approxPolyDP(contour, eps * peri, True)
                if len(approx) == 4:
                    corners = approx.reshape(4, 2) / scale
                    if self._is_valid_quadrilateral(corners):
                        ordered = self._order_corners(corners)
                        quads.append((ordered.astype(np.float32), area_ratio))
                        break
        return quads

    def _is_valid_quadrilateral(self, corners: np.ndarray) -> bool:
        """Check if corners form a valid document-like quadrilateral."""
        hull = cv2.convexHull(corners.astype(np.float32))
        if len(hull) != 4:
            return False

        ordered = self._order_corners(corners)
        for i in range(4):
            p1 = ordered[i]
            p2 = ordered[(i + 1) % 4]
            p3 = ordered[(i + 2) % 4]
            v1 = p1 - p2
            v2 = p3 - p2
            cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
            angle = np.degrees(np.arccos(np.clip(cos_angle, -1, 1)))
            if angle < 45 or angle > 135:
                return False
        return True

    # ==================================================================
    # Weighted Ensemble Scoring
    # ==================================================================

    _BASE_METHOD_WEIGHTS = {
        'canny':         1.0,
        'lsd':           1.0,
        'adaptive':      0.95,
        'grabcut':       0.95,
        'white_paper':   0.95,
        'morphological': 0.90,
        'boundary':      1.0,
    }

    def _method_weight(self, method: str, image_stats: dict) -> float:
        """Dynamic reliability multiplier based on image statistics."""
        base = self._BASE_METHOD_WEIGHTS.get(method, 0.90)
        return base

    def _select_best_candidate(
        self,
        candidates: List,
        shape: Tuple,
        image_stats: dict = None,
    ) -> Optional[Tuple]:
        """Score and select the best quadrilateral candidate."""
        if not candidates:
            return None
        if image_stats is None:
            image_stats = {}

        scored = []
        for item in candidates:
            if len(item) == 3:
                corners, area_ratio, method = item
            else:
                corners, area_ratio = item
                method = 'unknown'
            geo_score = self._score_quadrilateral(corners, shape, area_ratio)
            weight = self._method_weight(method, image_stats)
            final_score = geo_score * weight
            scored.append((corners, final_score, method, area_ratio))

        scored.sort(key=lambda x: x[1], reverse=True)
        for i, (c, s, m, ar) in enumerate(scored[:5]):
            print(f"[DEBUG] Top#{i+1}: method={m} score={s:.3f} area={ar:.3f}")
        best_corners, best_score = scored[0][0], scored[0][1]
        if best_score > 0.3:
            return best_corners, best_score
        return None

    def _score_quadrilateral(self, corners: np.ndarray, shape: Tuple, area_ratio: float) -> float:
        """Score a quadrilateral based on geometric criteria."""
        score = 0.0

        # 1. Area score - DOMINANT factor
        if area_ratio >= 0.10:
            score += (area_ratio ** 0.5) * 0.55
        elif area_ratio >= 0.05:
            score += 0.03

        # 2. Coverage bonus
        img_h, img_w = shape[:2]
        xs = corners[:, 0]
        ys = corners[:, 1]
        x_coverage = (xs.max() - xs.min()) / (img_w + 1e-6)
        y_coverage = (ys.max() - ys.min()) / (img_h + 1e-6)
        coverage = (x_coverage * y_coverage) ** 0.5
        score += coverage * 0.15

        # 3. Aspect ratio
        ordered = self._order_corners(corners)
        top_w = np.linalg.norm(ordered[1] - ordered[0])
        bot_w = np.linalg.norm(ordered[2] - ordered[3])
        left_h = np.linalg.norm(ordered[3] - ordered[0])
        right_h = np.linalg.norm(ordered[2] - ordered[1])
        width = np.mean([top_w, bot_w])
        height = np.mean([left_h, right_h])
        aspect = width / (height + 1e-6)
        if 0.5 <= aspect <= 2.0:
            score += 0.10
        elif 0.3 <= aspect <= 3.0:
            score += 0.04

        # 4. Rectangularity
        rect_area = width * height
        actual_area = cv2.contourArea(corners.astype(np.float32))
        rectangularity = actual_area / (rect_area + 1e-6)
        if rectangularity > 0.85:
            score += 0.10
        elif rectangularity > 0.7:
            score += 0.06
        elif rectangularity > 0.5:
            score += 0.02

        # 5. Edge length
        min_dist = min([np.linalg.norm(ordered[i] - ordered[(i+1)%4]) for i in range(4)])
        if min_dist > 50:
            score += 0.10
        elif min_dist > 20:
            score += 0.05

        # Cap the base geometric score
        score = min(score, 1.0)

        # 6. Width-skew penalty - applied AFTER the cap so it can break
        #    ties among candidates that all hit 1.0.
        w_skew = abs(top_w - bot_w) / (max(top_w, bot_w) + 1e-6)
        if w_skew > 0.25:
            score -= w_skew * 0.25

        # 7. Full-image penalty
        if area_ratio > 0.90:
            score -= 0.15

        return score

    def _order_corners(self, corners: np.ndarray) -> np.ndarray:
        """Order corners: TL, TR, BR, BL using Y-sort approach."""
        pts = corners.astype(np.float32).reshape(4, 2)
        y_sorted = pts[np.argsort(pts[:, 1])]
        top_pair = y_sorted[:2]
        bot_pair = y_sorted[2:]
        tl, tr = top_pair[np.argsort(top_pair[:, 0])]
        bl, br = bot_pair[np.argsort(bot_pair[:, 0])]
        return np.array([tl, tr, br, bl], dtype=np.float32)

    # ==================================================================
    # Perspective Transform
    # ==================================================================

    def _perspective_transform(self, image: np.ndarray, corners: np.ndarray) -> np.ndarray:
        tl, tr, br, bl = corners

        width_top = np.linalg.norm(tr - tl)
        width_bottom = np.linalg.norm(br - bl)
        width = int(max(width_top, width_bottom))

        height_left = np.linalg.norm(bl - tl)
        height_right = np.linalg.norm(br - tr)
        height = int(max(height_left, height_right))

        # Preserve the document's natural aspect ratio.
        # Only scale down if larger than max dimension to avoid huge outputs.
        max_dim = max(self.output_size)  # e.g. 1440
        scale = 1.0
        if max(width, height) > max_dim:
            scale = max_dim / max(width, height)
        out_w = int(width * scale)
        out_h = int(height * scale)

        dst = np.array([
            [0, 0], [out_w - 1, 0],
            [out_w - 1, out_h - 1], [0, out_h - 1]
        ], dtype=np.float32)

        M = cv2.getPerspectiveTransform(corners, dst)
        warped = cv2.warpPerspective(image, M, (out_w, out_h))
        return warped

    # ==================================================================
    # Enhancement
    # ==================================================================

    def _enhance_image(self, image: np.ndarray, mode: str) -> np.ndarray:
        if mode == 'document':
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            gray = clahe.apply(gray)
            enhanced = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY, 15, 8)
            return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

        elif mode == 'grayscale':
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            enhanced = cv2.convertScaleAbs(enhanced, alpha=1.2, beta=30)
            return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

        else:  # 'color' or 'auto'
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            l = cv2.add(l, 15)
            l = np.clip(l, 0, 255).astype(np.uint8)
            lab = cv2.merge([l, a, b])
            enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            enhanced = cv2.convertScaleAbs(enhanced, alpha=1.15, beta=5)
            gamma = 1.1
            inv_gamma = 1.0 / gamma
            table = np.array([((i / 255.0) ** inv_gamma) * 255
                             for i in np.arange(0, 256)]).astype("uint8")
            enhanced = cv2.LUT(enhanced, table)
            return enhanced


# Convenience function
def clean_scan(image: np.ndarray, mode: str = 'color') -> Dict:
    scanner = CleanDocumentScanner()
    return scanner.scan(image, mode=mode, enhance=True)
