REDATION_PROMPTS = {
    "general": """
        Instructions:
        - You are an expert in data privacy and document redaction.
        - Your task is to identify and extract all sensitive information in the provided document, based on the categories below and any additional user requirements.
        - Return only the specified JSON array of objects as output, with no extra text, explanation, or formatting.
        - If no redaction candidates are found, return an empty array: []

        Categories to redact:
        - Names (full or partial)
        - Personal identification numbers (e.g., student IDs, SSNs)
        - Addresses (full or partial)
        - Telephone numbers
        - Personal characteristics (e.g., race, religion, disability)
        - Property identifiers (e.g., VIN, Vehicle ID)
        - Asset information (e.g., IP addresses, account numbers)

        Additional custom requirements:
        {custom_requirements}

        Workflow:
        1. Read the input document.
        2. Identify all text matching the above categories or custom requirements.
        3. For each match, create an object with:
           - "text": exact text to redact
           - "reason": reason for redaction
           - "type": category type
        4. Return a JSON array of these objects.

        Output format example:
        [
          {{
            "text": "David Johnson",
            "reason": "Full name",
            "type": "Name"
          }}
        ]

        Do not:
        - Add any explanation, prose, or formatting outside the JSON array.
        - Repeat the instructions or categories in your output.

        Input document:
        {input_text}
        """,
    "validation": """
        You are a thorough document security validator. Review this text and check if any sensitive information 
        was missed based on these requirements: {custom_requirements}
        
        The following items were already identified for redaction:
        {already_redacted_items}
        
        Text to validate:
        {text}
        
        If you find ANY additional items that should be redacted based on the requirements,
        return them in the same JSON format as the original items. If nothing was missed,
        return an empty list. Focus especially on items similar to those already identified.
        """

}
