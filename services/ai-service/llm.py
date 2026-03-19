import os
from openai import OpenAI

_client = None

DEFAULT_MODEL = 'qwen/qwen3-next-80b-a3b-instruct:free'
REMOVED_MODELS = {
    'qwen/qwen3-235b-a22b:free',
}


def get_client():
    global _client
    if _client is None:
        api_key = os.getenv('OPENROUTER_API_KEY')
        if not api_key:
            raise RuntimeError('OPENROUTER_API_KEY environment variable not set')
        _client = OpenAI(
            base_url='https://openrouter.ai/api/v1',
            api_key=api_key,
        )
    return _client


def call_llm(prompt: str) -> str:
    client = get_client()
    configured_model = os.getenv('OPENROUTER_MODEL', DEFAULT_MODEL)
    model = DEFAULT_MODEL if configured_model in REMOVED_MODELS else configured_model
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0,
            timeout=60,
        )
    except Exception as exc:
        raise RuntimeError(f'LLM request failed: {exc}') from exc

    content = response.choices[0].message.content
    if not content:
        raise RuntimeError('LLM returned an empty response')
    return content
