"""
Flexible provider configuration for LLM and embedding models.
"""

import os
from typing import Optional, Union
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.models.openai import OpenAIModel  
from pydantic_ai.models.google import GoogleModel
import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def get_llm_model(model_choice: Optional[str] = None) -> Union[OpenAIModel, GoogleModel]:
    """
    Get LLM model configuration based on environment variables.
    
    Args:
        model_choice: Optional override for model choice
    
    Returns:
        Configured model (OpenAI or Google)
    """
    llm_choice = model_choice or os.getenv('LLM_CHOICE', 'gpt-4-turbo-preview')
    api_key = os.getenv('LLM_API_KEY', '')
    
    # Determine provider based on model choice
    if 'gemini' in llm_choice.lower():
        # Use Google provider for Gemini models
        provider = GoogleProvider(api_key=api_key)
        return GoogleModel(llm_choice, provider=provider)
    else:
        # Default to OpenAI provider
        base_url = os.getenv('LLM_BASE_URL', 'https://api.openai.com/v1')
        provider = OpenAIProvider(base_url=base_url, api_key=api_key)
        return OpenAIModel(llm_choice, provider=provider)


def get_embedding_client() -> openai.AsyncOpenAI:
    """
    Get embedding client configuration based on environment variables.
    
    Returns:
        Configured OpenAI-compatible client for embeddings
    """
    embedding_provider = os.getenv('EMBEDDING_PROVIDER', 'openai').lower()
    api_key = os.getenv('LLM_API_KEY', '')  # Use same API key as LLM for Google
    
    if embedding_provider == 'google':
        # For Google embeddings, we'll need to use the Google AI client
        # For now, fall back to a compatible base URL approach
        base_url = os.getenv('EMBEDDING_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta')
        return openai.AsyncOpenAI(
            base_url=base_url,
            api_key=api_key
        )
    else:
        # Default OpenAI configuration
        base_url = os.getenv('EMBEDDING_BASE_URL', 'https://api.openai.com/v1')
        api_key = os.getenv('EMBEDDING_API_KEY', api_key)
        return openai.AsyncOpenAI(
            base_url=base_url,
            api_key=api_key
        )


def get_embedding_model() -> str:
    """
    Get embedding model name from environment.
    
    Returns:
        Embedding model name
    """
    return os.getenv('EMBEDDING_MODEL', 'text-embedding-3-small')


def get_ingestion_model() -> Union[OpenAIModel, GoogleModel]:
    """
    Get ingestion-specific LLM model (can be faster/cheaper than main model).
    
    Returns:
        Configured model for ingestion tasks
    """
    ingestion_choice = os.getenv('INGESTION_LLM_CHOICE')
    
    # If no specific ingestion model, use the main model
    if not ingestion_choice:
        return get_llm_model()
    
    return get_llm_model(model_choice=ingestion_choice)


# Provider information functions
def get_llm_provider() -> str:
    """Get the LLM provider name."""
    return os.getenv('LLM_PROVIDER', 'openai')


def get_embedding_provider() -> str:
    """Get the embedding provider name."""
    return os.getenv('EMBEDDING_PROVIDER', 'openai')


def validate_configuration() -> bool:
    """
    Validate that required environment variables are set.
    
    Returns:
        True if configuration is valid
    """
    required_vars = [
        'LLM_API_KEY',
        'LLM_CHOICE',
        'EMBEDDING_API_KEY',
        'EMBEDDING_MODEL'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"Missing required environment variables: {', '.join(missing_vars)}")
        return False
    
    return True


def get_model_info() -> dict:
    """
    Get information about current model configuration.
    
    Returns:
        Dictionary with model configuration info
    """
    return {
        "llm_provider": get_llm_provider(),
        "llm_model": os.getenv('LLM_CHOICE'),
        "llm_base_url": os.getenv('LLM_BASE_URL'),
        "embedding_provider": get_embedding_provider(),
        "embedding_model": get_embedding_model(),
        "embedding_base_url": os.getenv('EMBEDDING_BASE_URL'),
        "ingestion_model": os.getenv('INGESTION_LLM_CHOICE', 'same as main'),
    }