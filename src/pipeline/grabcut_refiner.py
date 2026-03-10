"""
GrabCut Segmentation for Document Detection Refinement.

Uses OpenCV's GrabCut algorithm (Rother et al., 2004) to iteratively
refine foreground/background separation for document extraction.

Benefits over pure contour-based detection:
- Handles complex backgrounds (wooden tables, patterned surfaces)
- Can segment documents even when edges are partially occluded
- Improves mask quality from DL or initial contour detection
"""

import cv2
import numpy as np
from typing import Optional, Tuple


class GrabCutRefiner:
    """Refine document segmentation using GrabCut."""

    def __init__(self, iterations=5):
        self.iterations = iterations

    def refine_with_corners(self, image, corners):
        """Use initial corner detection to seed GrabCut.

        Args:
            image: BGR input
            corners: (4,2) document corners (TL, TR, BR, BL)

        Returns:
            refined_corners: (4,2) or None
            confidence: float
            mask: binary mask of document region
        """
        h, w = image.shape[:2]

        # Create initial mask from corners
        init_mask = np.zeros((h, w), np.uint8)
        init_mask[:] = cv2.GC_PR_BGD  # probable background

        # Fill polygon as probable foreground
        poly = corners.astype(np.int32).reshape(-1, 1, 2)
        cv2.fillPoly(init_mask, [poly], cv2.GC_PR_FGD)

        # Shrink polygon 15% inward for definite foreground
        cx, cy = corners.mean(axis=0)
        inner = (corners - [cx, cy]) * 0.85 + [cx, cy]
        inner_poly = inner.astype(np.int32).reshape(-1, 1, 2)
        cv2.fillPoly(init_mask, [inner_poly], cv2.GC_FGD)

        # Mark border pixels as definite background
        border = 5
        init_mask[:border, :] = cv2.GC_BGD
        init_mask[-border:, :] = cv2.GC_BGD
        init_mask[:, :border] = cv2.GC_BGD
        init_mask[:, -border:] = cv2.GC_BGD

        # Run GrabCut
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)

        try:
            cv2.grabCut(image, init_mask, None, bgd_model, fgd_model,
                        self.iterations, cv2.GC_INIT_WITH_MASK)
        except cv2.error:
            return None, 0.0, None

        # Extract foreground mask
        fg_mask = np.where(
            (init_mask == cv2.GC_FGD) | (init_mask == cv2.GC_PR_FGD),
            255, 0
        ).astype(np.uint8)

        # Clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel, iterations=1)

        # Find largest contour
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL,
                                       cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None, 0.0, fg_mask

        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        img_area = h * w

        if area < img_area * 0.05 or area > img_area * 0.95:
            return None, 0.0, fg_mask

        # Approximate to quadrilateral
        peri = cv2.arcLength(largest, True)
        for eps in [0.015, 0.02, 0.03, 0.04, 0.05, 0.08]:
            approx = cv2.approxPolyDP(largest, eps * peri, True)
            if len(approx) == 4:
                refined = approx.reshape(4, 2).astype(np.float32)
                conf = area / img_area
                return refined, conf, fg_mask

        # Fallback: minAreaRect
        rect = cv2.minAreaRect(largest)
        box = cv2.boxPoints(rect).astype(np.float32)
        conf = area / img_area * 0.8
        return box, conf, fg_mask

    def segment_document(self, image, rect=None):
        """Segment document using GrabCut with optional bounding rect.

        If no rect provided, uses center 80% of image as initial guess.
        """
        h, w = image.shape[:2]
        if rect is None:
            margin_x = int(w * 0.1)
            margin_y = int(h * 0.1)
            rect = (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)

        mask = np.zeros((h, w), np.uint8)
        bgd = np.zeros((1, 65), np.float64)
        fgd = np.zeros((1, 65), np.float64)

        try:
            cv2.grabCut(image, mask, rect, bgd, fgd,
                        self.iterations, cv2.GC_INIT_WITH_RECT)
        except cv2.error:
            return None, 0.0, None

        fg_mask = np.where(
            (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0
        ).astype(np.uint8)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL,
                                       cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None, 0.0, fg_mask

        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        if area < h * w * 0.05:
            return None, 0.0, fg_mask

        peri = cv2.arcLength(largest, True)
        for eps in [0.015, 0.02, 0.03, 0.04, 0.05]:
            approx = cv2.approxPolyDP(largest, eps * peri, True)
            if len(approx) == 4:
                return approx.reshape(4, 2).astype(np.float32), area / (h * w), fg_mask

        rect = cv2.minAreaRect(largest)
        box = cv2.boxPoints(rect).astype(np.float32)
        return box, area / (h * w) * 0.8, fg_mask
