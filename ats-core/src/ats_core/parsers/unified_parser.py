import io
import os
import logging
from pathlib import Path
from typing import Tuple, Dict, Any, Optional

from ats_core.parsers.pdf_parser import HybridPDFParser
from ats_core.parsers.docx_parser import DocxResumeParser
from ats_core.parsers.image_ocr_parser import ImageOCRResumeParser

logger = logging.getLogger("ats.parsers.unified")

class UnifiedDocumentParser:
    """
    Intelligent router and parser for multi-format resumes.
    Automatically identifies file type (PDF, Word DOCX, PNG, JPG, Images)
    and routes to the optimal parsing engine with fallback strategies.
    """

    def __init__(self):
        self.pdf_parser = HybridPDFParser()
        self.docx_parser = DocxResumeParser()
        self.image_ocr_parser = ImageOCRResumeParser()

    def detect_format(self, file_bytes: bytes, filename: str = "") -> str:
        """
        Determines the document format from magic bytes and filename extension.
        Returns: 'pdf' | 'docx' | 'image' | 'unknown'
        """
        ext = Path(filename).suffix.lower() if filename else ""
        
        # Check Magic Header Bytes
        if file_bytes.startswith(b"%PDF"):
            return "pdf"
        elif file_bytes.startswith(b"PK\x03\x04") or ext in (".docx", ".doc"):
            return "docx"
        elif (
            file_bytes.startswith(b"\x89PNG")
            or file_bytes.startswith(b"\xff\xd8\xff")
            or file_bytes.startswith(b"RIFF")
            or ext in (".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp")
        ):
            return "image"

        # Fallback to extension
        if ext == ".pdf":
            return "pdf"
        elif ext in (".docx", ".doc"):
            return "docx"
        elif ext in (".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"):
            return "image"

        return "unknown"

    def parse(
        self,
        file_bytes: bytes,
        filename: str = "resume.pdf"
    ) -> Tuple[str, str, str]:
        """
        Parses document bytes into standardized Markdown text.
        Returns: Tuple[extracted_text, engine_used, detected_format]
        """
        if not file_bytes:
            raise ValueError("Provided file byte stream is empty.")

        doc_format = self.detect_format(file_bytes, filename)
        logger.info(f"Parsing document '{filename}' detected as format: {doc_format}")

        if doc_format == "docx":
            try:
                text, engine = self.docx_parser.parse_docx(file_bytes, filename=filename)
                return text, engine, "docx"
            except Exception as e:
                logger.error(f"DOCX parsing failed: {e}")
                raise ValueError(f"Failed to parse Word DOCX file: {e}")

        elif doc_format == "image":
            try:
                text, engine = self.image_ocr_parser.parse_image(file_bytes, filename=filename)
                return text, engine, "image"
            except Exception as e:
                logger.error(f"Image OCR parsing failed: {e}")
                raise ValueError(f"Failed to perform OCR on image: {e}")

        elif doc_format == "pdf":
            try:
                text, engine = self.pdf_parser.parse_pdf(file_bytes, filename=filename)
                
                # Check for scanned image-only PDF (sparse text output < 40 chars)
                if len(text.strip()) < 40:
                    logger.warning("PDF produced sparse text. Detected scanned image-only PDF. Routing to OCR.")
                    try:
                        import fitz
                        doc = fitz.open(stream=file_bytes, filetype="pdf")
                        if len(doc) > 0:
                            page = doc[0]
                            pix = page.get_pixmap(dpi=200)
                            img_bytes = pix.tobytes("png")
                            ocr_text, ocr_engine = self.image_ocr_parser.parse_image(img_bytes, filename=filename)
                            if len(ocr_text.strip()) > len(text.strip()):
                                return ocr_text, f"{engine}_ocr_fallback", "pdf_scanned"
                    except Exception as ocr_e:
                        logger.warning(f"Scanned PDF OCR fallback failed: {ocr_e}")

                return text, engine, "pdf"
            except Exception as e:
                logger.error(f"PDF parsing failed: {e}")
                raise ValueError(f"Failed to parse PDF document: {e}")

        else:
            # Attempt best-effort fallback: try PDF first, then DOCX, then Image OCR
            try:
                text, engine = self.pdf_parser.parse_pdf(file_bytes, filename=filename)
                return text, engine, "pdf"
            except Exception:
                try:
                    text, engine = self.docx_parser.parse_docx(file_bytes, filename=filename)
                    return text, engine, "docx"
                except Exception:
                    text, engine = self.image_ocr_parser.parse_image(file_bytes, filename=filename)
                    return text, engine, "image"
