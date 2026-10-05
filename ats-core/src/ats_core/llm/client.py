import logging
import os
from typing import Any, Dict, Optional, Type, TypeVar, Union
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.runnables import Runnable

logger = logging.getLogger("ats.llm.client")

T = TypeVar("T", bound=BaseModel)

DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3.5-lightning:free"
DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1"
DEFAULT_OLLAMA_MODEL = "qwen3.5:2b"


def get_llm_config(
    base_url: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Resolves configuration for OpenRouter with automatic local Ollama fallback.
    """
    openrouter_key = (
        api_key
        or os.getenv("OPENROUTER_API_KEY", "").strip()
        or os.getenv("LLM_API_KEY", "").strip()
    )

    if openrouter_key:
        resolved_base_url = (
            base_url
            or os.getenv("LLM_BASE_URL", "").strip()
            or DEFAULT_OPENROUTER_BASE_URL
        )
        resolved_model = (
            model_name
            or os.getenv("LLM_MODEL", "").strip()
            or DEFAULT_OPENROUTER_MODEL
        )
        resolved_api_key = openrouter_key
        is_openrouter = "openrouter.ai" in resolved_base_url
    else:
        resolved_base_url = (
            base_url
            or os.getenv("OLLAMA_BASE_URL", "").strip()
            or DEFAULT_OLLAMA_BASE_URL
        )
        resolved_model = (
            model_name
            or os.getenv("OLLAMA_MODEL", "").strip()
            or DEFAULT_OLLAMA_MODEL
        )
        resolved_api_key = "ollama"
        is_openrouter = False

    return {
        "base_url": resolved_base_url,
        "model_name": resolved_model,
        "api_key": resolved_api_key,
        "is_openrouter": is_openrouter,
    }


def get_openrouter_chat_model(
    base_url: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: float = 0.0,
    max_retries: int = 3,
    request_timeout: float = 60.0,
    **kwargs: Any,
) -> ChatOpenAI:
    """
    Instantiates a LangChain ChatOpenAI client connected to OpenRouter (or fallback).
    Includes OpenRouter identification headers and retry configuration.
    """
    config = get_llm_config(base_url=base_url, model_name=model_name, api_key=api_key)

    headers: Dict[str, str] = {}
    if config["is_openrouter"]:
        headers["HTTP-Referer"] = os.getenv("OPENROUTER_HTTP_REFERER", "http://localhost:3000")
        headers["X-Title"] = os.getenv("OPENROUTER_APP_TITLE", "AI-Powered ATS")

    logger.info(
        f"Initializing LangChain ChatOpenAI model: {config['model_name']} "
        f"at endpoint: {config['base_url']} (OpenRouter: {config['is_openrouter']})"
    )

    return ChatOpenAI(
        model=config["model_name"],
        api_key=config["api_key"],
        base_url=config["base_url"],
        default_headers=headers if headers else None,
        temperature=temperature,
        max_retries=max_retries,
        timeout=request_timeout,
        **kwargs,
    )


def get_structured_llm(
    schema: Type[T],
    chat_model: Optional[ChatOpenAI] = None,
    base_url: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: float = 0.0,
    method: Optional[str] = None,
    **kwargs: Any,
) -> Runnable[Any, T]:
    """
    Creates a LangChain structured output runnable bound to a Pydantic schema.
    Selects 'function_calling' for OpenRouter models or 'json_mode' for local models.
    """
    model = chat_model or get_openrouter_chat_model(
        base_url=base_url,
        model_name=model_name,
        api_key=api_key,
        temperature=temperature,
        **kwargs,
    )

    # Determine structured output extraction method if not specified
    if method is None:
        target_base_url = str(getattr(model, "openai_api_base", "") or getattr(model, "base_url", ""))
        if "openrouter.ai" in target_base_url:
            method = "function_calling"
        else:
            method = "json_mode"

    try:
        return model.with_structured_output(schema, method=method)
    except Exception as e:
        logger.warning(
            f"Failed to create structured output with method='{method}', "
            f"falling back to default structured output: {e}"
        )
        return model.with_structured_output(schema)
