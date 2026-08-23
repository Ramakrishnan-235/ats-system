import re
import logging
from typing import List, Tuple, Dict, Any, Optional
from rank_bm25 import BM25Okapi

logger = logging.getLogger("ats.search.bm25")

# Technical stopwords that add no discriminant search value
TECH_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
    "to", "was", "were", "will", "with", "experience", "responsible",
    "working", "knowledge", "years", "team", "using"
}


class BM25LexicalIndex:
    """Inverted index providing lexical BM25 matching over candidate documents."""

    def __init__(self):
        self.candidate_ids: List[str] = []
        self.raw_documents: List[str] = []
        self.tokenized_corpus: List[List[str]] = []
        self.bm25_model: Optional[BM25Okapi] = None

    @staticmethod
    def tokenize(text: str) -> List[str]:
        """
        Tokenizes technical text while preserving compound acronyms,
        version identifiers, and programming languages (e.g., C++, .NET, CI/CD).
        """
        text = text.lower()
        # Matches alphanumeric sequences and tech symbols: c++, .net, tcp/ip, ci/cd
        tokens = re.findall(r"\b[a-z0-9]+(?:\.[a-z0-9]+)*(?:\+\+|#)?\b|[a-z0-9]+-[a-z0-9]+", text)
        return [t for t in tokens if t not in TECH_STOPWORDS and len(t) > 1]

    def build_index(self, candidate_ids: List[str], documents: List[str]):
        """Builds or rebuilds the BM25 inverted index from a batch of candidate profiles."""
        if len(candidate_ids) != len(documents):
            raise ValueError("candidate_ids and documents lists must be of identical length.")

        self.candidate_ids = list(candidate_ids)
        self.raw_documents = list(documents)
        
        if not candidate_ids or not documents:
            self.tokenized_corpus = []
            self.bm25_model = None
            logger.info("Cleared BM25 index (empty input).")
            return

        # Ensure every document has at least one valid token so BM25Okapi does not calculate avgdl=0
        tokenized = []
        for doc in documents:
            toks = self.tokenize(doc or "")
            if not toks:
                # Placeholder token for documents with no technical words
                toks = ["<empty_document>"]
            tokenized.append(toks)

        self.tokenized_corpus = tokenized
        try:
            self.bm25_model = BM25Okapi(self.tokenized_corpus)
            logger.info(f"Built BM25 index over {len(self.candidate_ids)} candidates.")
        except Exception as err:
            logger.error(f"Failed to initialize BM25 index: {err}")
            self.bm25_model = None

    def search(self, query: str, top_k: int = 20) -> List[Tuple[str, float]]:
        """
        Searches the BM25 index and returns sorted tuples of (candidate_id, bm25_score).
        """
        if not self.bm25_model or not self.candidate_ids or not self.tokenized_corpus:
            return []

        tokenized_query = self.tokenize(query or "")
        if not tokenized_query:
            return []

        try:
            doc_scores = self.bm25_model.get_scores(tokenized_query)
            
            # Pair IDs with scores and prune 0-score matches
            results = [
                (self.candidate_ids[idx], float(score))
                for idx, score in enumerate(doc_scores)
                if score > 0.0
            ]
            
            # Sort descending by BM25 score
            results.sort(key=lambda x: x[1], reverse=True)
            return results[:top_k]
        except Exception as e:
            logger.error(f"Error executing BM25 search: {e}")
            return []
