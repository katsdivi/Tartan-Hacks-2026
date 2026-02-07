import os
import asyncio
from openai import AsyncOpenAI
import dotenv; dotenv.load_dotenv()

async def test_replacement_model():
    client = AsyncOpenAI(
        base_url="https://api.dedaluslabs.ai/v1",
        api_key=os.environ.get("EXPO_PUBLIC_DEDALUS_API_KEY")
    )
    
    # Trying GPT-4o as the "Complex/Deep" model replacement
    model = "openai/gpt-4o"
    print(f"\n--- Testing Streaming for {model} ---")
    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Hello, simply reply with 'SUCCESS'."}],
            stream=True,
            max_tokens=50
        )
        
        async for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if delta.content:
                    print(f"{delta.content}", end="", flush=True)
        print("\nStream finished.")
                 
    except Exception as e:
        print(f"\nError testing {model}: {e}")

if __name__ == "__main__":
    asyncio.run(test_replacement_model())
