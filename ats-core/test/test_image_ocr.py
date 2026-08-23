import io
import pytest
from PIL import Image, ImageDraw, ImageFont
from ats_core.parsers.image_ocr_parser import ImageOCRResumeParser

def create_sample_resume_image() -> bytes:
    # Create white canvas
    img = Image.new("RGB", (1200, 1600), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Draw resume text
    draw.text((80, 80), "Alex Rivera", fill=(10, 10, 10))
    draw.text((80, 130), "Staff Site Reliability Engineer • alex.r@example.com", fill=(60, 60, 60))
    draw.text((80, 190), "Core Skills: Python, Kubernetes, Docker, AWS, Prometheus, Terraform", fill=(20, 20, 20))
    draw.text((80, 260), "Experience: Staff SRE at Infrastructure Global (2020 - Present)", fill=(20, 20, 20))
    draw.text((80, 320), "Maintained 99.999% SLA across multi-cloud Kubernetes clusters.", fill=(40, 40, 40))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def test_image_preprocessing():
    img_bytes = create_sample_resume_image()
    parser = ImageOCRResumeParser()
    preprocessed = parser.preprocess_image(img_bytes)

    assert preprocessed.width >= 1600
    assert preprocessed.mode == "L"  # Grayscale

def test_image_ocr_parser_returns_clean_text():
    img_bytes = create_sample_resume_image()
    parser = ImageOCRResumeParser()
    extracted_text, engine = parser.parse_image(img_bytes, filename="alex_rivera_resume.png")

    assert len(extracted_text.strip()) > 50
    assert engine in ("pymupdf_tesseract_ocr", "pymupdf_ocr", "easyocr", "pytesseract")

def test_image_ocr_parser_empty_bytes_raises():
    parser = ImageOCRResumeParser()
    with pytest.raises(ValueError, match="empty"):
        parser.parse_image(b"", filename="empty.png")
