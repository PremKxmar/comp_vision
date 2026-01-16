# Shadow-Robust Document Scanner
## Complete Computer Vision Explanation Guide

This document explains **every computer vision technique** used in our document scanner project in detail. Each section covers what the technique does, why we use it, and how it works mathematically.

---

# Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Stage 1: Image Preprocessing](#2-stage-1-image-preprocessing)
   - [2.1 Image Resizing](#21-image-resizing)
   - [2.2 Gaussian Blur](#22-gaussian-blur)
   - [2.3 Bilateral Filter](#23-bilateral-filter)
   - [2.4 Color Space Conversion](#24-color-space-conversion)
3. [Stage 2: Shadow Removal](#3-stage-2-shadow-removal)
   - [3.1 LAB Color Space](#31-lab-color-space)
   - [3.2 Sobel Operators (Gradient Computation)](#32-sobel-operators-gradient-computation)
   - [3.3 Shadow Detection](#33-shadow-detection)
   - [3.4 Retinex Theory](#34-retinex-theory)
   - [3.5 CLAHE](#35-clahe-contrast-limited-adaptive-histogram-equalization)
4. [Stage 3: Edge Detection](#4-stage-3-edge-detection)
   - [4.1 Canny Edge Detection](#41-canny-edge-detection)
   - [4.2 Sobel Edge Detection](#42-sobel-edge-detection)
   - [4.3 Laplacian Edge Detection](#43-laplacian-edge-detection)
   - [4.4 Adaptive Thresholding](#44-adaptive-thresholding)
   - [4.5 Otsu's Thresholding](#45-otsus-thresholding)
5. [Stage 4: Morphological Operations](#5-stage-4-morphological-operations)
   - [5.1 Dilation](#51-dilation)
   - [5.2 Erosion](#52-erosion)
   - [5.3 Opening](#53-opening)
   - [5.4 Closing](#54-closing)
   - [5.5 Morphological Gradient](#55-morphological-gradient)
   - [5.6 Structuring Elements](#56-structuring-elements)
6. [Stage 5: Contour Detection & Corner Extraction](#6-stage-5-contour-detection--corner-extraction)
   - [6.1 Contour Detection](#61-contour-detection)
   - [6.2 Douglas-Peucker Algorithm](#62-douglas-peucker-algorithm-polygon-approximation)
   - [6.3 Convex Hull](#63-convex-hull)
   - [6.4 Corner Ordering Algorithm](#64-corner-ordering-algorithm)
7. [Stage 6: Homography & Perspective Correction](#7-stage-6-homography--perspective-correction)
   - [7.1 What is Homography?](#71-what-is-homography)
   - [7.2 The Homography Matrix](#72-the-homography-matrix)
   - [7.3 Direct Linear Transform (DLT)](#73-direct-linear-transform-dlt)
   - [7.4 Perspective Warping](#74-perspective-warping)
8. [Stage 7: Image Enhancement](#8-stage-7-image-enhancement)
   - [8.1 Histogram Equalization](#81-histogram-equalization)
   - [8.2 Unsharp Masking](#82-unsharp-masking)
   - [8.3 Gamma Correction](#83-gamma-correction)
   - [8.4 Non-Local Means Denoising](#84-non-local-means-denoising)

---

# 1. Pipeline Overview

Our document scanner processes images through 6 main stages:

```
📷 Input Image
    ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 1: PREPROCESSING                                       │
│   • Resize image for faster processing                       │
│   • Apply blur to reduce noise                                │
│   • Convert color spaces as needed                            │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 2: SHADOW REMOVAL                                       │
│   • Convert to LAB color space                                │
│   • Detect shadow regions                                     │
│   • Apply Retinex-based illumination normalization            │
│   • Enhance contrast with CLAHE                               │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 3: EDGE DETECTION                                       │
│   • Apply multiple edge detectors (Canny, Sobel, etc.)        │
│   • Combine results for robust detection                      │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 4: MORPHOLOGICAL OPERATIONS                             │
│   • Dilation to close gaps in edges                           │
│   • Erosion to remove noise                                   │
│   • Opening/Closing to clean up the mask                      │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 5: CONTOUR & CORNER EXTRACTION                          │
│   • Find contours in the binary edge image                    │
│   • Approximate contours to polygons                          │
│   • Find the quadrilateral (4-sided shape)                    │
│   • Order corners correctly                                   │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 6: HOMOGRAPHY & PERSPECTIVE CORRECTION                  │
│   • Compute the transformation matrix                         │
│   • Warp the image to a flat, rectangular view                │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 7: IMAGE ENHANCEMENT                                    │
│   • Improve contrast and brightness                           │
│   • Sharpen text for readability                              │
│   • Remove noise artifacts                                    │
└─────────────────────────────────────────────────────────────┘
    ↓
📄 Output: Scanner-Quality Document
```

---

# 2. Stage 1: Image Preprocessing

Preprocessing prepares the raw image for analysis by reducing noise and standardizing the input.

---

## 2.1 Image Resizing

### What It Does
Reduces the image dimensions to make processing faster while keeping the important features.

### Why We Use It
- A 12MP camera image (4000×3000 pixels) takes much longer to process than 800×600
- Most CV algorithms don't need full resolution to detect document edges
- Speeds up processing by 10-25x

### How It Works
```python
# Our implementation
max_dim = 800
h, w = image.shape[:2]
scale = max_dim / max(h, w)

if scale < 1:
    small = cv2.resize(image, None, fx=scale, fy=scale)
else:
    small = image.copy()
    scale = 1.0
```

### Key Points
- We remember the `scale` factor so we can convert detected corners back to original coordinates
- We resize proportionally (both width and height by same factor) to avoid distortion
- Only resize if image is larger than 800 pixels

---

## 2.2 Gaussian Blur

### What It Does
Smooths the image by averaging each pixel with its neighbors, using a weighted average where closer pixels have more influence.

### Why We Use It
- **Removes noise**: Camera sensors produce random noise that can be mistaken for edges
- **Prepares for edge detection**: Canny edge detector requires pre-smoothing
- **Reduces false positives**: Without blur, we'd detect every tiny texture as an "edge"

### How It Works Mathematically

The Gaussian function in 2D:

```
G(x,y) = (1 / 2πσ²) × e^(-(x² + y²) / 2σ²)
```

Where:
- `σ` (sigma) = standard deviation, controls blur amount
- `x, y` = distance from center pixel

### The Gaussian Kernel (5×5 example)

```
     [1   4   7   4  1]
     [4  16  26  16  4]
1/273 × [7  26  41  26  7]
     [4  16  26  16  4]
     [1   4   7   4  1]
```

The center pixel gets the highest weight (41), and weights decrease as we move outward.

### Code Example
```python
# Apply Gaussian blur with 5×5 kernel
blurred = cv2.GaussianBlur(image, (5, 5), sigmaX=0)
# sigmaX=0 means OpenCV calculates sigma automatically from kernel size
```

### Visual Effect
```
BEFORE (noisy):          AFTER (smooth):
[120][125][118][122]    [121][121][121][121]
[115][255][130][119] →  [130][140][135][125]
[122][128][124][121]    [123][125][124][122]
```

---

## 2.3 Bilateral Filter

### What It Does
A smarter blur that smooths textures while **preserving edges**. It considers both:
1. **Spatial distance**: How far is the neighbor pixel?
2. **Intensity difference**: How similar is the neighbor's color?

### Why We Use It
- Regular Gaussian blur makes edges blurry too
- Bilateral filter keeps document edges sharp while removing noise
- Perfect for documents where we need sharp text edges

### How It Works

The bilateral filter combines two Gaussian functions:

```
New_Pixel = Σ (Pixel_neighbor × G_spatial × G_intensity) / Normalizer
```

Where:
- `G_spatial` = Gaussian based on distance (like regular blur)
- `G_intensity` = Gaussian based on color difference (NEW!)

### Key Insight
If a neighbor pixel is very different in color (like an edge), `G_intensity` becomes very small, so that pixel doesn't contribute much to the blur. This preserves edges!

### Code Example
```python
# Bilateral filter preserving edges
# Parameters: diameter=11, sigmaColor=17, sigmaSpace=17
blurred = cv2.bilateralFilter(image, 11, 17, 17)
```

### Visual Comparison
```
Original:     Gaussian Blur:    Bilateral:
[100|200]     [140|160]        [100|200]  ← Edge preserved!
[100|200]     [140|160]        [100|200]
```

---

## 2.4 Color Space Conversion

### What It Does
Converts the image from one color representation to another (e.g., BGR to Grayscale, BGR to LAB).

### Common Color Spaces

#### BGR (Blue-Green-Red)
- How OpenCV stores color images
- Each pixel has 3 values: B, G, R (0-255 each)
- Note: OpenCV uses BGR, not RGB!

#### Grayscale
- Single channel (0-255)
- Conversion formula: `Gray = 0.299×R + 0.587×G + 0.114×B`
- Green contributes most because human eyes are most sensitive to green

#### HSV (Hue-Saturation-Value)
- **Hue**: The color type (0-180 in OpenCV, represents 0-360 degrees)
- **Saturation**: Color intensity/purity (0-255)
- **Value**: Brightness (0-255)
- Great for color-based detection (e.g., finding white paper)

#### LAB
- **L**: Lightness (0-100)
- **A**: Green to Red axis (-128 to +127)
- **B**: Blue to Yellow axis (-128 to +127)
- Separates brightness from color - **perfect for shadow removal!**

### Code Examples
```python
# BGR to Grayscale
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

# BGR to HSV
hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

# BGR to LAB
lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
l, a, b = cv2.split(lab)  # Split into channels
```

---

# 3. Stage 2: Shadow Removal

Shadow removal is crucial for document scanning because shadows make text hard to read and affect edge detection.

---

## 3.1 LAB Color Space

### What It Does
LAB separates **brightness (L)** from **color (A, B)**, allowing us to modify lighting without changing colors.

### Why It's Perfect for Shadow Removal
In RGB/BGR, brightness is mixed into all three channels. If you try to fix shadows, you'll also change colors. In LAB:
- **L channel** = Only lighting/shadows
- **A, B channels** = Only color information

So we can fix the L channel (remove shadows) and leave A, B untouched!

### The Three Channels

```
L (Lightness): 0 = Black, 100 = White
    ┌─────────────────────┐
    │░░░░░▒▒▒▒▒████████│
    │ Dark    →    Bright │
    └─────────────────────┘

A (Green-Red): -128 = Green, +127 = Red
    ┌─────────────────────┐
    │🟢🟢🟢🟢⚪⚪🔴🔴🔴🔴│
    │ Green   →    Red    │
    └─────────────────────┘

B (Blue-Yellow): -128 = Blue, +127 = Yellow
    ┌─────────────────────┐
    │🔵🔵🔵🔵⚪⚪🟡🟡🟡🟡│
    │ Blue    →   Yellow  │
    └─────────────────────┘
```

### Code Example
```python
# Convert to LAB
lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)

# Split into channels
l_channel, a_channel, b_channel = cv2.split(lab)

# Now l_channel contains ONLY brightness information
# Shadows appear as dark (low) values in l_channel
```

---

## 3.2 Sobel Operators (Gradient Computation)

### What It Does
Computes the **gradient** (rate of change) of pixel intensity. High gradient = edge or shadow boundary.

### Why We Use It
- Shadows create smooth intensity transitions
- Text creates sharp intensity transitions
- By analyzing gradients, we can distinguish between shadows and actual content

### The Sobel Kernels

Two 3×3 kernels that detect horizontal and vertical edges:

```
Gx (Horizontal edges):       Gy (Vertical edges):
┌────┬────┬────┐            ┌────┬────┬────┐
│ -1 │  0 │ +1 │            │ -1 │ -2 │ -1 │
├────┼────┼────┤            ├────┼────┼────┤
│ -2 │  0 │ +2 │            │  0 │  0 │  0 │
├────┼────┼────┤            ├────┼────┼────┤
│ -1 │  0 │ +1 │            │ +1 │ +2 │ +1 │
└────┴────┴────┘            └────┴────┴────┘
```

### How to Read the Kernels
- **Gx**: Left column is negative, right is positive → detects vertical edges (horizontal gradient)
- **Gy**: Top row is negative, bottom is positive → detects horizontal edges (vertical gradient)

### Mathematics

For each pixel, we convolve with both kernels:

```
Gx = sum of (kernel_Gx × pixel_neighborhood)
Gy = sum of (kernel_Gy × pixel_neighborhood)

Gradient Magnitude = √(Gx² + Gy²)
Gradient Direction = arctan(Gy / Gx)
```

### Code Example
```python
# Compute gradients
grad_x = cv2.Sobel(l_channel, cv2.CV_64F, 1, 0, ksize=3)  # dx=1, dy=0
grad_y = cv2.Sobel(l_channel, cv2.CV_64F, 0, 1, ksize=3)  # dx=0, dy=1

# Gradient magnitude
gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
```

### Practical Example

```
Original Image (L channel):     Gradient Magnitude:
┌─────────────────────┐        ┌─────────────────────┐
│ 200 200 200 100 100 │        │   0   0  50  50   0 │
│ 200 200 200 100 100 │  →     │   0   0  50  50   0 │
│ 200 200 200 100 100 │        │   0   0  50  50   0 │
└─────────────────────┘        └─────────────────────┘
        Bright ↔ Dark               Edge detected!
```

---

## 3.3 Shadow Detection

### What It Does
Creates a binary mask identifying which pixels are likely shadows.

### Our Algorithm

**Key Insight**: Shadows are regions that are darker than their local neighborhood.

```python
def _detect_shadows(self, l_channel):
    # Step 1: Compute local mean at different scales
    blur_large = cv2.GaussianBlur(l_channel, (51, 51), 0)  # Large-scale average
    
    # Step 2: Shadow = much darker than local mean
    diff = blur_large.astype(np.float32) - l_channel.astype(np.float32)
    
    # Step 3: Threshold - top 20% of differences are shadows
    threshold = np.percentile(diff, 80)
    shadow_mask = (diff > threshold).astype(np.uint8) * 255
    
    # Step 4: Clean up with morphology
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    shadow_mask = cv2.morphologyEx(shadow_mask, cv2.MORPH_CLOSE, kernel)
    shadow_mask = cv2.morphologyEx(shadow_mask, cv2.MORPH_OPEN, kernel)
    
    return shadow_mask
```

### Visual Explanation

```
Original Image:                 Blur (Local Mean):
┌───────────────────┐          ┌───────────────────┐
│ 200 200  80  80   │          │ 160 160 160 160   │
│ 200 200  80  80   │   →      │ 160 160 160 160   │
│ 200 200 200 200   │          │ 180 180 180 180   │
└───────────────────┘          └───────────────────┘
    Normal  Shadow

Difference (Blur - Original):   Shadow Mask:
┌───────────────────┐          ┌───────────────────┐
│ -40 -40  80  80   │          │   0   0 255 255   │
│ -40 -40  80  80   │   →      │   0   0 255 255   │
│ -20 -20 -20 -20   │          │   0   0   0   0   │
└───────────────────┘          └───────────────────┘
     (80 > threshold)              Shadow detected!
```

---

## 3.4 Retinex Theory

### What It Does
Separates an image into **Reflectance** (actual surface color) and **Illumination** (lighting conditions).

### The Core Equation

```
Image = Reflectance × Illumination

Or in log form:
log(Image) = log(Reflectance) + log(Illumination)
```

### Why This Helps

- **Reflectance** = What we want (the document content)
- **Illumination** = What we want to remove (shadows, uneven lighting)

If we can estimate the illumination and divide it out, we're left with just the reflectance!

### Our Implementation

```python
def _normalize_illumination(self, l_channel, shadow_mask, kernel_size):
    # Step 1: Estimate illumination using large blur
    # (Shadows are small-scale, so large blur averages them out)
    illumination = cv2.GaussianBlur(l_channel, (kernel_size, kernel_size), 0)
    
    # Step 2: Compute reflectance
    # Reflectance = Image / Illumination
    eps = 1e-6  # Avoid division by zero
    reflectance = l_channel.astype(np.float32) / (illumination.astype(np.float32) + eps)
    
    # Step 3: Re-illuminate with UNIFORM lighting
    mean_illumination = np.mean(illumination)
    normalized = reflectance * mean_illumination
    
    return normalized
```

### Visual Example

```
Original Image:              Estimated Illumination:
┌────────────────────┐      ┌────────────────────┐
│ 200  60 200 200    │      │ 180 180 180 180    │
│ Light Shadow Light │  →   │ (uniform after blur)│
└────────────────────┘      └────────────────────┘

Reflectance (I / Illum):     Re-illuminated:
┌────────────────────┐      ┌────────────────────┐
│ 1.11 0.33 1.11 1.11│  ×   │ 200 200 200 200    │
│ (normalized values)│ 180 = │ Shadow removed!    │
└────────────────────┘      └────────────────────┘
```

### Adaptive Kernel Size

We use different blur sizes based on shadow intensity:

```python
def _compute_adaptive_kernel(self, shadow_mask):
    shadow_ratio = np.sum(shadow_mask > 0) / shadow_mask.size
    
    if shadow_ratio < 0.1:
        return 11   # Small shadows → small kernel
    elif shadow_ratio < 0.3:
        return 21   # Medium shadows → medium kernel
    else:
        return 31   # Large shadows → large kernel
```

---

## 3.5 CLAHE (Contrast Limited Adaptive Histogram Equalization)

### What It Does
Enhances contrast by redistributing pixel intensities, but does it **locally** (in small tiles) to avoid over-enhancement.

### The Problem with Regular Histogram Equalization

Regular histogram equalization:
- Improves contrast globally
- Can over-enhance areas that don't need it
- May amplify noise in uniform regions

### How CLAHE Solves This

1. **Divide** image into small tiles (e.g., 8×8 grid = 64 tiles)
2. **Equalize** histogram within each tile separately
3. **Clip** the histogram to prevent over-enhancement
4. **Interpolate** between tiles to avoid visible boundaries

### Parameters

```python
clahe = cv2.createCLAHE(
    clipLimit=2.0,      # Maximum contrast amplification
    tileGridSize=(8, 8) # Number of tiles (8×8 = 64 tiles)
)
enhanced = clahe.apply(l_channel)
```

- **clipLimit**: Higher = more contrast, but more noise
- **tileGridSize**: Smaller tiles = more local adaptation

### Visual Comparison

```
Original:              Standard Equalization:     CLAHE:
┌─────────────────┐   ┌─────────────────┐       ┌─────────────────┐
│ Low contrast    │   │ Over-enhanced   │       │ Well balanced   │
│ Dark shadows    │ → │ Noisy in darks  │  vs   │ Local contrast  │
│ Flat document   │   │ Artifacts       │       │ Preserved text  │
└─────────────────┘   └─────────────────┘       └─────────────────┘
```

---

# 4. Stage 3: Edge Detection

Edge detection finds the boundaries where pixel intensity changes rapidly. This is how we locate the document edges.

---

## 4.1 Canny Edge Detection

### What It Does
The gold standard for edge detection. Produces thin, well-connected edge lines.

### The 5 Steps of Canny

#### Step 1: Gaussian Blur
```
Noise reduction using 5×5 Gaussian kernel
```

#### Step 2: Gradient Calculation (Sobel)
```
Compute Gx, Gy, Magnitude, and Direction
Magnitude = √(Gx² + Gy²)
Direction = arctan(Gy/Gx)
```

#### Step 3: Non-Maximum Suppression
```
For each pixel:
  - Look at gradient direction
  - Check if this pixel is the maximum along that direction
  - If not, suppress it (set to 0)
  
This produces thin, 1-pixel wide edges
```

#### Step 4: Double Thresholding
```
Classify edges into 3 categories:
  - Strong edges: gradient > high_threshold
  - Weak edges:   low_threshold < gradient < high_threshold
  - Non-edges:    gradient < low_threshold
```

#### Step 5: Hysteresis (Edge Tracking)
```
For each weak edge:
  - If connected to a strong edge → keep it
  - If not connected to any strong edge → remove it
```

### Code Example
```python
# Basic Canny
edges = cv2.Canny(image, threshold1=50, threshold2=150)

# Adaptive thresholds based on image
median = np.median(image)
lower = int(max(0, 0.7 * median))
upper = int(min(255, 1.3 * median))
edges = cv2.Canny(image, lower, upper)
```

### Visual Example
```
Original:               After Canny:
┌──────────────────┐   ┌──────────────────┐
│    ┌────────┐    │   │    ┌────────┐    │
│    │Document│    │ → │    │        │    │
│    │  here  │    │   │    │        │    │
│    └────────┘    │   │    └────────┘    │
└──────────────────┘   └──────────────────┘
                       Only edges remain!
```

---

## 4.2 Sobel Edge Detection

### What It Does
Computes first-order derivatives to find edges based on intensity gradients.

### Difference from Canny
- **Sobel**: Gives gradient magnitude (gray values), shows "strength" of edges
- **Canny**: Binary output (edge or not), thin lines with noise suppression

### When to Use Sobel
- When you need gradient strength information
- For texture analysis
- Preparatory step for other algorithms

### Code Example
```python
# Compute in X and Y directions separately
sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)

# Combine into magnitude
sobel_magnitude = cv2.magnitude(sobel_x, sobel_y)
sobel_magnitude = np.uint8(sobel_magnitude)
```

---

## 4.3 Laplacian Edge Detection

### What It Does
Computes the **second derivative** of the image. Detects edges as zero-crossings.

### The Laplacian Kernel

```
Standard Laplacian (3×3):
┌────┬────┬────┐
│  0 │  1 │  0 │
├────┼────┼────┤
│  1 │ -4 │  1 │
├────┼────┼────┤
│  0 │  1 │  0 │
└────┴────┴────┘
```

### Mathematical Definition

```
∇²f = ∂²f/∂x² + ∂²f/∂y²
```

The Laplacian is the sum of second derivatives in x and y.

### When to Use
- High-contrast images
- When you need isotropic (direction-independent) edge detection
- Usually needs pre-blurring to reduce noise sensitivity

### Code Example
```python
# Apply Gaussian blur first (Laplacian is very noise-sensitive)
blurred = cv2.GaussianBlur(gray, (3, 3), 0)

# Laplacian edge detection
laplacian = cv2.Laplacian(blurred, cv2.CV_64F)
laplacian = np.uint8(np.absolute(laplacian))
```

---

## 4.4 Adaptive Thresholding

### What It Does
Converts a grayscale image to binary (black/white), but calculates the threshold **locally** for each region.

### Why Not Use Global Thresholding?
- Documents often have uneven lighting
- A single threshold that works for one corner may fail in another
- Adaptive thresholding handles varying illumination

### How It Works

For each pixel, the threshold is computed from its neighborhood:

```
If pixel > (weighted_mean_of_neighborhood - C):
    output = 255 (white)
Else:
    output = 0 (black)
```

### Parameters
- **blockSize**: Size of neighborhood (must be odd: 11, 21, 31...)
- **C**: Constant subtracted from mean (fine-tuning parameter)

### Code Example
```python
# Adaptive threshold with Gaussian weighting
binary = cv2.adaptiveThreshold(
    gray,                           # Input grayscale image
    255,                            # Max value for output
    cv2.ADAPTIVE_THRESH_GAUSSIAN_C, # Gaussian weighted mean
    cv2.THRESH_BINARY,              # Binary output
    blockSize=11,                   # Neighborhood size
    C=2                             # Constant to subtract
)
```

### Visual Comparison
```
Uneven Lighting Image:       Global Threshold:        Adaptive Threshold:
┌─────────────────────┐     ┌─────────────────────┐  ┌─────────────────────┐
│Dark    │    Bright  │     │Black   │    Good    │  │Good    │    Good    │
│side    │    side    │  →  │(lost)  │    text    │  │text    │    text    │
│TEXT    │    TEXT    │     │        │    TEXT    │  │TEXT    │    TEXT    │
└─────────────────────┘     └─────────────────────┘  └─────────────────────┘
```

---

## 4.5 Otsu's Thresholding

### What It Does
Automatically determines the optimal threshold value by minimizing variance within each class (foreground/background).

### How It Works
1. Compute histogram of pixel intensities
2. For each possible threshold (0-255):
   - Split pixels into two classes
   - Compute variance within each class
   - Compute weighted sum of variances
3. Choose threshold that minimizes intra-class variance

### Mathematical Formula

```
σ²_within = w₀×σ₀² + w₁×σ₁²

Where:
- w₀, w₁ = weight (proportion) of each class
- σ₀², σ₁² = variance of each class
```

### Code Example
```python
# Otsu automatically finds the best threshold
_, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
# The 0 is ignored - Otsu computes the optimal value
```

---

# 5. Stage 4: Morphological Operations

Morphological operations are used to clean up binary images by modifying shapes based on a structuring element.

---

## 5.1 Dilation

### What It Does
**Expands** bright (white) regions. The output pixel is the **maximum** value of all pixels under the kernel.

### Formula
```
output(x,y) = max{ input(x+i, y+j) } for all (i,j) in kernel
```

### Effect on Binary Images
- White regions grow outward
- Fills small gaps/holes
- Connects nearby objects

### Code Example
```python
kernel = np.ones((5, 5), np.uint8)
dilated = cv2.dilate(binary_image, kernel, iterations=1)
```

### Visual Example
```
Before Dilation:        After Dilation:
┌───────────────┐      ┌───────────────┐
│   ██████      │      │  ████████     │
│   ██  ██      │  →   │  ████████     │  Gap filled!
│   ██████      │      │  ████████     │
└───────────────┘      └───────────────┘
```

---

## 5.2 Erosion

### What It Does
**Shrinks** bright regions. The output pixel is the **minimum** value of all pixels under the kernel.

### Formula
```
output(x,y) = min{ input(x+i, y+j) } for all (i,j) in kernel
```

### Effect on Binary Images
- White regions shrink inward
- Removes small bright spots (noise)
- Separates connected objects

### Code Example
```python
kernel = np.ones((5, 5), np.uint8)
eroded = cv2.erode(binary_image, kernel, iterations=1)
```

### Visual Example
```
Before Erosion:         After Erosion:
┌───────────────┐      ┌───────────────┐
│  ██████████   │      │    ██████     │
│  ██████████   │  →   │    ██████     │
│  ██████████   │      │    ██████     │
│    ·          │      │               │  Noise removed!
└───────────────┘      └───────────────┘
```

---

## 5.3 Opening

### What It Does
**Opening = Erosion followed by Dilation**

Removes small bright spots (noise) while preserving larger shapes.

### When to Use
- Remove salt noise (small white dots)
- Clean up edge detection results
- Separate objects that are slightly touching

### Code Example
```python
kernel = np.ones((5, 5), np.uint8)
opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
```

### Visual Example
```
Original:              Erode:                 Dilate (Opening):
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│ ████████   ·   │    │   ██████       │    │  ████████      │
│ ████████   ·   │ →  │   ██████       │ →  │  ████████      │
│    ·           │    │                │    │                │
└────────────────┘    └────────────────┘    └────────────────┘
     Noise                 Removed              Shape restored
```

---

## 5.4 Closing

### What It Does
**Closing = Dilation followed by Erosion**

Fills small dark spots (holes) while preserving larger shapes.

### When to Use
- Fill small holes inside objects
- Connect broken edges
- Close gaps in contours

### Code Example
```python
kernel = np.ones((5, 5), np.uint8)
closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
```

### Visual Example
```
Original:              Dilate:                Erode (Closing):
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│ ███·····███    │    │ █████████████   │    │ █████████████  │
│ ███     ███    │ →  │ █████████████   │ → │ █████████████  │
│ ███·····███    │    │ █████████████   │    │ █████████████  │
└────────────────┘    └────────────────┘    └────────────────┘
     Gap                   Filled              Shape restored
```

---

## 5.5 Morphological Gradient

### What It Does
**Gradient = Dilation - Erosion**

Highlights edges/boundaries of objects.

### Code Example
```python
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
gradient = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)
```

### Visual Example
```
Original:              Gradient:
┌────────────────┐    ┌────────────────┐
│   ████████     │    │   ██    ██     │
│   ████████     │ →  │   █      █     │  Only edges!
│   ████████     │    │   ██    ██     │
└────────────────┘    └────────────────┘
```

---

## 5.6 Structuring Elements

### What They Are
The "shape" used for morphological operations. Different shapes produce different effects.

### Common Types

#### Rectangular (MORPH_RECT)
```python
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
# Result:
# [1 1 1 1 1]
# [1 1 1 1 1]
# [1 1 1 1 1]
# [1 1 1 1 1]
# [1 1 1 1 1]
```
- Good for: General purpose, rectangular documents

#### Elliptical (MORPH_ELLIPSE)
```python
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
# Result:
# [0 1 1 1 0]
# [1 1 1 1 1]
# [1 1 1 1 1]
# [1 1 1 1 1]
# [0 1 1 1 0]
```
- Good for: Rounded objects, smoother results

#### Cross (MORPH_CROSS)
```python
kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (5, 5))
# Result:
# [0 0 1 0 0]
# [0 0 1 0 0]
# [1 1 1 1 1]
# [0 0 1 0 0]
# [0 0 1 0 0]
```
- Good for: Connecting horizontal/vertical lines

---

# 6. Stage 5: Contour Detection & Corner Extraction

After edge detection and cleanup, we need to find the document boundary and extract its corners.

---

## 6.1 Contour Detection

### What It Does
Finds continuous curves/boundaries in a binary image.

### How It Works
1. Scan image for white pixel
2. Trace along connected white pixels
3. Return to starting point = one closed contour
4. Continue scanning for more contours

### Parameters

```python
contours, hierarchy = cv2.findContours(
    binary_image,
    mode,      # Which contours to retrieve
    method     # How to store contour points
)
```

#### Retrieval Modes:
- `RETR_EXTERNAL`: Only outermost contours (best for document detection)
- `RETR_LIST`: All contours, flat list
- `RETR_TREE`: All contours with hierarchy

#### Approximation Methods:
- `CHAIN_APPROX_NONE`: Store all contour points
- `CHAIN_APPROX_SIMPLE`: Compress straight lines to endpoints only

### Code Example
```python
contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# Sort by area (largest first)
contours = sorted(contours, key=cv2.contourArea, reverse=True)

# The largest contour is likely the document
document_contour = contours[0]
```

---

## 6.2 Douglas-Peucker Algorithm (Polygon Approximation)

### What It Does
Simplifies a contour to a polygon with fewer vertices while maintaining the overall shape.

### Why We Need It
- Raw contours have hundreds of points
- We need exactly 4 points (corners) for a document
- This reduces the contour to its essential vertices

### How It Works

```
Algorithm:
1. Draw line between first and last point
2. Find the point farthest from this line
3. If distance > epsilon:
   - Split at this point
   - Recursively simplify each half
4. If distance <= epsilon:
   - Approximate as straight line
```

### The Epsilon Parameter

```python
perimeter = cv2.arcLength(contour, closed=True)
epsilon = 0.02 * perimeter  # 2% of perimeter
approx = cv2.approxPolyDP(contour, epsilon, closed=True)
```

- **Larger epsilon** = more simplification = fewer points
- **Smaller epsilon** = less simplification = more points
- We use 0.02 (2%) as a good balance

### Visual Example

```
Original Contour (100+ points):    After Approximation (4 points):
    ·····                              ·
   ·     ·                            / \
  ·       ·                          /   \
  ·       ·              →          /     \
  ·       ·                        /       \
   ·     ·                        ·---------·
    ·····                         4 corners only!
```

### Checking for Quadrilateral
```python
if len(approx) == 4:
    # We found a quadrilateral (document shape)!
    corners = approx.reshape(4, 2)
```

---

## 6.3 Convex Hull

### What It Does
Finds the smallest convex polygon that contains all points of a shape.

### Visual Analogy
Imagine putting a rubber band around all points - the rubber band shape is the convex hull.

### Why We Use It
- Validate that our quadrilateral is convex (not self-intersecting)
- Documents are always convex shapes

### Code Example
```python
hull = cv2.convexHull(corners.astype(np.float32))
if len(hull) != 4:
    # Not a valid convex quadrilateral
    return False
```

---

## 6.4 Corner Ordering Algorithm

### What It Does
Ensures corners are in consistent order: Top-Left → Top-Right → Bottom-Right → Bottom-Left

### Why We Need Consistent Order
- Homography requires knowing which corner is which
- The same 4 points in different order give different transformations

### Our Algorithm

```python
def _order_corners(corners):
    # Step 1: Compute sum and difference
    s = corners.sum(axis=1)   # x + y
    d = np.diff(corners, axis=1).flatten()  # y - x
    
    ordered = np.zeros((4, 2), dtype=np.float32)
    
    # Top-left: smallest sum (x and y are both small)
    ordered[0] = corners[np.argmin(s)]
    
    # Bottom-right: largest sum (x and y are both large)
    ordered[2] = corners[np.argmax(s)]
    
    # Top-right: smallest difference (y small, x large → y-x is small)
    ordered[1] = corners[np.argmin(d)]
    
    # Bottom-left: largest difference (y large, x small → y-x is large)
    ordered[3] = corners[np.argmax(d)]
    
    return ordered
```

### Visual Explanation

```
         X-axis →
    ┌────────────────────────┐
    │           TR (1)       │
    │ TL (0)    sum=min(d)   │  ↓
    │sum=min(s)              │  Y
  Y │                        │  -
  | │                        │  a
  ↓ │ BL (3)    BR (2)       │  x
    │sum=max(d) sum=max(s)   │  i
    └────────────────────────┘  s

Where:
  s = x + y (sum)
  d = y - x (difference)
```

---

# 7. Stage 6: Homography & Perspective Correction

The mathematical core of document scanning - transforming a distorted quadrilateral to a perfect rectangle.

---

## 7.1 What is Homography?

### Definition
A **homography** is a transformation that maps points from one plane to another plane.

### Real-World Analogy
When you photograph a rectangular document at an angle:
- The document looks like a trapezoid in the photo
- Homography is the math that "reverses" this distortion
- It maps the trapezoid back to a rectangle

### Key Properties
- Straight lines remain straight (no curves)
- Parallel lines may become non-parallel (perspective effect)
- Defined by 8 parameters (8 degrees of freedom)

---

## 7.2 The Homography Matrix

### The 3×3 Matrix

```
        ┌───────────────────┐
        │ h₁₁   h₁₂   h₁₃  │
   H =  │ h₂₁   h₂₂   h₂₃  │
        │ h₃₁   h₃₂   h₃₃  │
        └───────────────────┘

h₃₃ is normalized to 1, leaving 8 unknowns
```

### Point Transformation

To transform point (x, y) to (x', y'):

```
Step 1: Homogeneous coordinates
┌────┐       ┌────┐
│ x' │       │ x  │
│ y' │ = H × │ y  │
│ w' │       │ 1  │
└────┘       └────┘

Step 2: Normalize by w'
x'_final = x' / w'
y'_final = y' / w'
```

### Expanded Form

```
x'_final = (h₁₁·x + h₁₂·y + h₁₃) / (h₃₁·x + h₃₂·y + h₃₃)
y'_final = (h₂₁·x + h₂₂·y + h₂₃) / (h₃₁·x + h₃₂·y + h₃₃)
```

---

## 7.3 Direct Linear Transform (DLT)

### What It Does
Computes the homography matrix from 4 point correspondences.

### The Setup

We have 4 source points (detected corners) and 4 destination points (target rectangle):

```
Source (detected):              Destination (target):
P₁ = (x₁, y₁)  TL              P₁' = (0, 0)
P₂ = (x₂, y₂)  TR              P₂' = (width, 0)
P₃ = (x₃, y₃)  BR              P₃' = (width, height)
P₄ = (x₄, y₄)  BL              P₄' = (0, height)
```

### Building the Linear System

For each point correspondence, we get 2 equations:

```
[-x  -y  -1   0   0   0   x·x'  y·x'  x'] × [h₁₁]   [0]
[ 0   0   0  -x  -y  -1   x·y'  y·y'  y']   [h₁₂]   [0]
                                            [h₁₃]
                                            [h₂₁] = [0]
                                            [h₂₂]   [0]
                                            [h₂₃]   [0]
                                            [h₃₁]   [0]
                                            [h₃₂]   [0]
                                            [h₃₃]   [0]
```

With 4 points × 2 equations = 8 equations for 8 unknowns.

### Solving the System

This is solved using **Singular Value Decomposition (SVD)**:
1. Build the 8×9 matrix A from all point correspondences
2. Compute SVD: A = U × S × Vᵀ
3. The solution h is the last column of V
4. Reshape h into the 3×3 matrix H

### OpenCV Implementation

```python
# Source corners (detected document corners)
src = np.array([
    [100, 80],    # Top-left
    [540, 60],    # Top-right
    [560, 400],   # Bottom-right
    [80, 420]     # Bottom-left
], dtype=np.float32)

# Destination corners (perfect rectangle)
dst = np.array([
    [0, 0],
    [width, 0],
    [width, height],
    [0, height]
], dtype=np.float32)

# Compute homography using DLT internally
H = cv2.getPerspectiveTransform(src, dst)
```

---

## 7.4 Perspective Warping

### What It Does
Applies the homography matrix to every pixel in the image, creating the "flattened" output.

### How It Works

For each output pixel (x', y'):
1. Apply inverse homography to find source pixel (x, y)
2. Sample the color from the source image at (x, y)
3. Use bilinear interpolation for non-integer coordinates

### Bilinear Interpolation

When (x, y) falls between pixels, we interpolate:

```
(x, y) = (3.7, 2.3)

Neighboring pixels:
  (3,2)───(4,2)
    │       │
    │ (3.7, │
    │  2.3) │
    │       │
  (3,3)───(4,3)

Interpolated value = weighted average of all 4 neighbors
  Weight based on distance to each neighbor
```

### Code Example

```python
# Apply perspective warp
warped = cv2.warpPerspective(
    image,           # Source image
    H,               # Homography matrix
    (width, height), # Output size
    flags=cv2.INTER_LINEAR  # Bilinear interpolation
)
```

### Complete Implementation

```python
def _perspective_transform(self, image, corners):
    # Extract ordered corners
    tl, tr, br, bl = corners
    
    # Calculate output dimensions from document aspect ratio
    width_top = np.linalg.norm(tr - tl)
    width_bottom = np.linalg.norm(br - bl)
    width = int(max(width_top, width_bottom))
    
    height_left = np.linalg.norm(bl - tl)
    height_right = np.linalg.norm(br - tr)
    height = int(max(height_left, height_right))
    
    # Define destination rectangle
    dst = np.array([
        [0, 0],
        [width - 1, 0],
        [width - 1, height - 1],
        [0, height - 1]
    ], dtype=np.float32)
    
    # Compute and apply transformation
    H = cv2.getPerspectiveTransform(corners, dst)
    warped = cv2.warpPerspective(image, H, (width, height))
    
    return warped
```

---

# 8. Stage 7: Image Enhancement

The final stage improves the scanned document's appearance for readability.

---

## 8.1 Histogram Equalization

### What It Does
Redistributes pixel intensities to use the full range (0-255), improving contrast.

### The Problem
Many images don't use the full intensity range:
- Low contrast: pixels clustered in a narrow range
- Result: dull, washed-out appearance

### How It Works

1. Compute histogram (count of each intensity level)
2. Compute cumulative distribution function (CDF)
3. Use CDF to map old intensities to new intensities

### Visual Example

```
Before:                          After:
Histogram                        Histogram
|     ██                         |   █   █
|    ████                        |  ███ ███
|   ██████                       | ███████████
+----------→                     +----------→
0    128   255                   0    128   255
  Clustered                        Spread out
```

### Code Example
```python
# Simple histogram equalization
equalized = cv2.equalizeHist(gray)
```

---

## 8.2 Unsharp Masking

### What It Does
Sharpens the image by enhancing edges.

### The Formula

```
Sharpened = Original + α × (Original - Blurred)
          = Original + α × HighPassFilter

Where α controls sharpening strength
```

### How It Works

1. Create a blurred version of the image
2. Subtract blurred from original = edges only (high-pass filter)
3. Add these edges back to the original with some weight

### Visual Example

```
Original:       Blurred:        Difference:      Sharpened:
[100|200]      [140|160]       [-40|40]         [80|240]
               (edges lost)     (edges only)     (enhanced!)
```

### Code Example
```python
# Unsharp masking
blurred = cv2.GaussianBlur(image, (0, 0), sigmaX=1.5)
sharpened = cv2.addWeighted(
    image, 1.3,    # Original with weight 1.3
    blurred, -0.3, # Subtract blurred
    0              # No brightness offset
)
```

---

## 8.3 Gamma Correction

### What It Does
Adjusts the brightness non-linearly, allowing you to brighten or darken midtones while preserving extremes.

### The Formula

```
Output = 255 × (Input / 255)^γ

Where:
- γ < 1: Brightens image (especially dark areas)
- γ > 1: Darkens image (especially bright areas)
- γ = 1: No change
```

### How It Affects Different Intensities

```
γ = 0.5 (brighten):
  Input   Output
  0       0      (black stays black)
  64      128    (dark gets brighter)
  128     180    (midtone gets brighter)
  192     222    (light gets slightly brighter)
  255     255    (white stays white)
```

### Code Example
```python
# Gamma correction
gamma = 0.85  # Slight darkening of midtones
inv_gamma = 1.0 / gamma

# Build lookup table for efficiency
table = np.array([((i / 255.0) ** inv_gamma) * 255 
                  for i in np.arange(0, 256)]).astype("uint8")

# Apply using lookup table
corrected = cv2.LUT(image, table)
```

---

## 8.4 Non-Local Means Denoising

### What It Does
Removes noise while preserving edges by averaging **similar patches** across the entire image, not just local neighbors.

### Why It's Better Than Gaussian Blur
- Gaussian blur averages nearby pixels regardless of similarity
- This blurs edges along with noise
- Non-Local Means only averages pixels that look similar
- Edges are preserved because edge pixels aren't similar to non-edge pixels

### How It Works

For each pixel:
1. Extract a small patch around it
2. Search the image for similar patches
3. Average the center values of all similar patches
4. Result = denoised pixel value

### Parameters

```python
denoised = cv2.fastNlMeansDenoisingColored(
    image,
    None,
    h=6,                    # Filter strength (higher = more denoising)
    hForColorComponents=6,  # Same for color
    templateWindowSize=7,   # Size of patch to compare
    searchWindowSize=21     # Size of area to search
)
```

### Visual Comparison
```
Noisy Image:           Gaussian Blur:         Non-Local Means:
┌─────────────────┐   ┌─────────────────┐    ┌─────────────────┐
│ Noisy text but  │   │ Bleory text but │    │ Clear text and  │
│ clear edges     │ → │ blurry edges    │ or │ clear edges     │
│ ·noise·         │   │ no noise        │    │ no noise!       │
└─────────────────┘   └─────────────────┘    └─────────────────┘
```

---

# Summary

This document covered every CV technique used in the Shadow-Robust Document Scanner:

| Stage | Key Techniques |
|-------|----------------|
| 1. Preprocessing | Resizing, Gaussian Blur, Bilateral Filter, Color Conversion |
| 2. Shadow Removal | LAB Color Space, Sobel Gradients, Retinex Theory, CLAHE |
| 3. Edge Detection | Canny, Sobel, Laplacian, Adaptive Threshold, Otsu |
| 4. Morphology | Dilation, Erosion, Opening, Closing, Gradient |
| 5. Contours | findContours, Douglas-Peucker, Convex Hull, Corner Ordering |
| 6. Homography | DLT Algorithm, Perspective Transform, Bilinear Interpolation |
| 7. Enhancement | Histogram Equalization, Unsharp Masking, Gamma, Denoising |

Each technique builds upon the previous ones to create a complete document scanning pipeline!
