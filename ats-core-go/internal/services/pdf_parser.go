package services

import (
	"ats-core-go/internal/models"
	"errors"
	"regexp"
	"strings"
)

type PDFParser struct{}

func NewPDFParser() *PDFParser { return &PDFParser{} }

var literalText = regexp.MustCompile(`\(((?:\\.|[^()\\])*)\)\s*(?:Tj|'|")`)
var streamPattern = regexp.MustCompile(`(?s)stream\r?\n(.*?)\r?\nendstream`)
var arrayText = regexp.MustCompile(`(?s)\[(.*?)\]\s*TJ`)
var arrayLiteral = regexp.MustCompile(`\(((?:\\.|[^()\\])*)\)`)

// ExtractText handles only uncompressed literal PDF text. Unsupported PDFs fail
// explicitly instead of turning binary metadata into candidate evidence.
func (p *PDFParser) ExtractText(pdf []byte) (string, error) {
	content := string(pdf)
	if !strings.HasPrefix(content, "%PDF-") {
		return "", errors.New("invalid PDF signature")
	}
	if strings.Contains(content, "/Filter") || strings.Contains(content, "/Encrypt") {
		return "", errors.New("compressed or encrypted PDF requires a full PDF extraction service")
	}
	var chunks []string
	for _, stream := range streamPattern.FindAllStringSubmatch(content, -1) {
		for _, match := range literalText.FindAllStringSubmatch(stream[1], -1) {
			chunks = append(chunks, decodeLiteral(match[1]))
		}
		for _, array := range arrayText.FindAllStringSubmatch(stream[1], -1) {
			var text strings.Builder
			for _, match := range arrayLiteral.FindAllStringSubmatch(array[1], -1) {
				text.WriteString(decodeLiteral(match[1]))
			}
			chunks = append(chunks, text.String())
		}
	}
	text := strings.TrimSpace(strings.Join(chunks, "\n"))
	if text == "" {
		return "", errors.New("no supported text found; OCR and encoded text require a full PDF parser")
	}
	return text, nil
}
func decodeLiteral(text string) string {
	return strings.NewReplacer(`\n`, "\n", `\r`, "\r", `\t`, "\t", `\(`, "(", `\)`, ")", `\\`, `\`).Replace(text)
}

// This parser has no page geometry. Never fabricate citation coordinates.
func (p *PDFParser) LocateCitation(_ []byte, _ string) *models.PDFLocation { return nil }
