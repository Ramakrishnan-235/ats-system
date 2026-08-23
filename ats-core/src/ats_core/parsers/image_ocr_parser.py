import io
import re
import logging
from typing import Tuple, List, Optional
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
import fitz  # PyMuPDF

logger = logging.getLogger("ats.parsers.ocr")

# Protect server against image decompression bombs (max 10 megapixels)
Image.MAX_IMAGE_PIXELS = 10_000_000
MAX_IMAGE_DIMENSION = 4096


class ImageOCRResumeParser:
    """
    Extracts structured resume text from images (PNG, JPG, JPEG, WEBP, TIFF, BMP)
    using multi-stage Pillow image preprocessing and high-accuracy OCR extraction.
    Protected against image decompression bombs and memory exhaustion attacks.
    """

    def preprocess_image(self, image_bytes: bytes) -> Image.Image:
        """
        Preprocesses image for optimal character recognition:
        1. Auto-rotation via EXIF orientation
        2. High-DPI upscaling for small images
        3. Grayscale conversion and contrast enhancement
        """
        try:
            img = Image.open(io.BytesIO(image_bytes))
            # Verify decompression bomb bounds
            if img.width > MAX_IMAGE_DIMENSION or img.height > MAX_IMAGE_DIMENSION:
                raise ValueError(f"Image dimensions {img.width}x{img.height} exceed safe limit of {MAX_IMAGE_DIMENSION}px")
            if (img.width * img.height) > Image.MAX_IMAGE_PIXELS:
                raise ValueError(f"Image pixel area exceeds safety threshold of {Image.MAX_IMAGE_PIXELS} pixels")

            # Auto-orient if image has EXIF metadata
            img = ImageOps.exif_transpose(img)
        except Image.DecompressionBombError as dbe:
            logger.error(f"Image decompression bomb rejected: {dbe}")
            raise ValueError(f"Image rejected: potential decompression bomb detected ({dbe})") from dbe
        except Exception as e:
            logger.error(f"Failed to decode image bytes: {e}")
            raise ValueError(f"Invalid or unsafe image file: {e}")

        # Ensure image is in RGB or Grayscale mode
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # Upscale if low resolution (under 1600px width), with safety bounds
        if img.width < 1600 and img.width > 0:
            scale_factor = min(1600.0 / float(img.width), 3.0)
            new_width = min(int(img.width * scale_factor), 2400)
            new_height = min(int(img.height * scale_factor), 3200)
            img = img.resize((new_width, new_height), Image.Resampling.BICUBIC)

        # Convert to Grayscale & Enhance Contrast
        gray = img.convert("L")
        enhancer = ImageEnhance.Contrast(gray)
        enhanced_img = enhancer.enhance(1.8)
        
        # Subtle unsharp mask to sharpen text glyph edges
        sharpened_img = enhanced_img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=3))
        return sharpened_img

    def parse_image(self, image_bytes: bytes, filename: str = "resume.png") -> Tuple[str, str]:
        """
        Runs OCR extraction on an image and returns formatted Markdown text.
        Returns: Tuple[extracted_text, engine_used]
        """
        if not image_bytes:
            raise ValueError("Input image byte stream is empty.")

        # Step 1: Preprocess Image with Pillow
        preprocessed = self.preprocess_image(image_bytes)
        
        # Convert preprocessed Pillow image to PNG bytes in memory
        buffer = io.BytesIO()
        preprocessed.save(buffer, format="PNG")
        preprocessed_bytes = buffer.getvalue()

        # Step 2: Attempt OCR extraction via PyMuPDF synthetic PDF document wrapper
        extracted_text = ""
        engine_used = "pymupdf_ocr"

        try:
            # Wrap image into in-memory PDF page
            img_doc = fitz.open(stream=preprocessed_bytes, filetype="png")
            pdf_bytes = img_doc.convert_to_pdf()
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            # Check if PyMuPDF built-in OCR or text extraction is available
            page = doc[0]
            try:
                # Try PyMuPDF OCR get_textpage_ocr
                tp = page.get_textpage_ocr(flags=0, dpi=300, full=True)
                extracted_text = tp.extractText().strip()
                engine_used = "pymupdf_tesseract_ocr"
            except Exception:
                # Fallback to standard text blocks extraction
                extracted_text = page.get_text("text").strip()
        except Exception as e:
            logger.warning(f"PyMuPDF OCR conversion failed: {e}")

        # Step 3: If extracted text is sparse, attempt Docling or EasyOCR if available
        if len(extracted_text.strip()) < 40:
            try:
                import easyocr
                reader = easyocr.Reader(['en'], gpu=False)
                result = reader.readtext(preprocessed_bytes, detail=0)
                if result:
                    extracted_text = "\n\n".join(result)
                    engine_used = "easyocr"
            except Exception as ocr_err:
                logger.warning(f"EasyOCR fallback not available or failed: {ocr_err}")

        # Step 4: If still sparse, attempt pytesseract if installed
        if len(extracted_text.strip()) < 40:
            try:
                import pytesseract
                extracted_text = pytesseract.image_to_string(preprocessed)
                if extracted_text.strip():
                    engine_used = "pytesseract"
            except Exception as pyt_err:
                logger.warning(f"pytesseract fallback failed: {pyt_err}")

        # Final cleanup & normalization (no fake candidates injected)
        clean_text = self._clean_ocr_text(extracted_text, filename)
        return clean_text, engine_used

    def _clean_ocr_text(self, raw_text: str, filename: str) -> str:
        """Cleans and standardizes raw OCR output without fabricating candidate data."""
        if not raw_text or not raw_text.strip():
            return ""

        # Normalize multiple line breaks and strip weird OCR artifacts
        lines = [re.sub(r"\s+", " ", l).strip() for l in raw_text.split("\n")]
        filtered = [l for l in lines if l]
        return "\n\n".join(filtered)
