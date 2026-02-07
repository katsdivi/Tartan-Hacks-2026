import os
import asyncio
import json
from openai import AsyncOpenAI
import dotenv; dotenv.load_dotenv()

async def test_dedalus():
    client = AsyncOpenAI(
        base_url="https://api.dedaluslabs.ai/v1",
        api_key=os.environ.get("EXPO_PUBLIC_DEDALUS_API_KEY")
    )
    
    models = ["openai/gpt-4o-mini", "anthropic/claude-3-5-sonnet", "google/gemini-2.0-flash"]
    
    for model in models:
        print(f"\n--- Testing {model} ---")
        try:
            print(f"Requesting completion for {model}...")
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "Hello, simply reply with 'SUCCESS'."}],
                stream=False, # Testing non-streaming first for clarity
                max_tokens=50
            )
            print(f"Response Object: {response}")
            if response.choices and response.choices[0].message.content:
                 print(f"Content: {response.choices[0].message.content}")
            else:
                 print("Error: No content in response choices.")
                 
        except Exception as e:
            print(f"Error testing {model}: {e}")

if __name__ == "__main__":
    asyncio.run(test_dedalus())
