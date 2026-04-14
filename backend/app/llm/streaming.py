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
    response_format: dict | None = None,
    reasoning_effort: str | None = "none",
) -> tuple[str, int, int]:
    """
    Collect a full LLM response without streaming.

    reasoning_effort: Fireworks AI parameter to control chain-of-thought output.
      "none" (default) disables reasoning tokens entirely — required for DeepSeek V3
      and other thinking-capable models to return clean, structured JSON without a
      reasoning preamble. Pass None to omit the parameter (e.g. for streaming hints
      where reasoning is acceptable).

    Returns (response_text, input_tokens, output_tokens).
    """
    kwargs: dict = {"model": model, "messages": messages}
    if response_format:
        kwargs["response_format"] = response_format
    # Pass reasoning_effort via extra_body — this is a Fireworks-specific parameter
    # not in the OpenAI spec, so it must go through extra_body rather than as a
    # top-level kwarg.
    if reasoning_effort is not None:
        kwargs["extra_body"] = {"reasoning_effort": reasoning_effort}
    response = await client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content or ""
    input_tokens = response.usage.prompt_tokens if response.usage else 0
    output_tokens = response.usage.completion_tokens if response.usage else 0
    return content, input_tokens, output_tokens
