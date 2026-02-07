import os
import json
import asyncio
from typing import List, Dict, AsyncGenerator
from openai import AsyncOpenAI

# Load environment variables
import dotenv; dotenv.load_dotenv()

class DedalusClient:
    def __init__(self):
        self.api_key = os.environ.get("EXPO_PUBLIC_DEDALUS_API_KEY")
        if not self.api_key:
            print("Warning: EXPO_PUBLIC_DEDALUS_API_KEY not set")
            
        self.client = AsyncOpenAI(
            base_url="https://api.dedaluslabs.ai/v1",
            api_key=self.api_key
        )

    async def chat_completion(self, model: str, messages: List[Dict], stream: bool = False):
        try:
            # Adjust max_tokens based on model if needed
            max_tokens = 2048
            
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                stream=stream,
                max_tokens=max_tokens
            )
            return response
        except Exception as e:
            print(f"Dedalus API error for model {model}: {e}")
            raise e

class QueryRouter:
    def route(self, query: str, context: str = "") -> str:
        query_lower = query.lower()
        
        # Heuristics for routing
        if any(keyword in query_lower for keyword in ["analyze", "plan", "strategy"]):
             # User requested change: Claude was not responding, switched to GPT-4o
             return "openai/gpt-4o"
        
        if any(keyword in query_lower for keyword in ["spending", "budget", "numbers", "calculate", "total", "sum", "average"]):
             return "google/gemini-2.0-flash"
            
        # Default to fast/cheap model
        return "openai/gpt-4o-mini"

class AgentOrchestrator:
    def __init__(self, client: DedalusClient):
        self.client = client

    async def run_boardroom_workflow(self, message: str, financial_context: str, survey_context: str) -> AsyncGenerator[str, None]:
        """
        Executes the 'Boardroom' strategy: Screener -> Psychologist -> CFO.
        """
        yield "__🎙️ Boardroom Session Started__\n\n"
        
        # --- Agent 1: The Screener (Gemini 2.0 Flash) ---
        # Role: High-speed ingestion and summarization
        yield "> **Agents Active:** Screener (Gemini 2.0 Flash) is analyzing raw data...\n"
        
        screener_system = """You are the SCREENER. Your job is to ingest raw financial data and the user's query to produce a 'Financial Brief'.
        Analyze the data for anomalies, huge spending, or budget leaks.
        Output a concise summary of the situation.
        GUARDRAIL: If the user query is NOT about finance/money, output: "NON-FINANCIAL QUERY REJECTED".
        """
        screener_messages = [
            {"role": "system", "content": screener_system},
            {"role": "user", "content": f"Query: {message}\n\nData: {financial_context}"}
        ]
        
        # We use a fast model for this
        screener_response = await self.client.chat_completion("openai/gpt-4o-mini", screener_messages)
        financial_brief = screener_response.choices[0].message.content
        
        yield f"> **Screener Findings:** {financial_brief[:100]}...\n\n"
        
        if "NON_FINANCIAL" in financial_brief or "REJECTED" in financial_brief:
             yield "I focus exclusively on your financial goals. Please ask me about your spending, budget, or saving plans."
             return
        
        # --- Agent 2: The Psychologist (GPT-4o) ---
        # Role: Behavioral profiling
        yield "> **Agents Active:** Psychologist (GPT-4o) is profiling user behavior...\n"
        
        psych_system = f"""You are the PSYCHOLOGIST. Read the Financial Brief and the User's Profile.
        Determined the user's likely emotional state (e.g., Anxious, Impulsive, Apathetic, Motivated).
        Output 'Communication Guidelines' for the CFO to use (e.g., 'Be firm but kind', 'Use fear of loss', 'Celebrate small wins').
        
        User Profile: {survey_context}
        """
        psych_messages = [
            {"role": "system", "content": psych_system},
            {"role": "user", "content": f"Financial Brief: {financial_brief}"}
        ]
        
        psych_response = await self.client.chat_completion("openai/gpt-4o", psych_messages)
        comm_guidelines = psych_response.choices[0].message.content
        
        # yield f"> **Psychologist Insight:** {comm_guidelines}\n\n"
        
        # --- Agent 3: The CFO (Advanced Reasoning) ---
        # Role: Final Strategy & Advice
        yield "> **Agents Active:** CFO (Advanced Reasoning) is drafting the plan...\n\n"
        yield "---\n\n"
        
        cfo_system = f"""You are the CFO (Chief Financial Officer). 
        Your goal is to give the user specific, actionable financial advice.
        
        INPUTS:
        1. Situation: {financial_brief}
        2. User Psychology: {comm_guidelines}
        
        INSTRUCTIONS:
        - Write the final response to the user.
        - Adopt the tone suggested by the Psychologist.
        - Address the issues found by the Screener.
        - Be authoritative yet empathetic.
        """
        
        cfo_messages = [
            {"role": "system", "content": cfo_system},
            {"role": "user", "content": message}
        ]
        
        # Stream the final response
        async for chunk in self._stream_response("openai/gpt-4o", cfo_messages):
            yield chunk

    async def _stream_response(self, model, messages):
        try:
            stream = await self.client.chat_completion(model, messages, stream=True)
            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        yield delta.content
        except Exception as e:
            yield f"Error in stream: {str(e)}"

class ChatService:
    def __init__(self):
        self.dedalus_client = DedalusClient()
        self.router = QueryRouter()
        self.orchestrator = AgentOrchestrator(self.dedalus_client)

    async def get_response_stream(self, messages: List[Dict], financial_context: str = "", survey_context: str = "") -> AsyncGenerator[str, None]:
        user_message = messages[-1]["content"] if messages else ""
        
        # Check for Boardroom trigger (smart routing)
        # We trigger the boardroom for complex queries
        if any(k in user_message.lower() for k in ["analyze", "plan", "help", "debt", "invest", "strategy", "big picture"]):
            async for chunk in self.orchestrator.run_boardroom_workflow(user_message, financial_context, survey_context):
                yield chunk
            return

        # Standard routing for simple queries
        model = self.router.route(user_message, financial_context)
        print(f"Routing to model: {model}")
        yield f"__Using {self._get_friendly_model_name(model)}__\n\n"
        
        print("Starting stream from Dedalus...")
        async for chunk in self._stream_dedalus(model, messages, financial_context, survey_context):
            yield chunk
        print("Stream finished.")

    def _get_friendly_model_name(self, model: str) -> str:
        if "gpt-4o-mini" in model:
            return "Fast Reasoning"
        elif "gpt-4o" in model: # Covers gpt-4o (not mini)
            return "Advanced Reasoning" 
        elif "gemini" in model:
            return "Quantitative Reasoning"
        return "AI Model"

    async def _stream_dedalus(self, model: str, messages: List[Dict], financial_context: str, survey_context: str):
        system_prompt = self._get_system_prompt(financial_context, survey_context)
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        
        try:
            stream = await self.dedalus_client.chat_completion(model, full_messages, stream=True)
            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        yield delta.content
        except Exception as e:
             yield f"Error: {str(e)}"

    def _get_system_prompt(self, financial_context: str, survey_context: str) -> str:
        return f"""You are Origin, a professional AI financial advisor.
        
{f'Here is user financial data: {financial_context}' if financial_context else 'User has not connected bank account.'}

{f'User Survey Analysis (Goals & Behavior): {survey_context}' if survey_context else ''}

Guidelines:
- **STRICT DOMAIN RESTRICTION**: You are a FINANCIAL ADVISOR. Do NOT answer questions unrelated to finance, money, budgeting, economics, or wealth.
    - If asked about celebrities, movies, general trivia, coding, or politics, politely refuse: "I focus only on your financial well-being."
- Be concise but thorough
- Give specific, actionable recommendations
- Use numbers/percentages
- No specific investment advice (legal disclaimer)
- Adopt a supportive, personalized tone based on the user's profile.
"""

    async def analyze_survey(self, answers: Dict, financial_context: str = "") -> Dict:
        system_prompt = """You are a behavioral finance expert. Analyze the user's survey responses to identify their spending psychology.
        
        Output MUST be valid JSON with this structure:
        {
            "spending_regret": "string (analysis of what they regret and why)",
            "user_goals": "string (analysis of their main financial goals)",
            "top_categories": ["string", "string", "string", "string", "string"] (5 most relevant spending categories based on their answers and regret)
        }
        """
        
        user_prompt = f"""
        User Financial Context: {financial_context}
        
        Survey Answers:
        {json.dumps(answers, indent=2)}
        
        Analyze the user's financial personality, regrets, and goals.
        """
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        try:
            response = await self.dedalus_client.chat_completion("openai/gpt-4o", messages, stream=False)
            content = response.choices[0].message.content
            # Strip potential markdown code blocks if present
            content = content.replace("```json", "").replace("```", "").strip()
            return json.loads(content)
        except Exception as e:
            print(f"Error analyzing survey: {e}")
            # Fallback
            return {
                "spending_regret": "Could not analyze spending regret at this time.",
                "user_goals": "Could not analyze goals at this time.",
                "top_categories": ["Food & Drink", "Shopping", "Travel", "Groceries", "Entertainment"]
            }

    async def generate_behavioral_summary(self, transactions: List[Dict], user_profile: Dict = None) -> str:
        if not transactions:
            return "No transaction data available for analysis."
            
        # Summarize transactions for prompt context (limit to recent 20 for brevity)
        recent_txns = transactions[:20]
        txn_summary = "\n".join([
            f"- {t.get('date', 'N/A')}: {t.get('name', 'Unknown')} ${t.get('amount', 0)} ({t.get('category', ['Misc'])[0]})"
            for t in recent_txns
        ])
        
        system_prompt = "You are a behavioral finance expert. Provide a very concise (1 sentence max) summary of the user's spending behavior. fast-casual tone."
        
        user_prompt = f"""
        Recent Transactions:
        {txn_summary}
        
        User Profile:
        {json.dumps(user_profile if user_profile else {}, indent=2)}
        
        Analyze the user's financial behavior. Be encouraging but realistic.
        """
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        try:
            print("Generating behavioral summary...")
            response = await self.dedalus_client.chat_completion("openai/gpt-4o-mini", messages, stream=False)
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error generating behavioral summary: {e}")
            return "Unable to generate summary at this time. Please try again later."

