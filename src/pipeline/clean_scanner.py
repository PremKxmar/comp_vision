"""
Clean Document Scanner - Adobe Scan Style

This is a simpler, cleaner implementation using classical OpenCV
techniques that produces professional-quality scans like Adobe Scan.

Features:
- Clean document detection using edge detection + contour finding
- Perspective correction without distortion
- Multiple output modes: Color, Grayscale, Black & White (document mode)
- No grainy artifacts or color distortion
"""

import cv2
import numpy as np
from typing import Dict, Optional, Tuple, List


class CleanDocumentScanner:
    """
    A clean, Adobe Scan-style document scanner.
    
    Uses classical computer vision (no ML) for reliable results.
    """
    
    def __init__(self, output_size: Tuple[int, int] = (1080, 1440)):
        """
        Initialize the scanner.
        
        Args:
            output_size: (width, height) of output scan
        """
        self.output_size = output_size
    
    def scan(
        self,
        image: np.ndarray,
        mode: str = 'color',  # 'color', 'grayscale', 'document', 'auto'
        enhance: bool = True
    ) -> Dict:
        """
        Scan a document from image.
        
        Args:
            image: Input BGR image
            mode: Output mode - 'color', 'grayscale', 'document' (B&W), 'auto'
            enhance: Whether to apply light enhancement
            
        Returns:
            Dictionary with 'scan', 'corners', 'confidence'
        """
        original_h, original_w = image.shape[:2]
        
        # Step 1: Detect document corners
        corners, confidence = self._detect_document(image)
        
        if corners is None:
            # No document found - return original with light enhancement
            scan = self._enhance_image(image, mode) if enhance else image.copy()
            return {
                'scan': scan,
                'corners': None,
                'confidence': 0.0,
                'message': 'No document detected'
            }
        
        # Step 2: Perspective correction
        scan = self._perspective_transform(image, corners)
        
        # Step 3: Apply output mode
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
        Uses scoring to select the best detection.
        """
        # Resize for faster processing
        max_dim = 800
        h, w = image.shape[:2]
        scale = max_dim / max(h, w)
        if scale < 1:
            small = cv2.resize(image, None, fx=scale, fy=scale)
        else:
            small = image.copy()
            scale = 1.0
        
        # Collect all candidate quadrilaterals with scores
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
        
        if not candidates:
            print("[DEBUG] No candidates found by any method")
            return None, 0.0
        
        # Score and rank candidates
        best = self._select_best_candidate(candidates, small.shape)
        
        if best is not None:
            corners, score = best
            print(f"[DEBUG] Best candidate score: {score:.2f}")
            return corners, score
        
        return None, 0.0
    
    def _detect_canny(self, image: np.ndarray, scale: float, low: int, high: int) -> List:
        """Canny edge detection with specific thresholds."""
        candidates = []
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply bilateral filter to smooth while keeping edges
        blurred = cv2.bilateralFilter(gray, 11, 17, 17)
        
        edges = cv2.Canny(blurred, low, high)
        
        # Close gaps in edges
        kernel = np.ones((5, 5), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=2)
        edges = cv2.erode(edges, kernel, iterations=1)
        
        quads = self._find_all_quadrilaterals(edges, image.shape, scale)
        candidates.extend(quads)
        
        return candidates
    
    def _detect_adaptive_threshold(self, image: np.ndarray, scale: float) -> List:
        """Adaptive threshold based detection."""
        candidates = []
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Multiple block sizes for adaptive threshold
        for block_size in [11, 21, 31]:
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                          cv2.THRESH_BINARY, block_size, 2)
            edges = cv2.Canny(thresh, 50, 150)
            kernel = np.ones((3, 3), np.uint8)
            edges = cv2.dilate(edges, kernel, iterations=2)
            
            quads = self._find_all_quadrilaterals(edges, image.shape, scale)
            candidates.extend(quads)
        
        return candidates
    
    def _detect_white_paper(self, image: np.ndarray, scale: float) -> List:
        """Color-based detection for white/light paper."""
        candidates = []
        
        # Convert to LAB for better white detection
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # Threshold on lightness - paper should be brighter
        _, mask = cv2.threshold(l, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Clean up
        kernel = np.ones((7, 7), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
        
        quads = self._find_all_quadrilaterals(mask, image.shape, scale)
        candidates.extend(quads)
        
        # Also try HSV-based detection
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        lower = np.array([0, 0, 140])
        upper = np.array([180, 50, 255])
        mask2 = cv2.inRange(hsv, lower, upper)
        mask2 = cv2.morphologyEx(mask2, cv2.MORPH_CLOSE, kernel, iterations=3)
        
        quads = self._find_all_quadrilaterals(mask2, image.shape, scale)
        candidates.extend(quads)
        
        return candidates
    
    def _detect_morphological(self, image: np.ndarray, scale: float) -> List:
        """Morphological gradient for edge detection."""
        candidates = []
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Morphological gradient
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        gradient = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)
        
        # Threshold
        _, thresh = cv2.threshold(gradient, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Close to connect edges
        kernel = np.ones((5, 5), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
        
        quads = self._find_all_quadrilaterals(thresh, image.shape, scale)
        candidates.extend(quads)
        
        return candidates
    
    def _find_all_quadrilaterals(self, binary: np.ndarray, shape: Tuple, scale: float) -> List:
        """Find all valid quadrilaterals in a binary image."""
        quads = []
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return quads
        
        # Sort by area
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        for contour in contours[:15]:  # Check more contours
            area = cv2.contourArea(contour)
            area_ratio = area / (shape[0] * shape[1])
            
            # Skip if too small (less than 5% of image)
            if area_ratio < 0.05:
                continue
            
            peri = cv2.arcLength(contour, True)
            
            # Try different approximation tolerances
            for eps in [0.01, 0.02, 0.03, 0.04, 0.05, 0.06]:
                approx = cv2.approxPolyDP(contour, eps * peri, True)
                
                if len(approx) == 4:
                    # Validate the quadrilateral
                    corners = approx.reshape(4, 2) / scale
                    
                    if self._is_valid_quadrilateral(corners):
                        ordered = self._order_corners(corners)
                        quads.append((ordered.astype(np.float32), area_ratio))
                        break  # Found valid quad for this contour
        
        return quads
    
    def _is_valid_quadrilateral(self, corners: np.ndarray) -> bool:
        """Check if corners form a valid document-like quadrilateral."""
        # Must be convex
        hull = cv2.convexHull(corners.astype(np.float32))
        if len(hull) != 4:
            return False
        
        # Check angles - should be roughly rectangular (each angle 60-120 degrees)
        ordered = self._order_corners(corners)
        for i in range(4):
            p1 = ordered[i]
            p2 = ordered[(i + 1) % 4]
            p3 = ordered[(i + 2) % 4]
            
            v1 = p1 - p2
            v2 = p3 - p2
            
            # Calculate angle
            cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
            angle = np.degrees(np.arccos(np.clip(cos_angle, -1, 1)))
            
            # Angles should be between 45 and 135 degrees
            if angle < 45 or angle > 135:
                return False
        
        return True
    
    def _select_best_candidate(self, candidates: List, shape: Tuple) -> Optional[Tuple]:
        """Score and select the best quadrilateral candidate."""
        if not candidates:
            return None
        
        scored = []
        for corners, area_ratio in candidates:
            score = self._score_quadrilateral(corners, shape, area_ratio)
            scored.append((corners, score))
        
        # Sort by score (highest first)
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Return best if score is good enough
        best_corners, best_score = scored[0]
        if best_score > 0.3:  # Minimum score threshold
            return best_corners, best_score
        
        return None
    
    def _score_quadrilateral(self, corners: np.ndarray, shape: Tuple, area_ratio: float) -> float:
        """Score a quadrilateral based on multiple criteria."""
        score = 0.0
        
        # 1. Area score (larger is better, up to a point)
        # Ideal document covers 30-80% of image
        if 0.3 <= area_ratio <= 0.8:
            score += 0.3
        elif 0.15 <= area_ratio <= 0.9:
            score += 0.2
        elif area_ratio >= 0.1:
            score += 0.1
        
        # 2. Aspect ratio score (documents are usually portrait or close to square)
        ordered = self._order_corners(corners)
        width = np.mean([np.linalg.norm(ordered[1] - ordered[0]), 
                        np.linalg.norm(ordered[2] - ordered[3])])
        height = np.mean([np.linalg.norm(ordered[3] - ordered[0]),
                         np.linalg.norm(ordered[2] - ordered[1])])
        
        aspect = width / (height + 1e-6)
        # Good aspect ratios: 0.5-2.0 (portrait to landscape)
        if 0.5 <= aspect <= 2.0:
            score += 0.25
        elif 0.3 <= aspect <= 3.0:
            score += 0.1
        
        # 3. Rectangularity score (how close to a rectangle)
        rect_area = width * height
        actual_area = cv2.contourArea(corners.astype(np.float32))
        rectangularity = actual_area / (rect_area + 1e-6)
        if rectangularity > 0.85:
            score += 0.25
        elif rectangularity > 0.7:
            score += 0.15
        elif rectangularity > 0.5:
            score += 0.05
        
        # 4. Edge straightness score (penalize wavy edges)
        # Corners shouldn't be too close together
        min_dist = min([np.linalg.norm(ordered[i] - ordered[(i+1)%4]) for i in range(4)])
        if min_dist > 50:  # Minimum edge length
            score += 0.2
        elif min_dist > 20:
            score += 0.1
        
        return min(score, 1.0)
    
    def _order_corners(self, corners: np.ndarray) -> np.ndarray:
        """
        Order corners: top-left, top-right, bottom-right, bottom-left.
        """
        # Sum and diff to find corners
        s = corners.sum(axis=1)
        d = np.diff(corners, axis=1)
        
        ordered = np.zeros((4, 2), dtype=np.float32)
        ordered[0] = corners[np.argmin(s)]      # Top-left has smallest sum
        ordered[2] = corners[np.argmax(s)]      # Bottom-right has largest sum
        ordered[1] = corners[np.argmin(d)]      # Top-right has smallest difference
        ordered[3] = corners[np.argmax(d)]      # Bottom-left has largest difference
        
        return ordered
    
    def _perspective_transform(self, image: np.ndarray, corners: np.ndarray) -> np.ndarray:
        """
        Apply perspective transformation to get bird's eye view.
        """
        # Calculate output dimensions based on document aspect ratio
        tl, tr, br, bl = corners
        
        # Calculate widths and heights
        width_top = np.linalg.norm(tr - tl)
        width_bottom = np.linalg.norm(br - bl)
        width = int(max(width_top, width_bottom))
        
        height_left = np.linalg.norm(bl - tl)
        height_right = np.linalg.norm(br - tr)
        height = int(max(height_left, height_right))
        
        # Use specified output size, maintaining aspect ratio
        aspect = width / height
        if aspect > self.output_size[0] / self.output_size[1]:
            out_w = self.output_size[0]
            out_h = int(out_w / aspect)
        else:
            out_h = self.output_size[1]
            out_w = int(out_h * aspect)
        
        # Destination corners
        dst = np.array([
            [0, 0],
            [out_w - 1, 0],
            [out_w - 1, out_h - 1],
            [0, out_h - 1]
        ], dtype=np.float32)
        
        # Compute and apply perspective transform
        M = cv2.getPerspectiveTransform(corners, dst)
        warped = cv2.warpPerspective(image, M, (out_w, out_h))
        
        return warped
    
    def _enhance_image(self, image: np.ndarray, mode: str) -> np.ndarray:
        """
        Apply enhancement based on mode - Adobe Scan style.
        
        Key: Brighten the background, darken the text for readable documents.
        
        Modes:
        - 'color': Brighten with color preserved
        - 'grayscale': Clean grayscale with high contrast
        - 'document': Black & white document mode (best for text)
        - 'auto': Same as color
        """
        if mode == 'document':
            # DOCUMENT MODE: Clean black & white for maximum text visibility
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply CLAHE first to balance lighting
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            gray = clahe.apply(gray)
            
            # Adaptive thresholding for clean B&W
            enhanced = cv2.adaptiveThreshold(
                gray, 255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY,
                15, 8
            )
            
            return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
        
        elif mode == 'grayscale':
            # GRAYSCALE MODE: Enhanced grayscale with better visibility
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Strong CLAHE for contrast
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            
            # Increase brightness
            enhanced = cv2.convertScaleAbs(enhanced, alpha=1.2, beta=30)
            
            return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
        
        else:  # 'color' or 'auto'
            # COLOR MODE: Brighten paper, enhance text visibility
            
            # Step 1: Convert to LAB for better illumination control
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            
            # Step 2: Apply CLAHE to L channel for contrast
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            
            # Step 3: Increase brightness
            l = cv2.add(l, 40)  # Add more brightness
            l = np.clip(l, 0, 255).astype(np.uint8)
            
            # Step 4: Merge and convert back
            lab = cv2.merge([l, a, b])
            enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            
            # Step 5: Increase contrast more aggressively
            # alpha > 1 increases contrast, beta > 0 increases brightness
            enhanced = cv2.convertScaleAbs(enhanced, alpha=1.3, beta=10)
            
            # Step 6: Darken the dark areas (text) to make them more prominent
            # Using gamma correction - gamma < 1 brightens, gamma > 1 darkens
            # We want to darken midtones slightly while keeping whites white
            gamma = 0.85  # Slight darkening of midtones to enhance text
            inv_gamma = 1.0 / gamma
            table = np.array([((i / 255.0) ** inv_gamma) * 255 
                             for i in np.arange(0, 256)]).astype("uint8")
            enhanced = cv2.LUT(enhanced, table)
            
            return enhanced


# Convenience function
def clean_scan(image: np.ndarray, mode: str = 'color') -> Dict:
    """
    Quick document scan with default settings.
    """
    scanner = CleanDocumentScanner()
    return scanner.scan(image, mode=mode, enhance=True)
