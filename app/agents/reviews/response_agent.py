"""
Module: Review Auto-Response Agent (response_agent.py)
Description: Generates brand-aligned replies to user reviews based on their authenticity verdict.
ADK Pattern: LlmAgent (uses LLM to draft responses following the Stride Co. guidelines)
Skills Applied: None
Inputs:
    - review_text: str (original review text)
    - rating: int (review stars)
    - authenticity_label: str (verdict of the review)
Outputs:
    - dict: generated reply text, reply type classification, and word count.
"""

import uuid
from google.adk.agents import Agent

class ResponseAgent:
    def __init__(self):
        """Initializes the response agent with an ADK review responder."""
        self.name = "response_agent"
        self.adk_agent = Agent(
            name="review_responder_agent",
            model="gemini-flash-latest",
            instruction="""You are the Stride Co. AI Review Responder.
Your job is to generate appropriate customer review responses.
Stride Co. brand voice is: warm, confident, premium but approachable.

Rules:
1. For GENUINE positive reviews (4-5 stars, authentic): Warm thank-you, mention specific product details, encourage repeat purchase.
2. For GENUINE negative reviews (1-3 stars, authentic): Show empathy, offer solution, request direct contact info.
3. For SUSPICIOUS/FAKE reviews (flagged by system): Politely professional, request order verification details (to internal review) without acknowledging fraud.
4. Prohibited Words: NEVER say 'fake', 'fraud', 'suspicious', 'manipulated', 'bot' or similar in public responses.
5. Max 150 words per response.
6. Always end with: '— Team Stride Co.'
"""
        )

    async def generate_response(self, review_text: str, rating: int, authenticity_label: str) -> dict:
        """Generates a contextual response to a review based on its rating and authenticity.

        Args:
            review_text (str): Raw text content of the review.
            rating (int): Numerical star rating.
            authenticity_label (str): Classification label (GENUINE, SUSPICIOUS, FAKE).

        Returns:
            dict: Generated reply content and response category badge.
        """
        prompt = f"""
Review: "{review_text}"
Rating: {rating} stars
Authenticity Verdict: {authenticity_label}

Generate response:
"""
        from google.adk.runners import Runner
        from google.adk.apps import App
        from google.adk.sessions import InMemorySessionService
        from google.adk.artifacts import InMemoryArtifactService
        
        chat_app = App(root_agent=self.adk_agent, name="review_responder")
        runner = Runner(
            app=chat_app,
            session_service=InMemorySessionService(),
            artifact_service=InMemoryArtifactService(),
            auto_create_session=True,
        )
        
        from google.genai import types
        content = types.Content(parts=[types.Part.from_text(text=prompt)])
        
        response_text = ""
        async for event in runner.run_async(user_id="system", session_id=str(uuid.uuid4()), new_message=content):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        response_text += part.text

        response_text = response_text.strip()
        word_count = len(response_text.split())

        # Determine response type badge
        if authenticity_label.upper() == "FAKE" or authenticity_label.upper() == "SUSPICIOUS":
            response_type = "Professional Deflect"
        elif rating >= 4:
            response_type = "Thank You"
        else:
            response_type = "Empathy Response"

        return {
            "response_text": response_text,
            "response_type": response_type,
            "word_count": word_count,
            "run_id": f"run_{uuid.uuid4().hex[:12]}"
        }
