"""
Flask REST API for Document Scanner

This provides a REST API that can be consumed by mobile apps
(React Native, Flutter, or any HTTP client).

Usage:
    python api/app.py

Endpoints:
    POST /api/scan         - Scan a document image
    POST /api/detect       - Detect document corners only
    GET  /api/health       - Health check
    GET  /api/info         - API info and capabilities
"""

import os
import sys
import io
import base64
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

from src.pipeline.clean_scanner import CleanDocumentScanner
from src.preprocessing.shadow_removal import ShadowRemover, enhance_document
from src.utils.export import export_to_pdf

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for mobile apps

# Initialize scanner (lazy load)
_scanner = None
_shadow_remover = None


def get_scanner() -> CleanDocumentScanner:
    """Get or create classical CV scanner instance."""
    global _scanner
    if _scanner is None:
        _scanner = CleanDocumentScanner()
    return _scanner


def get_shadow_remover() -> ShadowRemover:
    """Get or create shadow remover instance."""
    global _shadow_remover
    if _shadow_remover is None:
        _shadow_remover = ShadowRemover()
    return _shadow_remover


def decode_base64_image(base64_string: str) -> np.ndarray:
    """Decode base64 string to OpenCV image."""
    # Remove data URL prefix if present
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    # Decode
    img_bytes = base64.b64decode(base64_string)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    
    return image


def encode_image_base64(image: np.ndarray, format: str = 'jpeg') -> str:
    """Encode OpenCV image to base64 string."""
    if format.lower() == 'jpeg':
        _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 90])
    else:
        _, buffer = cv2.imencode('.png', image)
    
    base64_string = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/{format};base64,{base64_string}"


# =============================================================================
# API Endpoints
# =============================================================================

@app.route('/', methods=['GET'])
def index():
    """Root endpoint for quick check."""
    return jsonify({
        'status': 'online',
        'message': 'ScanPro API is running',
        'docs': '/api/info'
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time(),
        'service': 'document-scanner-api'
    })


@app.route('/api/info', methods=['GET'])
def api_info():
    """Get API information and capabilities."""
    return jsonify({
        'name': 'Shadow-Robust Document Scanner API',
        'version': '1.0.0',
        'device': 'cpu',
        'scanner_type': 'CleanDocumentScanner (Classical CV)',
        'capabilities': [
            'document_detection',
            'shadow_removal',
            'perspective_correction',
            'pdf_export'
        ],
        'endpoints': {
            '/api/scan': 'POST - Full document scanning',
            '/api/detect': 'POST - Detect document corners',
            '/api/enhance': 'POST - Enhance document image',
            '/api/health': 'GET - Health check',
            '/api/info': 'GET - API information'
        }
    })


@app.route('/api/scan', methods=['POST'])
def scan_document():
    """
    Scan a document from image.
    
    Request body (JSON):
    {
        "image": "base64_encoded_image_string",
        "options": {
            "remove_shadows": true,
            "enhance": true,
            "output_format": "jpeg"  // or "png"
        }
    }
    
    Response:
    {
        "success": true,
        "scan": "base64_encoded_scan",
        "corners": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]],
        "confidence": 0.95,
        "processing_time_ms": 45.2
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: image'
            }), 400
        
        # Decode image
        image = decode_base64_image(data['image'])
        if image is None:
            return jsonify({
                'success': False,
                'error': 'Failed to decode image'
            }), 400
        
        # Get options
        options = data.get('options', {})
        mode = options.get('mode', 'color')
        enhance = options.get('enhance', True)
        output_format = options.get('output_format', 'jpeg')
        remove_shadows = options.get('remove_shadows', True)
        
        start_time = time.time()
        scanner = get_scanner()
        
        # Step 1: Detect corners on ORIGINAL image (no shadow removal —
        #         shadow removal destroys contrast between doc & background)
        t0 = time.time()
        corners, confidence = scanner._detect_document(image)
        print(f"[TIMING] Detection: {(time.time()-t0)*1000:.0f}ms")
        
        if corners is not None:
            # Step 2: Perspective warp on original image
            t0 = time.time()
            scan = scanner._perspective_transform(image, corners)
            print(f"[TIMING] Warp: {(time.time()-t0)*1000:.0f}ms")
            
            # Step 3: Shadow removal on warped document only (smaller, faster, correct)
            if remove_shadows:
                try:
                    t0 = time.time()
                    scan = get_shadow_remover().remove(scan)
                    print(f"[TIMING] Shadow removal: {(time.time()-t0)*1000:.0f}ms")
                except Exception:
                    pass
            
            # Step 4: Enhancement
            if enhance:
                t0 = time.time()
                scan = scanner._enhance_image(scan, mode)
                print(f"[TIMING] Enhancement: {(time.time()-t0)*1000:.0f}ms")
            
            corners_list = corners.tolist()
        else:
            # No document detected — enhance the whole image
            scan = scanner._enhance_image(image, mode) if enhance else image.copy()
            corners_list = None
        
        processing_time = (time.time() - start_time) * 1000
        print(f"[TIMING] Total: {processing_time:.0f}ms")
        
        # Prepare response
        response = {
            'success': True,
            'confidence': float(confidence) if corners is not None else 0.0,
            'processing_time_ms': round(processing_time, 2),
            'method': 'classical_cv',
        }
        
        response['corners'] = corners_list
        
        if corners is not None:
            response['scan'] = encode_image_base64(scan, output_format)
        else:
            response['scan'] = encode_image_base64(scan, output_format) if scan is not None else None
            response['message'] = 'Document not detected, returning enhanced image'
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/detect', methods=['POST'])
def detect_document():
    """
    Detect document corners without full scanning.
    
    Request body (JSON):
    {
        "image": "base64_encoded_image_string"
    }
    
    Response:
    {
        "success": true,
        "detected": true,
        "corners": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]],
        "confidence": 0.95,
        "mask": "base64_encoded_mask" (optional)
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: image'
            }), 400
        
        # Decode image
        image = decode_base64_image(data['image'])
        if image is None:
            return jsonify({
                'success': False,
                'error': 'Failed to decode image'
            }), 400
        
        # Process with classical CV scanner
        scanner = get_scanner()
        result = scanner.scan(image, mode='color', enhance=False)
        
        response = {
            'success': True,
            'detected': result['corners'] is not None,
            'confidence': float(result['confidence'])
        }
        
        if result['corners'] is not None:
            response['corners'] = result['corners']
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/enhance', methods=['POST'])
def enhance_image():
    """
    Enhance a document image (shadow removal, etc).
    
    Request body (JSON):
    {
        "image": "base64_encoded_image_string",
        "options": {
            "remove_shadows": true,
            "sharpen": true,
            "denoise": true
        }
    }
    """
    try:
        from src.preprocessing.shadow_removal import enhance_document
        
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: image'
            }), 400
        
        # Decode image
        image = decode_base64_image(data['image'])
        if image is None:
            return jsonify({
                'success': False,
                'error': 'Failed to decode image'
            }), 400
        
        # Get options
        options = data.get('options', {})
        
        # Enhance
        enhanced = enhance_document(
            image,
            remove_shadows=options.get('remove_shadows', True),
            sharpen=options.get('sharpen', True),
            denoise=options.get('denoise', True)
        )
        
        return jsonify({
            'success': True,
            'enhanced': encode_image_base64(enhanced, 'jpeg')
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/export-pdf', methods=['POST'])
def export_pdf():
    """
    Export scanned image(s) to PDF.
    
    Request body (JSON):
    {
        "images": ["base64_image1", "base64_image2", ...],
        "options": {
            "page_size": "A4",  // or "letter"
            "add_ocr": false
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'images' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: images'
            }), 400
        
        # Decode images
        images = []
        for img_str in data['images']:
            img = decode_base64_image(img_str)
            if img is not None:
                images.append(img)
        
        if not images:
            return jsonify({
                'success': False,
                'error': 'No valid images provided'
            }), 400
        
        # Get options
        options = data.get('options', {})
        
        # Create PDF in memory using tempfile for cross-platform support
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            temp_path = tmp.name
        
        export_to_pdf(
            images,
            temp_path,
            page_size=options.get('page_size', 'A4'),
            add_ocr_layer=options.get('add_ocr', False)
        )
        
        # Read and encode
        with open(temp_path, 'rb') as f:
            pdf_data = base64.b64encode(f.read()).decode('utf-8')
        
        # Clean up temp file
        import os
        os.unlink(temp_path)
        
        return jsonify({
            'success': True,
            'pdf': f"data:application/pdf;base64,{pdf_data}",
            'pages': len(images)
        })
    
    except Exception as e:
        import traceback
        print(f"[PDF EXPORT ERROR] {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# =============================================================================
# Main
# =============================================================================

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description="Document Scanner API")
    parser.add_argument('--host', type=str, default='0.0.0.0')
    parser.add_argument('--port', type=int, default=5000)
    parser.add_argument('--debug', action='store_true')
    args = parser.parse_args()
    
    print("=" * 60)
    print("  Document Scanner API")
    print("=" * 60)
    print(f"\nStarting server on http://{args.host}:{args.port}")
    print("\nEndpoints:")
    print("  POST /api/scan     - Full document scanning")
    print("  POST /api/detect   - Detect corners only")
    print("  POST /api/enhance  - Enhance image")
    print("  POST /api/export-pdf - Export to PDF")
    print("  GET  /api/health   - Health check")
    print("  GET  /api/info     - API info")
    print("-" * 60)
    
    app.run(host=args.host, port=args.port, debug=args.debug)
