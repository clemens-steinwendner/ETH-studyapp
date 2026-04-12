"""
WebSocket token streaming relay (NFR-01: 800ms TTFT target).

Streams tokens from Fireworks AI directly to the frontend WebSocket connection.
"""
from collections.abc import AsyncIterator

from fastapi import WebSocket
from openai import AsyncOpenAI


async def stream_to_websocket(
    client: AsyncOpenAI,
    model: str,
    messages: list[dict],
    websocket: WebSocket,
) -> tuple[int, int]:
    """
    Stream LLM response tokens to a WebSocket connection.

    Returns (input_tokens, output_tokens) for budget tracking.
    """
    input_tokens = 0
    output_tokens = 0

    async with client.chat.completions.stream(
        model=model,
        messages=messages,
    ) as stream:
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                await websocket.send_text(delta)
                output_tokens += 1  # approximate; update from final usage when available

        # Capture final usage if available
        final = await stream.get_final_completion()
        if final.usage:
            input_tokens = final.usage.prompt_tokens
            output_tokens = final.usage.completion_tokens

    await websocket.send_text("[DONE]")
    return input_tokens, output_tokens


async def collect_response(
    client: AsyncOpenAI,
    model: str,
    messages: list[dict],
) -> tuple[str, int, int]:
    """
    Collect a full LLM response without streaming.

    Returns (response_text, input_tokens, output_tokens).
    """
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
    )
    content = response.choices[0].message.content or ""
    input_tokens = response.usage.prompt_tokens if response.usage else 0
    output_tokens = response.usage.completion_tokens if response.usage else 0
    return content, input_tokens, output_tokens
