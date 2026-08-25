import io
import logging
from typing import Tuple, List, Dict, Any, Optional
import fitz  # PyMuPDF
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import DocumentStream

logger = logging.getLogger("ats.parsers.pdf")

class PDFLayoutAnalyzer:
    """Inspects PDF layout geometry to detect multi-column setups and tables."""

    @staticmethod
    def is_multi_column_or_complex(page: fitz.Page) -> bool:
        """
        Detects if a PDF page contains multi-column layouts by analyzing 
        horizontal bounding box overlap across the vertical axis.
        """
        rect = page.rect
        width = rect.width
        midpoint = width / 2.0

        # Extract text blocks: (x0, y0, x1, y1, "text", block_no, block_type)
        # block_type == 0 indicates text; 1 indicates image
        blocks = [b for b in page.get_text("blocks") if b[6] == 0 and b[4].strip()]

        if len(blocks) < 2:
            return False

        left_column_blocks: List[Tuple[float, float, float, float]] = []
        right_column_blocks: List[Tuple[float, float, float, float]] = []

        # Check for side-by-side blocks
        for b in blocks:
            x0, y0, x1, y1 = b[:4]
            # Left column: ends near or before midpoint
            if x1 <= midpoint * 1.05:
                left_column_blocks.append((x0, y0, x1, y1))
            # Right column: starts near or after midpoint
            elif x0 >= midpoint * 0.95:
                right_column_blocks.append((x0, y0, x1, y1))

        # If both columns have significant content, check for vertical overlap
        if len(left_column_blocks) >= 2 and len(right_column_blocks) >= 2:
            vertical_overlaps = 0
            for lx0, ly0, lx1, ly1 in left_column_blocks:
                for rx0, ry0, rx1, ry1 in right_column_blocks:
                    # Check if left block and right block share vertical space
                    if max(ly0, ry0) < min(ly1, ry1):
                        vertical_overlaps += 1
                        if vertical_overlaps >= 2:
                            # Confirmed multi-column parallel flow
                            return True

        return False


class HybridPDFParser:
    def __init__(self):
        # Lazy initialization of Docling converter to save memory at startup
        self._docling_converter: DocumentConverter | None = None

    @property
    def docling_converter(self) -> DocumentConverter:
        if self._docling_converter is None:
            logger.info("Initializing Docling DocumentConverter...")
            self._docling_converter = DocumentConverter()
        return self._docling_converter

    def _extract_with_pymupdf(self, doc: fitz.Document) -> str:
        """Fast-path extraction using PyMuPDF block sorting."""
        extracted_pages = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            # Extract blocks sorted by vertical then horizontal coordinates
            blocks = page.get_text("blocks", sort=True)
            page_text = []
            for b in blocks:
                if b[6] == 0:  # Text block
                    clean_block = b[4].strip()
                    if clean_block:
                        page_text.append(clean_block)
            extracted_pages.append("\n\n".join(page_text))
        return "\n\n---\n\n".join(extracted_pages)

    def _extract_with_docling(self, file_bytes: bytes, filename: str = "resume.pdf") -> str:
        """Deep layout analysis using Docling."""
        logger.info("Executing Docling deep layout analysis...")
        doc_stream = DocumentStream(name=filename, stream=io.BytesIO(file_bytes))
        conversion_result = self.docling_converter.convert(doc_stream)
        return conversion_result.document.export_to_markdown()

    def parse_pdf(self, file_bytes: bytes, filename: str = "resume.pdf") -> Tuple[str, str]:
        """
        Parses a PDF using the fastest accurate engine.
        Returns: Tuple[extracted_markdown_text, engine_used]
        """
        if not file_bytes:
            raise ValueError("Input PDF byte stream is empty.")

        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        except Exception as e:
            logger.error(f"PyMuPDF failed to open byte stream: {e}")
            raise ValueError(f"Corrupted or invalid PDF file: {e}")

        # Check total pages
        total_pages = len(doc)
        if total_pages == 0:
            raise ValueError("PDF document contains 0 pages.")

        # Step 1: Layout Complexity Analysis
        is_complex = False
        for page_index in range(min(total_pages, 3)):  # Sample up to first 3 pages
            page = doc[page_index]
            if PDFLayoutAnalyzer.is_multi_column_or_complex(page):
                logger.info(f"Complex / multi-column layout detected on page {page_index + 1}.")
                is_complex = True
                break

        # Step 2: Route to appropriate extraction engine
        if is_complex:
            try:
                markdown_text = self._extract_with_docling(file_bytes, filename=filename)
                return markdown_text, "docling"
            except Exception as e:
                logger.warning(f"Docling parsing failed: {e}. Falling back to PyMuPDF.")
                return self._extract_with_pymupdf(doc), "pymupdf_fallback"
        else:
            logger.info("Single-column simple layout detected. Using fast PyMuPDF extraction.")
            extracted_text = self._extract_with_pymupdf(doc)
            
            # Sanity check: If extracted text is suspiciously sparse, fallback to Docling
            if len(extracted_text.strip()) < 50:
                logger.warning("PyMuPDF produced sparse output. Rerouting to Docling.")
                try:
                    return self._extract_with_docling(file_bytes, filename=filename), "docling"
                except Exception:
                    return extracted_text, "pymupdf"

            return extracted_text, "pymupdf"

    def locate_citation_in_pdf(self, file_bytes: bytes, search_phrase: str) -> Optional[Dict[str, Any]]:
        """
        Searches for a verbatim citation phrase in a PDF document and returns
        the 1-indexed page number and normalized bounding box coordinates (0-100%).
        """
        if not file_bytes or not search_phrase or len(search_phrase.strip()) < 3:
            return None

        clean_phrase = search_phrase.strip().strip('"').strip("'").strip()
        clean_phrase = clean_phrase.replace("...", "").replace("…", "").strip()
        if not clean_phrase:
            return None

        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        except Exception as e:
            logger.warning(f"Could not open PDF for citation grounding: {e}")
            return None

        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_rect = page.rect
            width = max(1.0, float(page_rect.width))
            height = max(1.0, float(page_rect.height))

            rects = page.search_for(clean_phrase)
            if not rects and len(clean_phrase) > 30:
                # Try search with first 6-8 words
                sub_phrase = " ".join(clean_phrase.split()[:8])
                rects = page.search_for(sub_phrase)

            if not rects and len(clean_phrase.split()) > 4:
                # Try search with first 4 words
                sub_phrase = " ".join(clean_phrase.split()[:4])
                rects = page.search_for(sub_phrase)

            if rects:
                x0 = min(r.x0 for r in rects)
                y0 = min(r.y0 for r in rects)
                x1 = max(r.x1 for r in rects)
                y1 = max(r.y1 for r in rects)

                norm_x = round((x0 / width) * 100.0, 2)
                norm_y = round((y0 / height) * 100.0, 2)
                norm_w = round(((x1 - x0) / width) * 100.0, 2)
                norm_h = round(((y1 - y0) / height) * 100.0, 2)

                return {
                    "page": page_idx + 1,
                    "text_snippet": clean_phrase,
                    "bbox": {
                        "x": norm_x,
                        "y": norm_y,
                        "width": norm_w,
                        "height": norm_h,
                    },
                    "raw_rect": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
                }

        return None