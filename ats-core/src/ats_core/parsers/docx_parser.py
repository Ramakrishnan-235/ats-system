import io
import logging
from typing import Dict, Any, List, Tuple
import docx
from docx.table import Table
from docx.text.paragraph import Paragraph

logger = logging.getLogger("ats.parsers.docx")

class DocxResumeParser:
    """
    Extracts structured, clean text from Microsoft Word (.docx) documents.
    Handles headings, paragraphs, bullet lists, headers/footers, and complex table grids.
    """

    def parse_docx(self, docx_bytes: bytes, filename: str = "resume.docx") -> Tuple[str, str]:
        """
        Parses a Word (.docx) document and returns formatted Markdown text.
        Returns: Tuple[extracted_text, engine_used]
        """
        if not docx_bytes:
            raise ValueError("Input DOCX byte stream is empty.")

        try:
            doc = docx.Document(io.BytesIO(docx_bytes))
        except Exception as e:
            logger.error(f"python-docx failed to open byte stream: {e}")
            raise ValueError(f"Corrupted or invalid Word DOCX file: {e}")

        sections_text: List[str] = []

        # 1. Extract Headers and Footers (frequently holds candidate contact details)
        header_lines: List[str] = []
        for section in doc.sections:
            header = section.header
            if header:
                for p in header.paragraphs:
                    text = p.text.strip()
                    if text and text not in header_lines:
                        header_lines.append(text)
        
        if header_lines:
            sections_text.append("\n".join(header_lines))

        # 2. Iterate through body elements preserving document order
        for block in self._iter_block_items(doc):
            if isinstance(block, Paragraph):
                text = block.text.strip()
                if not text:
                    continue
                
                # Check paragraph style / heading level
                style_name = block.style.name.lower() if block.style else ""
                if "heading 1" in style_name or "title" in style_name:
                    sections_text.append(f"# {text}")
                elif "heading 2" in style_name:
                    sections_text.append(f"## {text}")
                elif "heading 3" in style_name or "heading 4" in style_name:
                    sections_text.append(f"### {text}")
                elif "list" in style_name or "bullet" in style_name:
                    sections_text.append(f"• {text}")
                else:
                    sections_text.append(text)

            elif isinstance(block, Table):
                table_md = self._format_table(block)
                if table_md.strip():
                    sections_text.append(table_md)

        full_extracted_text = "\n\n".join(sections_text).strip()
        if not full_extracted_text:
            raise ValueError("DOCX document contained no readable text elements.")

        return full_extracted_text, "python-docx"

    def _iter_block_items(self, parent):
        """
        Yields each paragraph and table child within the document in true document order.
        """
        from docx.oxml.text.paragraph import CT_P
        from docx.oxml.table import CT_Tbl

        for child in parent.element.body.iterchildren():
            if isinstance(child, CT_P):
                yield Paragraph(child, parent)
            elif isinstance(child, CT_Tbl):
                yield Table(child, parent)

    def _format_table(self, table: Table) -> str:
        """
        Converts a Word table into a structured Markdown table or structured key-value list.
        """
        rows_data: List[List[str]] = []
        for row in table.rows:
            row_cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
            # Remove duplicated merged cells in the same row
            clean_cells = []
            for cell_text in row_cells:
                if not clean_cells or cell_text != clean_cells[-1]:
                    clean_cells.append(cell_text)
            if any(clean_cells):
                rows_data.append(clean_cells)

        if not rows_data:
            return ""

        # Normalize column counts across all rows
        max_cols = max(len(r) for r in rows_data)
        if max_cols == 0:
            return ""

        normalized_rows = [r + [""] * (max_cols - len(r)) for r in rows_data]

        # Build Markdown Table
        header_row = normalized_rows[0]
        separator = ["---"] * max_cols
        
        md_lines = [
            "| " + " | ".join(header_row) + " |",
            "| " + " | ".join(separator) + " |",
        ]
        for row in normalized_rows[1:]:
            md_lines.append("| " + " | ".join(row) + " |")

        return "\n".join(md_lines)
