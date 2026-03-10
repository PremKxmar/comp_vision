"""
Preprocessing utilities for document scanning.
"""

from .shadow_removal import ShadowRemover, remove_shadow, enhance_document

__all__ = [
    "ShadowRemover",
    "remove_shadow",
    "enhance_document",
]
