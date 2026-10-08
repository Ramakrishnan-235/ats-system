"""test_thread_safe_singletons_3_4.py
Regression tests for Finding 3.4:
Ensures all lazy singletons initialize with thread locks and prevent race conditions:
1. SkillTaxonomyService.get_instance
2. LLMResidueExtractor.get_instance (and _redact_for_llm on-demand anonymizer)
3. _default_evaluator in llm_evaluator.py
4. get_retriever and get_reranker in match.py
5. SkillMatcher.get_instance and SkillEmbeddingsIndex.get_instance
"""

import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure src is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService
from ats_core.parsers.llm_residue_extractor import LLMResidueExtractor
from ats_core.evaluator import llm_evaluator
from ats_core.api.v1 import match
from ats_core.parsers.skill_matcher import SkillMatcher
try:
    from ats_core.parsers.normalization_cascade import SkillEmbeddingsIndex
except ImportError:
    SkillEmbeddingsIndex = None


def test_skill_taxonomy_service_lock_and_concurrency():
    """Verify SkillTaxonomyService._instance_lock prevents duplicate instantiations."""
    assert hasattr(SkillTaxonomyService, "_instance_lock")
    assert isinstance(SkillTaxonomyService._instance_lock, type(threading.Lock()))

    original_instance = SkillTaxonomyService._instance
    init_count = 0
    orig_init = SkillTaxonomyService.__init__

    def slow_init(self, *args, **kwargs):
        nonlocal init_count
        init_count += 1
        time.sleep(0.02)
        orig_init(self, *args, **kwargs)

    try:
        SkillTaxonomyService._instance = None
        num_threads = 10
        barrier = threading.Barrier(num_threads)
        results = [None] * num_threads

        with patch.object(SkillTaxonomyService, "__init__", slow_init):
            def worker(index):
                barrier.wait()
                results[index] = SkillTaxonomyService.get_instance()

            with ThreadPoolExecutor(max_workers=num_threads) as executor:
                list(executor.map(worker, range(num_threads)))

        assert init_count == 1
        assert all(inst is not None for inst in results)
        assert len(set(id(inst) for inst in results)) == 1
        assert results[0] is SkillTaxonomyService._instance
    finally:
        SkillTaxonomyService._instance = original_instance


def test_llm_residue_extractor_lock_and_concurrency():
    """Verify LLMResidueExtractor._instance_lock and _anonymizer_lock prevent duplicate initialization."""
    assert hasattr(LLMResidueExtractor, "_instance_lock")
    assert isinstance(LLMResidueExtractor._instance_lock, type(threading.Lock()))

    original_instance = LLMResidueExtractor._instance
    init_count = 0

    def mock_init(self, *args, **kwargs):
        nonlocal init_count
        init_count += 1
        time.sleep(0.02)
        self._client = None
        self._anonymizer = None
        self._anonymizer_lock = threading.Lock()

    try:
        LLMResidueExtractor._instance = None
        num_threads = 10
        barrier = threading.Barrier(num_threads)
        results = [None] * num_threads

        with patch.object(LLMResidueExtractor, "__init__", mock_init):
            def worker(index):
                barrier.wait()
                results[index] = LLMResidueExtractor.get_instance()

            with ThreadPoolExecutor(max_workers=num_threads) as executor:
                list(executor.map(worker, range(num_threads)))

        assert init_count == 1
        assert len(set(id(inst) for inst in results)) == 1

        # Test on-demand anonymizer thread-safety
        extractor = results[0]
        anonymizer_init_count = 0
        mock_anonymizer = MagicMock()
        mock_anonymizer.anonymize.return_value = "sanitized text"

        def slow_anonymizer_cls(*args, **kwargs):
            nonlocal anonymizer_init_count
            anonymizer_init_count += 1
            time.sleep(0.02)
            return mock_anonymizer

        with patch("ats_core.parsers.anonymizer.ResumeAnonymizer", side_effect=slow_anonymizer_cls):
            redact_barrier = threading.Barrier(num_threads)
            redact_results = [None] * num_threads

            def redact_worker(index):
                redact_barrier.wait()
                redact_results[index] = extractor._redact_for_llm("raw text with john.doe@email.com")

            with ThreadPoolExecutor(max_workers=num_threads) as executor:
                list(executor.map(redact_worker, range(num_threads)))

            assert anonymizer_init_count == 1
            assert all(res is not None for res in redact_results)
    finally:
        LLMResidueExtractor._instance = original_instance


def test_default_evaluator_lock_and_concurrency():
    """Verify _default_evaluator_lock guards lazy evaluation model initialization."""
    assert hasattr(llm_evaluator, "_default_evaluator_lock")
    assert isinstance(llm_evaluator._default_evaluator_lock, type(threading.Lock()))

    orig_evaluator = llm_evaluator._default_evaluator
    evaluator_init_count = 0

    class MockEvaluator:
        def __init__(self):
            nonlocal evaluator_init_count
            evaluator_init_count += 1
            time.sleep(0.02)

        def evaluate(self, candidate_summary, job_description):
            return MagicMock(match_score=85.0)

    try:
        llm_evaluator._default_evaluator = None
        num_threads = 10
        barrier = threading.Barrier(num_threads)
        results = [None] * num_threads

        with patch.object(llm_evaluator, "LLMEvaluator", MockEvaluator):
            def worker(index):
                barrier.wait()
                results[index] = llm_evaluator.evaluate_candidate("summary", "job")

            with ThreadPoolExecutor(max_workers=num_threads) as executor:
                list(executor.map(worker, range(num_threads)))

        assert evaluator_init_count == 1
        assert llm_evaluator._default_evaluator is not None
        assert all(res is not None for res in results)
    finally:
        llm_evaluator._default_evaluator = orig_evaluator


def test_match_retriever_and_reranker_locks_and_concurrency():
    """Verify get_retriever and get_reranker in match.py avoid duplicate model loading under concurrency."""
    assert hasattr(match, "_retriever_lock")
    assert isinstance(match._retriever_lock, type(threading.Lock()))
    assert hasattr(match, "_reranker_lock")
    assert isinstance(match._reranker_lock, type(threading.Lock()))

    orig_retriever = match._retriever
    orig_reranker = match._reranker

    retriever_init_count = 0
    reranker_init_count = 0

    class MockRetriever:
        def __init__(self):
            nonlocal retriever_init_count
            retriever_init_count += 1
            time.sleep(0.02)

    class MockReranker:
        def __init__(self, *args, **kwargs):
            nonlocal reranker_init_count
            reranker_init_count += 1
            time.sleep(0.02)

    try:
        match._retriever = None
        match._reranker = None
        num_threads = 10
        barrier = threading.Barrier(num_threads)
        retriever_results = [None] * num_threads
        reranker_results = [None] * num_threads

        with patch("ats_core.search.hybrid_retriever.HybridCandidateRetriever", MockRetriever), \
             patch("ats_core.search.reranker.CandidateReranker", MockReranker):

            def retriever_worker(index):
                barrier.wait()
                retriever_results[index] = match.get_retriever()

            with ThreadPoolExecutor(max_workers=num_threads) as executor:
                list(executor.map(retriever_worker, range(num_threads)))

            assert retriever_init_count == 1
            assert len(set(id(inst) for inst in retriever_results)) == 1

            rerank_barrier = threading.Barrier(num_threads)

            def reranker_worker(index):
                rerank_barrier.wait()
                reranker_results[index] = match.get_reranker()

            with ThreadPoolExecutor(max_workers=num_threads) as executor:
                list(executor.map(reranker_worker, range(num_threads)))

            assert reranker_init_count == 1
            assert len(set(id(inst) for inst in reranker_results)) == 1
    finally:
        match._retriever = orig_retriever
        match._reranker = orig_reranker


def test_skill_matcher_and_embeddings_index_locks():
    """Verify SkillMatcher and SkillEmbeddingsIndex are also protected with locks."""
    assert hasattr(SkillMatcher, "_instance_lock")
    assert isinstance(SkillMatcher._instance_lock, type(threading.Lock()))

    orig_matcher = SkillMatcher._instance
    matcher_init_count = 0

    def mock_matcher_init(self, *args, **kwargs):
        nonlocal matcher_init_count
        matcher_init_count += 1
        time.sleep(0.02)

    try:
        SkillMatcher._instance = None
        num_threads = 10
        barrier1 = threading.Barrier(num_threads)
        matcher_results = [None] * num_threads

        with patch.object(SkillMatcher, "__init__", mock_matcher_init):
            def worker1(index):
                barrier1.wait()
                matcher_results[index] = SkillMatcher.get_instance()

            with ThreadPoolExecutor(max_workers=num_threads) as executor:
                list(executor.map(worker1, range(num_threads)))

        assert matcher_init_count == 1
        assert len(set(id(inst) for inst in matcher_results)) == 1

        if SkillEmbeddingsIndex is not None:
            assert hasattr(SkillEmbeddingsIndex, "_instance_lock")
            assert isinstance(SkillEmbeddingsIndex._instance_lock, type(threading.Lock()))

            orig_index = SkillEmbeddingsIndex._instance
            index_init_count = 0

            def mock_index_init(self, *args, **kwargs):
                nonlocal index_init_count
                index_init_count += 1
                time.sleep(0.02)

            try:
                SkillEmbeddingsIndex._instance = None
                barrier2 = threading.Barrier(num_threads)
                index_results = [None] * num_threads

                with patch.object(SkillEmbeddingsIndex, "__init__", mock_index_init):
                    def worker2(index):
                        barrier2.wait()
                        index_results[index] = SkillEmbeddingsIndex.get_instance()

                    with ThreadPoolExecutor(max_workers=num_threads) as executor:
                        list(executor.map(worker2, range(num_threads)))

                assert index_init_count == 1
                assert len(set(id(inst) for inst in index_results)) == 1
            finally:
                SkillEmbeddingsIndex._instance = orig_index
    finally:
        SkillMatcher._instance = orig_matcher
